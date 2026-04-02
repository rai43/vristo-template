'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArticleCategory, registrationsApi } from '@/lib/api/article-registrations';
import { Customer, getCustomer, getCustomers } from '@/lib/api/clients';
import { getOrder, getOrders, Order } from '@/lib/api/orders';
import PhotoAnnotator from './PhotoAnnotator';
import Swal from 'sweetalert2';

// ─── Constants ─────────────────────────────────────────────
const ARTICLE_CATEGORIES: ArticleCategory[] = [
    { name: 'vetements', label: 'Vêtements', quantity: 0 },
    { name: 'draps', label: 'Draps', quantity: 0, subCount1: 0, subLabel1: 'doubles draps' },
    { name: 'serviettes', label: 'Serviettes', quantity: 0, subCount1: 0, subLabel1: 'peignoirs' },
    { name: 'vestes', label: 'Vestes', quantity: 0 },
    { name: 'couettes', label: 'Couettes', quantity: 0 },
    { name: 'rideaux', label: 'Rideaux', quantity: 0 },
    { name: 'moquettes', label: 'Moquettes', quantity: 0 },
    { name: 'coussins', label: 'Coussins', quantity: 0 },
    { name: 'chaussures', label: 'Chaussures', quantity: 0 },
    { name: 'tapis', label: 'Tapis', quantity: 0 },
    { name: 'sacs', label: 'Sacs', quantity: 0 },
    { name: 'peluches', label: 'Peluches', quantity: 0 },
];

const CATEGORY_ICONS: Record<string, string> = {
    vetements: '👕',
    draps: '🛏️',
    serviettes: '🧴',
    vestes: '🧥',
    couettes: '🛌',
    rideaux: '🪟',
    moquettes: '🟫',
    coussins: '🛋️',
    chaussures: '👟',
    tapis: '🧶',
    sacs: '👜',
    peluches: '🧸',
};

const STEPS = ['Client', 'Opération', 'Photos', 'Articles', 'Sacs', 'Résumé'];

const OP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
    registered: { label: 'Enregistré', color: 'bg-blue-100 text-blue-700' },
    processing: { label: 'En traitement', color: 'bg-indigo-100 text-indigo-700' },
    ready_for_delivery: { label: 'Prêt', color: 'bg-green-100 text-green-700' },
    out_for_delivery: { label: 'En livraison', color: 'bg-purple-100 text-purple-700' },
    delivered: { label: 'Livré', color: 'bg-emerald-100 text-emerald-700' },
};

// ─── Image compression helper ──────────────────────────────
const MAX_FILE_SIZE = 800 * 1024; // 800KB target per compressed image (more aggressive for mobile)

const compressImage = (file: File, maxDim = 1024, quality = 0.6): Promise<File> =>
    new Promise((resolve) => {
        // Safety timeout — if compression hangs (common on iOS Safari), return original
        const timeout = setTimeout(() => {
            console.warn('[Compress] Timeout after 10s, using original file:', file.name);
            resolve(file);
        }, 10_000);

        // If the file is already small (< 300KB) and is a JPEG, keep as-is
        if (file.size < 300 * 1024 && file.type === 'image/jpeg') {
            clearTimeout(timeout);
            return resolve(file);
        }

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                try {
                    let { width, height } = img;
                    // Scale down to fit within maxDim × maxDim box
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        clearTimeout(timeout);
                        console.warn('[Compress] Canvas context unavailable, using original');
                        return resolve(file);
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    const tryCompress = (q: number) => {
                        canvas.toBlob(
                            (blob) => {
                                clearTimeout(timeout);
                                if (!blob) {
                                    console.warn('[Compress] toBlob returned null, using original');
                                    return resolve(file);
                                }
                                // If still too large and quality can be reduced, try again
                                if (blob.size > MAX_FILE_SIZE && q > 0.2) {
                                    tryCompress(q - 0.1);
                                } else {
                                    const ext = file.name.replace(/\.[^.]+$/, '');
                                    console.log(`[Compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB (q=${q.toFixed(1)})`);
                                    resolve(new File([blob], `${ext}.jpg`, { type: 'image/jpeg' }));
                                }
                            },
                            'image/jpeg',
                            q
                        );
                    };
                    tryCompress(quality);
                } catch (err) {
                    clearTimeout(timeout);
                    console.warn('[Compress] Canvas error, using original:', err);
                    resolve(file);
                }
            };
            img.onerror = () => { clearTimeout(timeout); resolve(file); };
            img.src = e.target!.result as string;
        };
        reader.onerror = () => { clearTimeout(timeout); resolve(file); };
        reader.readAsDataURL(file);
    });

// ═══════════════════════════════════════════════════════════
// IndexedDB persistence for photos (survives reload / connection loss)
// ═══════════════════════════════════════════════════════════
const IDB_NAME = 'mirai_reg_photos';
const IDB_STORE = 'photos';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** Persist a File as an ArrayBuffer + metadata */
async function idbSavePhoto(file: File, sessionKey: string): Promise<void> {
    const db = await openIDB();
    const buf = await file.arrayBuffer();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add({
        sessionKey,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        buffer: buf,
        savedAt: Date.now(),
    });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Load all photos for a session */
async function idbLoadPhotos(sessionKey: string): Promise<File[]> {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const all: any[] = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return all.filter((r) => r.sessionKey === sessionKey).map((r) => new File([r.buffer], r.name, { type: r.type, lastModified: r.lastModified }));
}

/** Clear photos for a session */
async function idbClearPhotos(sessionKey: string): Promise<void> {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const all: any[] = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    for (const r of all) {
        if (r.sessionKey === sessionKey) store.delete(r.id);
    }
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// LocalStorage keys for persisting registration context
const LS_REG_CTX = 'mirai_reg_ctx';

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const RegistrationFlow = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const bagCameraRef = useRef<HTMLInputElement>(null);
    const bagGalleryRef = useRef<HTMLInputElement>(null);

    // URL params for pre-filling
    const preOrderId = searchParams.get('orderId');
    const preClientId = searchParams.get('clientId');
    const preOpIndex = searchParams.get('opIndex');
    const returnTo = searchParams.get('returnTo');

    // ── IndexedDB session key (stable per order+op combination) ──
    const idbSessionKey = useMemo(() => `reg_${preOrderId || 'new'}_${preOpIndex || '0'}`, [preOrderId, preOpIndex]);
    const [_idbReady, setIdbReady] = useState(false);

    // ── State ──────────────────────────────────────────────
    const [step, setStep] = useState(0);
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    // Restore registrationId from localStorage on mount (handles mobile reload/state loss).
    // In edit mode, only restore if the saved context matches the current order+opIndex
    // (prevents restoring a stale registrationId from a different session).
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const ctxRaw = localStorage.getItem(LS_REG_CTX);
            if (ctxRaw) {
                const ctx = JSON.parse(ctxRaw);
                if (ctx.registrationId) {
                    if (preOrderId) {
                        // Edit mode: only restore if it matches the current order + opIndex
                        const savedOrderId = ctx.selectedOrder?._id;
                        const savedOpIndex = ctx.operationIndex;
                        const currentOpIndex = preOpIndex ? parseInt(preOpIndex, 10) : 0;
                        if (savedOrderId === preOrderId && savedOpIndex === currentOpIndex) {
                            setRegistrationId(ctx.registrationId);
                            console.log('[Registration] Restored registrationId from localStorage (edit mode):', ctx.registrationId);
                        }
                    } else {
                        setRegistrationId(ctx.registrationId);
                        console.log('[Registration] Restored registrationId from localStorage:', ctx.registrationId);
                    }
                }
            }
        } catch (err) {
            // Ignore JSON parse errors
        }
    }, [preOrderId, preOpIndex]);

    // Existing registration (when editing an operation that already has one)
    const [existingRegId, setExistingRegId] = useState<string | null>(null);
    const [existingPhotos, setExistingPhotos] = useState<{ url: string; filename: string; type: string }[]>([]);
    // Photos marked for deletion (deferred — only deleted on successful save)
    const [photosToDelete, setPhotosToDelete] = useState<{ url: string; filename: string }[]>([]);

    // Step 0: Client
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

    // Step 1: Operation
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [operationIndex, setOperationIndex] = useState<number>(0);

    // Step 2: Photos
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ uploaded: 0, total: 0 });
    const [rapidCameraMode, setRapidCameraMode] = useState(false);
    const [lastAddedFlash, setLastAddedFlash] = useState(false);
    const lastCaptureSourceRef = useRef<'camera' | 'gallery'>('gallery');
    const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null); // Index of photo being annotated

    // Step 3: Articles
    const [articles, setArticles] = useState<ArticleCategory[]>(ARTICLE_CATEGORIES.map((c) => ({ ...c })));
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customQty, setCustomQty] = useState(1);

    // Step 4: Bags
    const [bagCount, setBagCount] = useState(0);
    const [bagPhotos, setBagPhotos] = useState<File[]>([]);
    const [bagPreviews, setBagPreviews] = useState<string[]>([]);
    const [bagNotes, setBagNotes] = useState('');

    // Notes
    const [notes, setNotes] = useState('');

    // Loading
    const [isSaving, setIsSaving] = useState(false);
    // Track if the registration was successfully completed in THIS session
    // (separate from registrationId which may be restored from localStorage for save-flow fallback)
    const [isCompleted, setIsCompleted] = useState(false);

    // ── Computed ───────────────────────────────────────────
    const totalArticles = useMemo(() => articles.reduce((sum, a) => sum + a.quantity, 0), [articles]);

    // ── Restore photos from IndexedDB on mount ────────────
    useEffect(() => {
        if (typeof window === 'undefined' || !('indexedDB' in window)) {
            setIdbReady(true);
            return;
        }
        idbLoadPhotos(idbSessionKey)
            .then((files) => {
                if (files.length > 0) {
                    const previews = files.map((f) => URL.createObjectURL(f));
                    setPhotos(files);
                    setPhotoPreviews(previews);
                    console.log(`[IDB] Restored ${files.length} photos from session ${idbSessionKey}`);
                }
            })
            .catch((err) => console.warn('[IDB] restore failed:', err))
            .finally(() => setIdbReady(true));
    }, [idbSessionKey]);

    // ── Client search ─────────────────────────────────────
    const { data: clientResults } = useQuery({
        queryKey: ['customers-search', clientSearch],
        queryFn: async () => {
            if (clientSearch.length < 2) return [];
            const res = await getCustomers({ q: clientSearch, limit: 10, page: 1 });
            return res.data?.data || [];
        },
        enabled: clientSearch.length >= 2 && !selectedClient,
        staleTime: 10_000,
    });

    // ── Orders for selected client ────────────────────────
    const { data: clientOrders, isLoading: isLoadingOrders } = useQuery({
        queryKey: ['client-orders', selectedClient?._id],
        queryFn: async () => {
            if (!selectedClient) return [];
            const res = await getOrders({
                customerId: selectedClient._id,
                limit: 50,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });
            return res.data?.data || [];
        },
        enabled: !!selectedClient && step === 1,
        staleTime: 10_000,
    });

    // ── Pre-fill from URL params ──────────────────────────
    const [prefilled, setPrefilled] = useState(false);
    // Track if we came from the operations page (edit mode) — blocks going back to client/operation steps
    const isEditMode = !!(preOrderId && preOpIndex);

    useEffect(() => {
        if (prefilled) return;
        if (!preOrderId) return;

        const prefill = async () => {
            try {
                const orderRes = await getOrder(preOrderId);
                const order = orderRes.data;
                setSelectedOrder(order);

                const opIdx = preOpIndex ? parseInt(preOpIndex, 10) : 0;
                setOperationIndex(opIdx);

                // Pre-fill articles from existing operation clothesDetails
                const isSub = order.type === 'subscription';
                const pickup = isSub ? order.pickupSchedule?.[opIdx] : order.pickup;
                if (pickup?.clothesCount && pickup.clothesCount > 0 && pickup.clothesDetails) {
                    const details = pickup.clothesDetails as { category?: string; name: string; quantity: number }[];
                    const newArticles = ARTICLE_CATEGORIES.map((c) => ({ ...c }));

                    // Map clothesDetails back to article categories
                    const couettes = details.find((d) => d.name === 'Couettes')?.quantity || 0;
                    const vestes = details.find((d) => d.name === 'Vestes')?.quantity || 0;
                    const drapsServ = details.find((d) => d.name === 'Draps & Serviettes')?.quantity || 0;
                    const draps = details.find((d) => d.name === 'Draps')?.quantity || 0;
                    const serviettes = details.find((d) => d.name === 'Serviettes')?.quantity || 0;
                    const rideaux = details.find((d) => d.name === 'Rideaux')?.quantity || 0;
                    const moquettes = details.find((d) => d.name === 'Moquettes')?.quantity || 0;
                    const coussins = details.find((d) => d.name === 'Coussins')?.quantity || 0;
                    const chaussures = details.find((d) => d.name === 'Chaussures')?.quantity || 0;
                    const tapis = details.find((d) => d.name === 'Tapis')?.quantity || 0;
                    const sacs = details.find((d) => d.name === 'Sacs')?.quantity || 0;
                    const peluches = details.find((d) => d.name === 'Peluches')?.quantity || 0;

                    // Calculate ordinaires (everything minus specials)
                    const specialTotal = couettes + vestes + drapsServ + draps + serviettes + rideaux + moquettes + coussins + chaussures + tapis + sacs + peluches;
                    const ordinaires = Math.max(0, pickup.clothesCount - specialTotal);

                    // Set quantities
                    for (const a of newArticles) {
                        switch (a.name) {
                            case 'vetements':
                                a.quantity = ordinaires;
                                break;
                            case 'draps':
                                a.quantity = drapsServ > 0 ? Math.ceil(drapsServ / 2) : draps;
                                break;
                            case 'serviettes':
                                a.quantity = drapsServ > 0 ? Math.floor(drapsServ / 2) : serviettes;
                                break;
                            case 'couettes':
                                a.quantity = couettes;
                                break;
                            case 'vestes':
                                a.quantity = vestes;
                                break;
                            case 'rideaux':
                                a.quantity = rideaux;
                                break;
                            case 'moquettes':
                                a.quantity = moquettes;
                                break;
                            case 'coussins':
                                a.quantity = coussins;
                                break;
                            case 'chaussures':
                                a.quantity = chaussures;
                                break;
                            case 'tapis':
                                a.quantity = tapis;
                                break;
                            case 'sacs':
                                a.quantity = sacs;
                                break;
                            case 'peluches':
                                a.quantity = peluches;
                                break;
                        }
                    }

                    // Add any custom categories from clothesDetails not in defaults
                    const knownNames = new Set(['Couettes', 'Vestes', 'Draps & Serviettes', 'Draps', 'Serviettes', 'Rideaux', 'Moquettes', 'Coussins', 'Chaussures', 'Tapis', 'Sacs', 'Peluches']);
                    for (const d of details) {
                        if (!knownNames.has(d.name) && d.quantity > 0) {
                            const key = d.name.toLowerCase().replace(/\s+/g, '_');
                            newArticles.push({ name: key, label: d.name, quantity: d.quantity });
                        }
                    }

                    setArticles(newArticles);
                }

                // Check for existing registration for this order + operation
                try {
                    const existingRegs = await registrationsApi.getByOrder(preOrderId);
                    const matchingReg = existingRegs.find((r) => r.operationIndex === opIdx && (r.status === 'completed' || r.status === 'draft'));
                    if (matchingReg) {
                        setExistingRegId(matchingReg._id);
                        if (matchingReg.photos && matchingReg.photos.length > 0) {
                            setExistingPhotos(
                                matchingReg.photos.map((p) => ({
                                    url: p.url,
                                    filename: p.filename,
                                    type: p.type,
                                }))
                            );
                        }
                        // Also prefill articles from the registration if not already from operation
                        if (matchingReg.articles && matchingReg.articles.length > 0 && !(pickup?.clothesCount && pickup.clothesCount > 0)) {
                            const regArticles = ARTICLE_CATEGORIES.map((c) => ({ ...c }));
                            for (const regArt of matchingReg.articles) {
                                const found = regArticles.find((a) => a.name === regArt.name);
                                if (found) {
                                    found.quantity = regArt.quantity;
                                    if (regArt.subCount1) found.subCount1 = regArt.subCount1;
                                } else if (regArt.quantity > 0) {
                                    regArticles.push({
                                        name: regArt.name,
                                        label: regArt.label,
                                        quantity: regArt.quantity,
                                    });
                                }
                            }
                            setArticles(regArticles);
                        }
                        if (matchingReg.notes) {
                            setNotes(matchingReg.notes);
                        }
                    }
                } catch (regErr) {
                    console.error('Error fetching existing registrations:', regErr);
                }

                const clientId = preClientId || (order as any)?.customerId?._id || (order as any)?.customerId;
                if (clientId && typeof clientId === 'string') {
                    const clientRes = await getCustomer(clientId);
                    const client = clientRes.data;
                    if (client) {
                        setSelectedClient(client);
                        setClientSearch(client.name || '');
                        setStep(2); // Skip to photos step
                    }
                }
            } catch (err) {
                console.error('Error prefilling registration:', err);
            }
            setPrefilled(true);
        };

        prefill();
    }, [preOrderId, preClientId, preOpIndex, prefilled]);

    // ── Article counter helpers ────────────────────────────
    const updateCount = useCallback((name: string, delta: number) => {
        setArticles((prev) =>
            prev.map((a) =>
                a.name === name
                    ? {
                          ...a,
                          quantity: Math.max(0, a.quantity + delta),
                      }
                    : a
            )
        );
    }, []);

    const setCount = useCallback((name: string, value: number) => {
        setArticles((prev) => prev.map((a) => (a.name === name ? { ...a, quantity: Math.max(0, value) } : a)));
    }, []);

    const updateSubCount = useCallback((name: string, value: number) => {
        setArticles((prev) => prev.map((a) => (a.name === name ? { ...a, subCount1: Math.max(0, value) } : a)));
    }, []);

    const addCustomArticle = () => {
        if (!customName.trim()) return;
        const key = customName.toLowerCase().replace(/\s+/g, '_');
        const exists = articles.find((a) => a.name === key);
        if (exists) {
            setCount(key, exists.quantity + customQty);
        } else {
            setArticles((prev) => [...prev, { name: key, label: customName.trim(), quantity: customQty }]);
        }
        setCustomName('');
        setCustomQty(1);
        setShowCustomModal(false);
    };

    const removeCustomArticle = (name: string) => {
        setArticles((prev) => prev.filter((a) => a.name !== name));
    };

    // ── Photo capture ─────────────────────────────────────
    // Simple approach: each tap on the camera button opens native camera once.
    // No auto-retrigger (blocked by mobile browsers). The UX is optimized
    // so the camera button is always big and easy to tap again.
    const photoStripRef = useRef<HTMLDivElement>(null);

    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const isFromCamera = e.target === cameraInputRef.current;
        lastCaptureSourceRef.current = isFromCamera ? 'camera' : 'gallery';
        e.target.value = ''; // reset so same file can be re-selected

        setIsCompressing(true);
        const COMPRESS_BATCH = 5;
        const allCompressed: File[] = [];
        const allPreviews: string[] = [];

        for (let i = 0; i < files.length; i += COMPRESS_BATCH) {
            const batch = files.slice(i, i + COMPRESS_BATCH);
            const compressed = await Promise.all(batch.map((f) => compressImage(f)));
            allCompressed.push(...compressed);
            allPreviews.push(...compressed.map((f) => URL.createObjectURL(f)));
        }

        setPhotos((prev) => [...prev, ...allCompressed]);
        setPhotoPreviews((prev) => [...prev, ...allPreviews]);
        setIsCompressing(false);

        // Persist each new photo to IndexedDB (fire-and-forget)
        for (const f of allCompressed) {
            idbSavePhoto(f, idbSessionKey).catch((err) => console.warn('[IDB] save failed:', err));
        }

        // Flash feedback for newly added photos
        setLastAddedFlash(true);
        setTimeout(() => setLastAddedFlash(false), 800);

        // Auto-scroll to show newest photos
        setTimeout(() => {
            photoStripRef.current?.scrollTo({ left: photoStripRef.current.scrollWidth, behavior: 'smooth' });
        }, 100);

        // In rapid camera mode, auto-reopen camera after a short delay
        if (rapidCameraMode && isFromCamera) {
            setTimeout(() => {
                cameraInputRef.current?.click();
            }, 400);
        }
    };

    const removePhoto = (index: number) => {
        URL.revokeObjectURL(photoPreviews[index]);
        setPhotos((prev) => {
            const next = prev.filter((_, i) => i !== index);
            // Rebuild IDB with remaining photos
            idbClearPhotos(idbSessionKey)
                .then(() => Promise.all(next.map((f) => idbSavePhoto(f, idbSessionKey))))
                .catch((err) => console.warn('[IDB] rebuild after remove failed:', err));
            return next;
        });
        setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleBagPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = '';

        setIsCompressing(true);
        const COMPRESS_BATCH = 5;
        const allCompressed: File[] = [];
        const allPreviews: string[] = [];

        for (let i = 0; i < files.length; i += COMPRESS_BATCH) {
            const batch = files.slice(i, i + COMPRESS_BATCH);
            const compressed = await Promise.all(batch.map((f) => compressImage(f)));
            allCompressed.push(...compressed);
            allPreviews.push(...compressed.map((f) => URL.createObjectURL(f)));
        }

        setBagPhotos((prev) => [...prev, ...allCompressed]);
        setBagPreviews((prev) => [...prev, ...allPreviews]);
        setIsCompressing(false);
    };

    const removeBagPhoto = (index: number) => {
        URL.revokeObjectURL(bagPreviews[index]);
        setBagPhotos((prev) => prev.filter((_, i) => i !== index));
        setBagPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    // Remove an existing photo — deferred deletion (only deleted on successful save)
    const removeExistingPhoto = async (photo: { url: string; filename: string; type: string }) => {
        const confirm = await Swal.fire({
            title: 'Supprimer cette photo ?',
            text: 'La photo sera supprimée lors de la sauvegarde.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ef4444',
        });
        if (!confirm.isConfirmed) return;
        // Mark for deferred deletion
        setPhotosToDelete((prev) => [...prev, { url: photo.url, filename: photo.filename }]);
        // Remove from visible list
        setExistingPhotos((prev) => prev.filter((p) => p.url !== photo.url));
    };

    // ── Submit flow ───────────────────────────────────────
    const [saveStep, setSaveStep] = useState<string>('');

    const handleComplete = async () => {
        if (totalArticles === 0) {
            Swal.fire('Attention', 'Veuillez compter au moins un article', 'warning');
            return;
        }
        if (!selectedOrder) {
            Swal.fire('Attention', 'Veuillez sélectionner une commande', 'warning');
            return;
        }

        // Validate photo count matches article count — hard block
        const totalPhotoCount = photos.length + existingPhotos.length;
        if (totalPhotoCount !== totalArticles) {
            await Swal.fire({
                icon: 'error',
                title: 'Nombre de photos incorrect',
                html: `<p>Vous avez <b>${totalPhotoCount} photo${totalPhotoCount > 1 ? 's' : ''}</b> mais <b>${totalArticles} article${totalArticles > 1 ? 's' : ''}</b>.</p>
                       <p class="text-sm text-gray-500 mt-2">Le nombre de photos doit être égal au nombre d'articles. Veuillez corriger avant de continuer.</p>`,
                confirmButtonText: 'Corriger',
                confirmButtonColor: '#e74c3c',
            });
            return;
        }

        const confirm = await Swal.fire({
            title: "Confirmer l'enregistrement ?",
            html: `<b>${totalArticles} pièces</b> pour <b>${selectedClient?.name || 'Client'}</b><br/><small>${selectedOrder.orderId} — Op. ${operationIndex + 1}</small>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
        });
        if (!confirm.isConfirmed) return;

        const clientId = selectedClient?._id || preClientId || '';
        if (!clientId) {
            Swal.fire('Erreur', 'Client non sélectionné. Veuillez retourner à la première étape.', 'error');
            return;
        }

        setIsSaving(true);
        setSaveStep(existingRegId ? 'Mise à jour...' : "Création de l'enregistrement...");

        // Use existingRegId first, then fall back to registrationId from state
        // (which may have been restored from localStorage after a mobile page reload)
        let regId: string | null = existingRegId || registrationId || null;

        try {
            if (!regId) {
                // Before creating, check if a registration already exists for this order+opIndex
                // (handles mobile state loss where existingRegId was set during prefill but lost on reload)
                try {
                    const existingRegs = await registrationsApi.getByOrder(selectedOrder._id);
                    const matchingReg = existingRegs.find(
                        (r) => r.operationIndex === operationIndex && (r.status === 'completed' || r.status === 'draft')
                    );
                    if (matchingReg) {
                        regId = matchingReg._id;
                        console.log('[Registration] Found existing registration on re-check:', regId);
                    }
                } catch (checkErr) {
                    console.warn('[Registration] Failed to check for existing registration:', checkErr);
                }
            }

            if (!regId) {
                // Create new registration only if no existing one found
                const reg = await registrationsApi.create({
                    orderId: selectedOrder._id,
                    clientId,
                    operationIndex,
                    notes,
                });
                // Robustly extract the ID — handle _id, id, data._id, or nested structures
                regId = reg?._id || (reg as any)?.id || (reg as any)?.data?._id || (reg as any)?.data?.id || null;

                // Fallback: if create succeeded but response lacks _id,
                // query the server for the just-created registration
                if (!regId) {
                    console.warn('[Registration] Create response missing _id, querying server. Response keys:', reg ? Object.keys(reg) : 'null');
                    try {
                        const regs = await registrationsApi.getByOrder(selectedOrder._id);
                        const justCreated = regs.find(
                            (r) => r.operationIndex === operationIndex && r.status === 'draft'
                        );
                        if (justCreated) {
                            regId = justCreated._id || (justCreated as any)?.id;
                            console.warn('[Registration] Found just-created registration via fallback:', regId);
                        }
                    } catch (fallbackErr) {
                        console.error('[Registration] Fallback query failed:', fallbackErr);
                    }
                }

                if (!regId) {
                    // Show debug info on screen so we can diagnose on mobile
                    const debugInfo = JSON.stringify(reg, null, 2)?.slice(0, 300) || 'null';
                    await Swal.fire({
                        icon: 'error',
                        title: 'Erreur technique',
                        html: `<p>L'enregistrement a été créé mais l'identifiant est manquant.</p>
                               <pre style="text-align:left;font-size:10px;max-height:150px;overflow:auto;background:#f5f5f5;padding:8px;border-radius:4px">${debugInfo}</pre>`,
                        confirmButtonText: 'Réessayer',
                    });
                    throw new Error('_id missing from create response');
                }
                setRegistrationId(regId); // Persist immediately
                // Also persist to localStorage
                if (typeof window !== 'undefined') {
                    const ctx = {
                        registrationId: regId,
                        selectedOrder,
                        selectedClient,
                        operationIndex,
                    };
                    localStorage.setItem(LS_REG_CTX, JSON.stringify(ctx));
                }
                console.log('[Registration] Created:', regId);
            } else {
                console.log('[Registration] Using existing:', regId);
            }

            // Step 2: Update articles
            setSaveStep('Sauvegarde des articles...');
            await registrationsApi.update(regId, {
                articles,
                bags: { count: bagCount, notes: bagNotes, photoUrls: [] },
            });
            console.log('[Registration] Articles updated');

            // Step 3: Upload article photos
            if (photos.length > 0) {
                setIsUploading(true);
                setSaveStep(`Envoi des photos (0/${photos.length})...`);
                setUploadProgress({ uploaded: 0, total: photos.length });

                try {
                    await registrationsApi.uploadPhotos(regId, photos, 'articles', (uploaded, total) => {
                        setUploadProgress({ uploaded, total });
                        setSaveStep(`Envoi des photos (${uploaded}/${total})...`);
                    });
                    console.log('[Registration] Article photos uploaded:', photos.length);
                } catch (uploadErr: any) {
                    console.error('[Registration] Photo upload error:', uploadErr);
                    // Continue even if photos fail - registration is already created
                    const continueAnyway = await Swal.fire({
                        icon: 'warning',
                        title: "Erreur lors de l'envoi des photos",
                        html: `<p>Les photos n'ont pas pu être envoyées.</p><p class="text-sm text-gray-500 mt-2">Erreur: ${uploadErr?.message || 'Connexion interrompue'}</p>`,
                        showCancelButton: true,
                        confirmButtonText: 'Continuer sans photos',
                        cancelButtonText: 'Réessayer',
                    });
                    if (!continueAnyway.isConfirmed) {
                        throw new Error('Photo upload cancelled by user');
                    }
                }
            }

            // Step 4: Upload bag photos
            if (bagPhotos.length > 0) {
                setSaveStep(`Envoi des photos de sacs (0/${bagPhotos.length})...`);
                setUploadProgress({ uploaded: 0, total: bagPhotos.length });

                try {
                    await registrationsApi.uploadPhotos(regId, bagPhotos, 'bags', (uploaded, total) => {
                        setUploadProgress({ uploaded, total });
                        setSaveStep(`Envoi des photos de sacs (${uploaded}/${total})...`);
                    });
                    console.log('[Registration] Bag photos uploaded:', bagPhotos.length);
                } catch (uploadErr: any) {
                    console.error('[Registration] Bag photo upload error:', uploadErr);
                    // Continue - bag photos are optional
                }
            }
            setIsUploading(false);

            // Step 5: Complete registration
            setSaveStep('Finalisation...');
            const completed = await registrationsApi.complete(regId);
            setRegistrationId(completed.registrationId);
            setIsCompleted(true); // Mark as completed in this session

            // Step 6: Delete photos that were marked for removal (deferred deletion)
            if (photosToDelete.length > 0 && existingRegId) {
                setSaveStep('Nettoyage des photos...');
                for (const photo of photosToDelete) {
                    try {
                        await registrationsApi.removePhoto(existingRegId, photo.url);
                    } catch (err) {
                        console.warn('[Registration] Failed to delete deferred photo:', photo.url, err);
                    }
                }
                setPhotosToDelete([]);
            }

            console.log('[Registration] Completed:', completed.registrationId);

            queryClient.invalidateQueries({ queryKey: ['operations'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['registrations'] });

            setIsSaving(false);
            setSaveStep('');

            // Clear persisted photos from IndexedDB after successful save
            idbClearPhotos(idbSessionKey).catch((err) => console.warn('[IDB] clear after success failed:', err));
            // Clear persisted context from localStorage
            if (typeof window !== 'undefined') localStorage.removeItem(LS_REG_CTX);

            await Swal.fire({
                icon: 'success',
                title: existingRegId ? 'Enregistrement mis à jour !' : 'Enregistrement terminé !',
                text: `${completed.totalArticles} pièces enregistrées`,
                timer: 2500,
                showConfirmButton: false,
            });

            // Always navigate back to returnTo if set, else to registration detail
            if (returnTo) {
                window.location.href = returnTo;
            } else {
                router.push(`/apps/registrations/${regId}`);
            }
        } catch (err: any) {
            console.error('[Registration] Error at step:', saveStep, err);
            setIsSaving(false);
            setIsUploading(false);
            setSaveStep('');

            // Build detailed error message
            let errorMessage = "Erreur lors de l'enregistrement";
            let errorDetails = '';

            if (err?.response?.data?.message) {
                // Backend may return a string or array of validation messages
                const msg = err.response.data.message;
                errorMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
            } else if (err?.message) {
                errorMessage = err.message;
            }

            // Check for common mobile errors
            if (err?.response?.status === 401) {
                errorMessage = 'Session expirée';
                errorDetails = 'Votre session a expiré. Vous allez être redirigé vers la page de connexion.';
                await Swal.fire({ icon: 'warning', title: errorMessage, text: errorDetails });
                window.location.href = '/management/auth';
                return;
            } else if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network')) {
                errorMessage = 'Erreur réseau';
                errorDetails = 'Vérifiez votre connexion internet et réessayez.';
            } else if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
                errorMessage = 'Délai dépassé';
                errorDetails = "L'envoi a pris trop de temps. Essayez avec moins de photos.";
            } else if (err?.response?.status === 413) {
                errorMessage = 'Fichiers trop volumineux';
                errorDetails = 'Réduisez le nombre ou la taille des photos.';
            } else if (err?.response?.status === 400) {
                errorDetails = 'Données invalides. Vérifiez les informations saisies.';
            }

            // If registration was created, offer to go to it
            if (regId) {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: errorMessage,
                    html: `<p>${errorDetails || "Une partie de l'enregistrement a été sauvegardée."}</p><p class="text-sm text-gray-500 mt-2">Étape: ${saveStep}</p>`,
                    showCancelButton: true,
                    confirmButtonText: "Voir l'enregistrement",
                    cancelButtonText: 'Fermer',
                });
                if (result.isConfirmed) {
                    router.push(`/apps/registrations/${regId}`);
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: errorMessage,
                    html: errorDetails ? `<p>${errorDetails}</p>` : undefined,
                    text: errorDetails ? undefined : `Étape: ${saveStep}`,
                });
            }
        }
    };

    // ── Summary text ──────────────────────────────────────
    const summaryText = useMemo(() => {
        const name = selectedClient?.name || 'CLIENT';
        const now = new Date();
        const d = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;
        let text = `LAVERIE MIRAÏ SERVICES – LISTE DES VÊTEMENTS DE ${name.toUpperCase()}\n\nDate : ${d}\n\n`;
        for (const a of articles) {
            const q = String(a.quantity).padStart(2, '0');
            let line = `${a.label} : ${q}`;
            if (a.subCount1 && a.subCount1 > 0 && a.subLabel1) line += ` (${a.subCount1} ${a.subLabel1})`;
            text += `${line}\n`;
        }
        text += `\nTotal : ${totalArticles} pièces`;
        return text;
    }, [articles, totalArticles, selectedClient]);

    // ── Helpers ────────────────────────────────────────────
    const isDefaultCategory = (name: string) => ARTICLE_CATEGORIES.some((c) => c.name === name);
    const goNext = () => setStep((s) => s + 1);
    // Minimum step the user can go back to: in edit mode (from operations page),
    // we skip Client + Operation selection (steps 0 & 1) since they're pre-filled.
    const minStep = isEditMode ? 2 : 0;
    const goBack = () => {
        if (step > minStep) {
            setStep((s) => s - 1);
        } else if (returnTo) {
            // Use window.location for reliable navigation back to the source page
            // router.push can fail with encoded paths on Next.js App Router
            window.location.href = returnTo;
        } else {
            router.back();
        }
    };
    return (
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-white dark:bg-[#0e1726]">
            {/* ── Top bar ── */}
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur dark:border-slate-700 dark:bg-[#0e1726]/95">
                <div className="mb-3 flex items-center justify-between">
                    <button onClick={goBack} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-base font-bold text-slate-800 dark:text-white">Enregistrement articles</h1>
                    <button
                        onClick={() => {
                            if (returnTo) {
                                window.location.href = returnTo;
                            } else if (existingRegId) {
                                router.push(`/apps/registrations/${existingRegId}`);
                            } else if (preOrderId) {
                                router.push(`/apps/orders/preview/${preOrderId}`);
                            } else {
                                router.push('/apps/registrations');
                            }
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                        title="Fermer"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {/* Edit mode context banner */}
                {isEditMode && selectedClient && selectedOrder && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5">
                        <span className="text-[10px] font-semibold text-primary">{selectedClient.name}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500">{selectedOrder.orderId}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500">Op. {operationIndex + 1}</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    {STEPS.map((s, i) => {
                        // In edit mode, hide Client and Opération steps
                        if (isEditMode && i < 2) return null;
                        return (
                            <div key={s} className="flex flex-1 flex-col items-center gap-1">
                                <div className={`h-1 w-full rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                <span className={`text-[8px] font-medium ${i === step ? 'text-primary' : 'text-slate-400'}`}>{s}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4">
                {/* ═══ STEP 0 — Client ═══ */}
                {step === 0 && (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Rechercher un client</label>
                            <input
                                type="text"
                                value={clientSearch}
                                onChange={(e) => {
                                    setClientSearch(e.target.value);
                                    if (selectedClient) setSelectedClient(null);
                                }}
                                placeholder="Nom ou téléphone..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                autoFocus
                            />
                        </div>

                        {clientResults && clientResults.length > 0 && !selectedClient && (
                            <div className="space-y-2">
                                {clientResults.map((c: Customer) => (
                                    <button
                                        key={c._id}
                                        onClick={() => {
                                            setSelectedClient(c);
                                            setClientSearch(c.name);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary/30 active:scale-[0.98] dark:border-slate-700"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-slate-800 dark:text-white">{c.name}</div>
                                            <div className="truncate text-xs text-slate-500">{c.phones?.[0]?.number || c.location || '—'}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedClient && (
                            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-green-600">Client sélectionné</span>
                                    <button
                                        onClick={() => {
                                            setSelectedClient(null);
                                            setClientSearch('');
                                        }}
                                        className="text-xs text-slate-400 hover:text-red-500"
                                    >
                                        Changer
                                    </button>
                                </div>
                                <div className="text-sm font-bold text-slate-800 dark:text-white">{selectedClient.name}</div>
                                {selectedClient.phones?.[0]?.number && <div className="mt-0.5 text-xs text-slate-500">{selectedClient.phones[0].number}</div>}
                            </div>
                        )}

                        <button
                            onClick={goNext}
                            disabled={!selectedClient}
                            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                        >
                            Continuer →
                        </button>
                    </div>
                )}

                {/* ═══ STEP 1 — Operation Selection ═══ */}
                {step === 1 && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Sélectionnez la commande et l&apos;opération concernée</p>

                        {isLoadingOrders && (
                            <div className="flex justify-center py-8">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                            </div>
                        )}

                        {!isLoadingOrders && (!clientOrders || clientOrders.length === 0) && (
                            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-600">
                                <p className="text-sm text-slate-500">Aucune commande trouvée pour ce client</p>
                            </div>
                        )}

                        {clientOrders && clientOrders.length > 0 && (
                            <div className="space-y-3">
                                {clientOrders
                                    .filter((o: Order) => !['cancelled'].includes(o.status) || o.type === 'subscription')
                                    .map((order: Order) => {
                                        const isSelected = selectedOrder?._id === order._id;
                                        const isSub = order.type === 'subscription';
                                        const pickups = isSub ? order.pickupSchedule || [] : [order.pickup];

                                        return (
                                            <div key={order._id} className={`rounded-xl border transition ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrder(order);
                                                        if (!isSub) setOperationIndex(0);
                                                    }}
                                                    className="flex w-full items-center gap-3 p-3 text-left"
                                                >
                                                    <div
                                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                                            isSub ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                                                        }`}
                                                    >
                                                        {isSub ? 'ABO' : 'ALC'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-slate-800 dark:text-white">{order.orderId}</span>
                                                            {order.packName && (
                                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{order.packName}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {order.pickup?.city || '—'} ·{' '}
                                                            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                            })}
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                        </svg>
                                                    )}
                                                </button>

                                                {isSelected && isSub && pickups.length > 0 && (
                                                    <div className="border-t border-slate-100 px-3 pb-3 pt-2 dark:border-slate-700/50">
                                                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sélectionnez l&apos;opération</div>
                                                        <div className="space-y-1.5">
                                                            {pickups.map((pickup: any, idx: number) => {
                                                                const st = OP_STATUS_LABELS[pickup.status || 'pending'] || OP_STATUS_LABELS.pending;
                                                                const isOpSelected = operationIndex === idx;
                                                                const hasClothes = pickup.clothesCount && pickup.clothesCount > 0;
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setOperationIndex(idx)}
                                                                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                                                                            isOpSelected ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200 dark:border-slate-700'
                                                                        } ${hasClothes ? 'opacity-50' : ''}`}
                                                                    >
                                                                        <div
                                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                                                                isOpSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                                                                            }`}
                                                                        >
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-semibold text-slate-700 dark:text-white">Op. {idx + 1}</span>
                                                                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${st.color}`}>{st.label}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400">
                                                                                Récup:{' '}
                                                                                {pickup.date
                                                                                    ? new Date(pickup.date).toLocaleDateString('fr-FR', {
                                                                                          day: '2-digit',
                                                                                          month: 'short',
                                                                                      })
                                                                                    : '—'}
                                                                                {hasClothes && <span className="ml-2 font-semibold text-green-600">✓ {pickup.clothesCount} pièces déjà</span>}
                                                                            </div>
                                                                        </div>
                                                                        {isOpSelected && !hasClothes && (
                                                                            <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                                                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}

                        <button
                            onClick={goNext}
                            disabled={!selectedOrder}
                            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                        >
                            Continuer →
                        </button>
                    </div>
                )}

                {/* ═══ STEP 2 — Photos ═══ */}
                {step === 2 && (
                    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 120px)' }}>
                        <div className="flex-1 space-y-3">
                            {/* ── Floating photo counter ── */}
                            {(photos.length > 0 || existingPhotos.length > 0) && (
                                <div
                                    className={`flex items-center justify-between rounded-2xl border p-3 transition-all duration-300 ${
                                        lastAddedFlash
                                            ? 'border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/30'
                                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black text-white transition-all duration-300 ${
                                                lastAddedFlash ? 'scale-110 bg-green-500' : 'bg-primary'
                                            }`}
                                        >
                                            {existingPhotos.length + photos.length}
                                        </span>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800 dark:text-white">
                                                photo{existingPhotos.length + photos.length > 1 ? 's' : ''}{' '}
                                                {existingPhotos.length > 0 && photos.length > 0
                                                    ? `(${existingPhotos.length} existante${existingPhotos.length > 1 ? 's' : ''} + ${photos.length} nouvelle${photos.length > 1 ? 's' : ''})`
                                                    : existingPhotos.length > 0
                                                    ? 'existante' + (existingPhotos.length > 1 ? 's' : '')
                                                    : 'prise' + (photos.length > 1 ? 's' : '')}
                                            </div>
                                            {photos.length > 0 && <div className="text-[10px] text-slate-400">{(photos.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(1)} MB nouvelles</div>}
                                        </div>
                                    </div>
                                    {lastAddedFlash && <span className="animate-bounce text-sm font-bold text-green-600">✓ Ajoutée!</span>}
                                </div>
                            )}

                            {!photos.length && !existingPhotos.length && <p className="text-sm text-slate-500">Prenez des photos des articles reçus</p>}

                            {/* Hidden file inputs — using id + label[htmlFor] for reliable mobile triggering */}
                            <input id="reg-camera-input" ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                            <input id="reg-gallery-input" ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handlePhotoCapture} className="hidden" />

                            {isCompressing && (
                                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-500" />
                                    Compression des images...
                                </div>
                            )}

                            {/* Rapid camera mode banner */}
                            {rapidCameraMode && (
                                <div className="flex items-center justify-between rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2.5 dark:border-primary/30 dark:bg-primary/10">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-3 w-3">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
                                            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                                        </span>
                                        <span className="text-xs font-bold text-primary">Mode rafale actif</span>
                                    </div>
                                    <button onClick={() => setRapidCameraMode(false)} className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary active:scale-95">
                                        Arrêter
                                    </button>
                                </div>
                            )}

                            {/* Existing photos from previous registration (read-only) */}
                            {existingPhotos.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Photos existantes ({existingPhotos.length})</span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {existingPhotos.map((photo, i) => (
                                            <div key={`existing-${i}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-blue-200">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={`/api-proxy${photo.url}`} alt={`Existante ${i + 1}`} className="h-full w-full object-cover" />
                                                <button
                                                    onClick={() => removeExistingPhoto(photo)}
                                                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white"
                                                >
                                                    ×
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-blue-500/80 py-0.5 text-center text-[8px] font-bold text-white">Existante</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Photo thumbnail strip (horizontal scroll) — new photos */}
                            {photoPreviews.length > 0 && (
                                <div className="space-y-2">
                                    <div ref={photoStripRef} className="flex gap-2 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
                                        {photoPreviews.map((src, i) => {
                                            const isNew = i >= photoPreviews.length - 1 && lastAddedFlash;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 transition-all duration-300 ${
                                                        isNew ? 'ring-2 ring-green-400 ring-offset-1' : ''
                                                    }`}
                                                    style={{ scrollSnapAlign: 'start' }}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                                                    <button
                                                        onClick={() => removePhoto(i)}
                                                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white"
                                                    >
                                                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                    {/* Annotate button */}
                                                    <button
                                                        onClick={() => setAnnotatingIndex(i)}
                                                        className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/90 text-white"
                                                        title="Annoter le défaut"
                                                    >
                                                        <span className="text-[8px]">✏️</span>
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-px text-center text-[8px] font-bold text-white">{i + 1}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Expanded grid view when there are many photos */}
                            {photoPreviews.length > 6 && (
                                <details className="rounded-xl border border-slate-200 dark:border-slate-700">
                                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-500">Voir toutes les photos ({photoPreviews.length})</summary>
                                    <div className="grid grid-cols-4 gap-1.5 p-2">
                                        {photoPreviews.map((src, i) => (
                                            <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                                                <button
                                                    onClick={() => removePhoto(i)}
                                                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white"
                                                >
                                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                {/* Annotate button */}
                                                <button
                                                    onClick={() => setAnnotatingIndex(i)}
                                                    className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/90 text-white"
                                                    title="Annoter le défaut"
                                                >
                                                    <span className="text-[8px]">✏️</span>
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-px text-center text-[8px] font-bold text-white">{i + 1}</div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}

                            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>
                                    <b>Astuce :</b> Utilisez <b>📸 Photo</b> pour prendre des photos une par une. <b>🖼️ Galerie</b> pour en sélectionner plusieurs. <b>✏️</b> sur une photo pour annoter un défaut.
                                </span>
                            </div>
                        </div>

                        {/* ── Sticky bottom bar: camera (primary) + gallery + rapid + continue ── */}
                        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-6 pt-3 backdrop-blur dark:border-slate-700 dark:bg-[#0e1726]/95">
                            <div className="mb-2 flex gap-2">
                                {/* Camera button — primary large action (uses <label> for reliable mobile triggering) */}
                                <label
                                    htmlFor="reg-camera-input"
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.97] ${
                                        isCompressing ? 'pointer-events-none opacity-50' : ''
                                    }`}
                                >
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                        />
                                        <circle cx="12" cy="13" r="3" />
                                    </svg>
                                    📸 Photo
                                    {photos.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">{photos.length}</span>}
                                </label>
                                {/* Gallery button — secondary (uses <label> for reliable mobile triggering) */}
                                <label
                                    htmlFor="reg-gallery-input"
                                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 text-primary transition active:scale-[0.97] dark:border-primary/40 dark:bg-primary/10 ${
                                        isCompressing ? 'pointer-events-none opacity-50' : ''
                                    }`}
                                    title="Sélectionner depuis la galerie"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                    <span className="text-xs font-bold">Galerie</span>
                                </label>
                            </div>
                            {/* Rapid camera mode toggle */}
                            <button
                                onClick={() => {
                                    const newMode = !rapidCameraMode;
                                    setRapidCameraMode(newMode);
                                    if (newMode) {
                                        // Start rapid mode by opening camera immediately
                                        setTimeout(() => cameraInputRef.current?.click(), 200);
                                    }
                                }}
                                className={`mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                                    rapidCameraMode ? 'border-primary bg-primary/10 text-primary' : 'border-dashed border-slate-300 text-slate-500 dark:border-slate-600'
                                }`}
                            >
                                {rapidCameraMode ? (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                        </span>
                                        📸 Mode rafale actif — Appuyez pour arrêter
                                    </>
                                ) : (
                                    <>📸 Activer le mode rafale (photos en série)</>
                                )}
                            </button>
                            <button
                                onClick={goNext}
                                className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200"
                            >
                                {photoPreviews.length > 0 ? `Continuer avec ${photoPreviews.length} photo${photoPreviews.length > 1 ? 's' : ''} →` : 'Passer cette étape →'}
                            </button>
                        </div>

                        {/* PhotoAnnotator modal */}
                        {annotatingIndex !== null && photoPreviews[annotatingIndex] && (
                            <PhotoAnnotator
                                imageSrc={photoPreviews[annotatingIndex]}
                                onClose={() => setAnnotatingIndex(null)}
                                onSave={(annotatedFile) => {
                                    // Replace the original photo with the annotated version
                                    const idx = annotatingIndex;
                                    setPhotos((prev) => {
                                        const updated = [...prev];
                                        updated[idx] = annotatedFile;
                                        return updated;
                                    });
                                    // Update preview
                                    const newPreviewUrl = URL.createObjectURL(annotatedFile);
                                    setPhotoPreviews((prev) => {
                                        const updated = [...prev];
                                        // Revoke old preview URL to free memory
                                        if (updated[idx]) URL.revokeObjectURL(updated[idx]);
                                        updated[idx] = newPreviewUrl;
                                        return updated;
                                    });
                                    // Also update in IndexedDB
                                    idbSavePhoto(annotatedFile, idbSessionKey).catch((err) =>
                                        console.warn('[IDB] Failed to save annotated photo:', err)
                                    );
                                    setAnnotatingIndex(null);
                                }}
                            />
                        )}
                    </div>
                )}

                {/* ═══ STEP 3 — Article Counter ═══ */}
                {step === 3 && (
                    <div className="space-y-3">
                        <div className="sticky top-[88px] z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 py-2 backdrop-blur dark:bg-[#0e1726]/95">
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total pièces</span>
                            <span className="rounded-full bg-primary px-4 py-1.5 text-base font-black text-white">{totalArticles}</span>
                        </div>

                        {articles.map((art) => (
                            <div key={art.name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{CATEGORY_ICONS[art.name] || '📦'}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-white">{art.label}</span>
                                        {!isDefaultCategory(art.name) && (
                                            <button onClick={() => removeCustomArticle(art.name)} className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-0">
                                        <button
                                            onClick={() => updateCount(art.name, -1)}
                                            className="flex h-10 w-10 items-center justify-center rounded-l-xl bg-slate-100 text-lg font-bold text-slate-500 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                        >
                                            −
                                        </button>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={art.quantity}
                                            onChange={(e) => setCount(art.name, parseInt(e.target.value) || 0)}
                                            className="h-10 w-14 border-x border-slate-200 bg-white text-center text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                        <button
                                            onClick={() => updateCount(art.name, 1)}
                                            className="flex h-10 w-10 items-center justify-center rounded-r-xl bg-primary/10 text-lg font-bold text-primary active:bg-primary/20"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                {art.subLabel1 && art.quantity > 0 && (
                                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                                        <span className="text-xs text-slate-500">dont {art.subLabel1}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => updateSubCount(art.name, (art.subCount1 || 0) - 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-400 shadow-sm active:bg-slate-100 dark:bg-slate-700"
                                            >
                                                −
                                            </button>
                                            <span className="w-8 text-center text-xs font-bold text-slate-700 dark:text-white">{art.subCount1 || 0}</span>
                                            <button
                                                onClick={() => updateSubCount(art.name, (art.subCount1 || 0) + 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary active:bg-primary/20"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Add custom article */}
                        <button
                            onClick={() => setShowCustomModal(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-primary/30 hover:text-primary active:scale-[0.98] dark:border-slate-600"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Ajouter un article personnalisé
                        </button>

                        {showCustomModal && (
                            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowCustomModal(false)}>
                                <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-[#1a2234] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                                    <h3 className="mb-4 text-base font-bold text-slate-800 dark:text-white">Ajouter un article</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-500">Nom de l&apos;article</label>
                                            <input
                                                type="text"
                                                value={customName}
                                                onChange={(e) => setCustomName(e.target.value)}
                                                placeholder="Ex: Rideau double, Nappe..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-500">Quantité</label>
                                            <div className="flex items-center gap-0">
                                                <button
                                                    onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                                                    className="flex h-10 w-10 items-center justify-center rounded-l-xl bg-slate-100 text-lg font-bold text-slate-500 dark:bg-slate-800"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={customQty}
                                                    onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-10 w-16 border-x border-slate-200 bg-white text-center text-sm font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                                <button
                                                    onClick={() => setCustomQty(customQty + 1)}
                                                    className="flex h-10 w-10 items-center justify-center rounded-r-xl bg-primary/10 text-lg font-bold text-primary active:bg-primary/20"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => setShowCustomModal(false)}
                                            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                                        >
                                            Annuler
                                        </button>
                                        <button onClick={addCustomArticle} disabled={!customName.trim()} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40">
                                            Ajouter
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                         <button
                             onClick={goNext}
                             disabled={totalArticles === 0}
                             className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
                         >
                             Continuer → ({totalArticles} pièces)
                         </button>
                    </div>
                )}

                {/* ═══ STEP 4 — Bags ═══ */}
                {step === 4 && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Le client a-t-il apporté des sacs ?</p>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🛍️</span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-white">Nombre de sacs</span>
                            </div>
                            <div className="flex items-center gap-0">
                                <button
                                    onClick={() => setBagCount(Math.max(0, bagCount - 1))}
                                    className="flex h-10 w-10 items-center justify-center rounded-l-xl bg-slate-100 text-lg font-bold text-slate-500 active:bg-slate-200 dark:bg-slate-800"
                                >
                                    −
                                </button>
                                <span className="flex h-10 w-14 items-center justify-center border-x border-slate-200 bg-white text-center text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                                    {bagCount}
                                </span>
                                <button
                                    onClick={() => setBagCount(bagCount + 1)}
                                    className="flex h-10 w-10 items-center justify-center rounded-r-xl bg-primary/10 text-lg font-bold text-primary active:bg-primary/20"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {bagCount > 0 && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <label
                                        htmlFor="reg-bag-camera"
                                        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-4 text-xs font-semibold text-slate-500 active:scale-[0.98]"
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                            />
                                            <circle cx="12" cy="13" r="3" />
                                        </svg>
                                        Caméra
                                    </label>
                                    <label
                                        htmlFor="reg-bag-gallery"
                                        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-4 text-xs font-semibold text-slate-500 active:scale-[0.98]"
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                        </svg>
                                        Galerie
                                    </label>
                                </div>
                                <input id="reg-bag-camera" ref={bagCameraRef} type="file" accept="image/*" capture="environment" onChange={handleBagPhotoCapture} className="hidden" />
                                <input id="reg-bag-gallery" ref={bagGalleryRef} type="file" accept="image/*" multiple onChange={handleBagPhotoCapture} className="hidden" />

                                {bagPreviews.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {bagPreviews.map((src, i) => (
                                            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={src} alt={`Sac ${i + 1}`} className="h-full w-full object-cover" />
                                                <button
                                                    onClick={() => removeBagPhoto(i)}
                                                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                                                >
                                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <textarea
                                    value={bagNotes}
                                    onChange={(e) => setBagNotes(e.target.value)}
                                    placeholder="Notes sur les sacs (optionnel)..."
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </>
                        )}

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Notes générales</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observations, défauts, instructions spéciales..."
                                rows={3}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>

                        <button onClick={goNext} className="mt-2 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98]">
                            Voir le résumé →
                        </button>
                    </div>
                )}

                {/* ═══ STEP 5 — Summary ═══ */}
                {step === 5 && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Client</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">{selectedClient?.name}</div>
                            {selectedOrder && (
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                    <span className="font-semibold">{selectedOrder.orderId}</span>
                                    <span>·</span>
                                    <span>Op. {operationIndex + 1}</span>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Articles</span>
                                <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-white">{totalArticles}</span>
                            </div>
                            <div className="space-y-1.5">
                                {articles
                                    .filter((a) => a.quantity > 0)
                                    .map((a) => (
                                        <div key={a.name} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">
                                                {CATEGORY_ICONS[a.name] || '📦'} {a.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-white">{a.quantity}</span>
                                                {a.subCount1 && a.subCount1 > 0 && (
                                                    <span className="text-[10px] text-slate-400">
                                                        ({a.subCount1} {a.subLabel1})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {bagCount > 0 && (
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-sm">
                                    <span>🛍️</span>
                                    <span className="font-semibold text-slate-700 dark:text-white">
                                        {bagCount} sac{bagCount > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        )}
                        {photos.length > 0 && (
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-sm">
                                    <span>📷</span>
                                    <span className="text-slate-600 dark:text-slate-300">
                                        {photos.length} photo{photos.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Photo count mismatch warning */}
                        {(photos.length + existingPhotos.length) !== totalArticles && totalArticles > 0 && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                                <div className="flex items-start gap-2">
                                    <span className="mt-0.5 text-lg">⚠️</span>
                                    <div>
                                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Nombre de photos incorrect</p>
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                            Vous avez <b>{photos.length + existingPhotos.length} photo{(photos.length + existingPhotos.length) > 1 ? 's' : ''}</b> pour <b>{totalArticles} article{totalArticles > 1 ? 's' : ''}</b>.
                                            Le nombre de photos devrait correspondre au nombre total d&apos;articles.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Résumé formaté</div>
                            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">{summaryText}</pre>
                        </div>

                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(summaryText)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700 transition active:scale-[0.98] dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Partager via WhatsApp
                        </a>

                        {!isCompleted ? (
                            <button
                                onClick={handleComplete}
                                disabled={isSaving}
                                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-60"
                            >
                                {existingRegId ? '✓ Mettre à jour l\'enregistrement' : '✓ Confirmer l\'enregistrement'}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
                                    <svg className="mx-auto mb-2 h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <div className="text-sm font-bold text-green-700 dark:text-green-300">Enregistrement complété !</div>
                                    <div className="mt-0.5 text-xs text-green-600/70">{registrationId}</div>
                                </div>
                                <button
                                    onClick={() => router.push(returnTo || '/apps/registrations')}
                                    className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 active:scale-[0.98] dark:border-slate-700 dark:text-slate-300"
                                >
                                    {returnTo ? 'Retour' : 'Retour à la liste'}
                                </button>
                                <button
                                    onClick={() => {
                                        idbClearPhotos(idbSessionKey).catch(() => {});
                                        setStep(0);
                                        setRegistrationId(null);
                                        setIsCompleted(false);
                                        setSelectedClient(null);
                                        setSelectedOrder(null);
                                        setOperationIndex(0);
                                        setClientSearch('');
                                        setPhotos([]);
                                        setPhotoPreviews([]);
                                        setArticles(ARTICLE_CATEGORIES.map((c) => ({ ...c })));
                                        setBagCount(0);
                                        setBagPhotos([]);
                                        setBagPreviews([]);
                                        setBagNotes('');
                                        setNotes('');
                                    }}
                                    className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:scale-[0.98]"
                                >
                                    Nouvel enregistrement
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isSaving && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur dark:bg-[#0e1726]/95">
                    <div className="mx-auto w-full max-w-sm px-6">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                <div className="border-3 h-8 w-8 animate-spin rounded-full border-primary/30 border-t-primary" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Enregistrement en cours</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {selectedClient?.name} — {totalArticles} pièces
                            </p>
                        </div>

                        {/* Step indicators */}
                        <div className="space-y-3">
                            {[
                                { key: 'create', label: "Création de l'enregistrement", icon: '📝' },
                                { key: 'articles', label: 'Sauvegarde des articles', icon: '👕' },
                                {
                                    key: 'photos',
                                    label: `Envoi des photos${photos.length > 0 ? ` (${uploadProgress.uploaded}/${uploadProgress.total})` : ''}`,
                                    icon: '📷',
                                },
                                { key: 'bags', label: 'Photos des sacs', icon: '🛍️' },
                                { key: 'complete', label: 'Finalisation', icon: '✅' },
                            ].map((s, i) => {
                                // Determine step state from saveStep string
                                let stepState: 'pending' | 'active' | 'done' = 'pending';
                                const currentStepText = saveStep;
                                if (currentStepText.includes('Création')) {
                                    if (i === 0) stepState = 'active';
                                } else if (currentStepText.includes('articles')) {
                                    if (i < 1) stepState = 'done';
                                    else if (i === 1) stepState = 'active';
                                } else if (currentStepText.includes('photos') && !currentStepText.includes('sacs')) {
                                    if (i < 2) stepState = 'done';
                                    else if (i === 2) stepState = 'active';
                                } else if (currentStepText.includes('sacs')) {
                                    if (i < 3) stepState = 'done';
                                    else if (i === 3) stepState = 'active';
                                } else if (currentStepText.includes('Finalisation')) {
                                    if (i < 4) stepState = 'done';
                                    else if (i === 4) stepState = 'active';
                                }
                                // Skip photo steps if no photos
                                if (i === 2 && photos.length === 0) stepState = stepState === 'pending' ? 'pending' : 'done';
                                if (i === 3 && bagPhotos.length === 0) stepState = stepState === 'pending' ? 'pending' : 'done';

                                return (
                                    <div
                                        key={s.key}
                                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                                            stepState === 'active'
                                                ? 'border-primary/30 bg-primary/5 shadow-sm'
                                                : stepState === 'done'
                                                ? 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10'
                                                : 'border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-800/20'
                                        }`}
                                    >
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all ${
                                                stepState === 'active' ? 'bg-primary text-white' : stepState === 'done' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                                            }`}
                                        >
                                            {stepState === 'done' ? (
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : stepState === 'active' ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            ) : (
                                                <span className="text-xs">{s.icon}</span>
                                            )}
                                        </div>
                                        <span
                                            className={`text-sm font-medium ${
                                                stepState === 'active' ? 'text-primary' : stepState === 'done' ? 'text-green-700 dark:text-green-400' : 'text-slate-400'
                                            }`}
                                        >
                                            {s.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Upload progress bar */}
                        {isUploading && uploadProgress.total > 0 && (
                            <div className="mt-4">
                                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%` }} />
                                </div>
                                <p className="mt-1 text-center text-xs text-slate-400">
                                    {uploadProgress.uploaded}/{uploadProgress.total} photos envoyées
                                </p>
                            </div>
                        )}
                    </div>

            </div>
            )}
        </div>
    );
};

export default RegistrationFlow;
