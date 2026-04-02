'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArticleRegistration, RegistrationPhoto, registrationsApi } from '@/lib/api/article-registrations';
import Swal from 'sweetalert2';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');
const PHOTOS_PER_PAGE = 30;

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: 'Brouillon', bg: 'bg-amber-100', text: 'text-amber-700' },
    completed: { label: 'Complété', bg: 'bg-green-100', text: 'text-green-700' },
    validated: { label: 'Validé', bg: 'bg-blue-100', text: 'text-blue-700' },
};

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

/* ─── Robust Image Matching Engine ─── */

/* Perceptual hash + dominant colors + structure — designed for garment re-identification */

/**
 * Convert a photo URL to a same-origin proxied URL.
 * /uploads/xxx -> /api/proxy-image?url=/uploads/xxx
 * http://localhost:3001/uploads/xxx -> /api/proxy-image?url=/uploads/xxx
 * blob: and data: URLs are returned as-is.
 */
function toSameOriginUrl(src: string): string {
    if (src.startsWith('blob:') || src.startsWith('data:')) return src;
    // Extract the /uploads/... path from full URL or relative path
    let uploadsPath = src;
    const idx = src.indexOf('/uploads/');
    if (idx !== -1) uploadsPath = src.slice(idx);
    return `/api/proxy-image?url=${encodeURIComponent(uploadsPath)}`;
}

/** Load image into a canvas at target resolution.
 *  Uses same-origin proxy to avoid CORS/canvas-tainting issues entirely.
 */
function loadImageToCanvas(src: string, size = 128): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            c.getContext('2d')!.drawImage(img, 0, 0, size, size);
            resolve(c);
        };
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        // Use same-origin proxy for cross-origin URLs
        img.src = toSameOriginUrl(src);
    });
}

/** Get pixel data as flat array of {r,g,b} from a canvas */
function getPixels(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/**
 * Perceptual Hash (pHash) — 64-bit hash via DCT.
 * Extremely robust to scaling, brightness changes, minor rotations.
 * Returns an array of 64 bits (0/1).
 */
function computePHash(canvas: HTMLCanvasElement): number[] {
    // Resize to 32×32 grayscale
    const small = document.createElement('canvas');
    small.width = 32;
    small.height = 32;
    small.getContext('2d')!.drawImage(canvas, 0, 0, 32, 32);
    const data = getPixels(small);
    const gray: number[][] = [];
    for (let y = 0; y < 32; y++) {
        gray[y] = [];
        for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4;
            gray[y][x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
    }

    // Compute DCT (Discrete Cosine Transform) on 32×32 → take top-left 8×8
    const dct: number[][] = [];
    for (let u = 0; u < 8; u++) {
        dct[u] = [];
        for (let v = 0; v < 8; v++) {
            let sum = 0;
            for (let y = 0; y < 32; y++) {
                for (let x = 0; x < 32; x++) {
                    sum += gray[y][x] * Math.cos((Math.PI * (2 * x + 1) * u) / 64) * Math.cos((Math.PI * (2 * y + 1) * v) / 64);
                }
            }
            dct[u][v] = sum;
        }
    }

    // Compute median of the 8×8 DCT (excluding DC component [0,0])
    const vals: number[] = [];
    for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) if (u !== 0 || v !== 0) vals.push(dct[u][v]);
    vals.sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];

    // Generate 64-bit hash: 1 if above median, 0 if below
    const hash: number[] = [];
    for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) hash.push(dct[u][v] > median ? 1 : 0);

    return hash;
}

/** Hamming distance between two pHash arrays (0 = identical, 64 = opposite) */
function hammingDist(a: number[], b: number[]): number {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
}

/**
 * Extract top-K dominant colors using a simple median-cut-like approach.
 * Returns array of K [r,g,b] centroids sorted by frequency.
 */
function dominantColors(canvas: HTMLCanvasElement, K = 5): number[][] {
    const data = getPixels(canvas);
    const W = canvas.width,
        H = canvas.height;
    const pixels: number[][] = [];

    // Sample every 2nd pixel for speed, skip near-black and near-white (background)
    for (let i = 0; i < W * H; i += 2) {
        const r = data[i * 4],
            g = data[i * 4 + 1],
            b = data[i * 4 + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 20 && brightness < 240) {
            // skip bg
            pixels.push([r, g, b]);
        }
    }
    if (pixels.length === 0) return [[128, 128, 128]];

    // Simple k-means (3 iterations is enough for rough clustering)
    let centroids = pixels.slice(0, K).map((p) => [...p]);
    if (centroids.length < K) {
        while (centroids.length < K) centroids.push([...centroids[0]]);
    }

    const counts = new Array(K).fill(0);

    for (let iter = 0; iter < 4; iter++) {
        const sums = centroids.map(() => [0, 0, 0]);
        counts.fill(0);

        for (const px of pixels) {
            let bestK = 0,
                bestDist = Infinity;
            for (let k = 0; k < K; k++) {
                const dr = px[0] - centroids[k][0];
                const dg = px[1] - centroids[k][1];
                const db = px[2] - centroids[k][2];
                const dist = dr * dr + dg * dg + db * db;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestK = k;
                }
            }
            sums[bestK][0] += px[0];
            sums[bestK][1] += px[1];
            sums[bestK][2] += px[2];
            counts[bestK]++;
        }

        for (let k = 0; k < K; k++) {
            if (counts[k] > 0) {
                centroids[k] = [sums[k][0] / counts[k], sums[k][1] / counts[k], sums[k][2] / counts[k]];
            }
        }
    }

    // Sort by count (most frequent first) and return with count info
    const indexed = centroids.map((c, i) => ({ c, count: counts[i] }));
    indexed.sort((a, b) => b.count - a.count);
    return indexed.map((x) => x.c);
}

/** Color distance in perceptual space (simple approximation) */
function colorDist(a: number[], b: number[]): number {
    // Weighted Euclidean — approximate perceptual distance
    const rmean = (a[0] + b[0]) / 2;
    const dr = a[0] - b[0],
        dg = a[1] - b[1],
        db = a[2] - b[2];
    return Math.sqrt((2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db);
}

/**
 * Compare dominant color palettes.
 * For each color in A, find the closest color in B. Average the distances.
 * Score: 0 (completely different) to 1 (identical palette).
 */
function paletteSimScore(a: number[][], b: number[][]): number {
    if (a.length === 0 || b.length === 0) return 0;
    let totalDist = 0;
    const maxDist = 441.67; // max perceptual distance (black to white)

    // A→B matching
    for (const ca of a) {
        let minD = Infinity;
        for (const cb of b) minD = Math.min(minD, colorDist(ca, cb));
        totalDist += minD / maxDist;
    }
    // B→A matching (symmetry)
    for (const cb of b) {
        let minD = Infinity;
        for (const ca of a) minD = Math.min(minD, colorDist(ca, cb));
        totalDist += minD / maxDist;
    }

    return Math.max(0, 1 - totalDist / (a.length + b.length));
}

/**
 * Edge density map — 4×4 grid of edge intensity.
 * Captures structural layout (where are the strong edges/contours).
 */
function edgeDensityMap(canvas: HTMLCanvasElement): number[] {
    const data = getPixels(canvas);
    const W = canvas.width,
        H = canvas.height;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

    const map: number[] = new Array(16).fill(0);
    const cellW = Math.floor(W / 4),
        cellH = Math.floor(H / 4);

    for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 4; gx++) {
            let edgeSum = 0,
                px = 0;
            for (let y = gy * cellH; y < (gy + 1) * cellH && y < H - 1; y++) {
                for (let x = gx * cellW; x < (gx + 1) * cellW && x < W - 1; x++) {
                    const gH = Math.abs(gray[y * W + x] - gray[y * W + x + 1]);
                    const gV = Math.abs(gray[y * W + x] - gray[(y + 1) * W + x]);
                    edgeSum += Math.sqrt(gH * gH + gV * gV);
                    px++;
                }
            }
            map[gy * 4 + gx] = px > 0 ? edgeSum / px / 255 : 0;
        }
    }
    return map;
}

/** Cosine similarity between two vectors */
function cosSim(a: number[], b: number[]): number {
    let dot = 0,
        nA = 0,
        nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        nA += a[i] * a[i];
        nB += b[i] * b[i];
    }
    return nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
}

/**
 * Color histogram in quantized RGB space (6×6×6 = 216 bins).
 * More discriminative than HSV for cross-photo matching.
 */
function colorHistogram(canvas: HTMLCanvasElement): number[] {
    const data = getPixels(canvas);
    const W = canvas.width,
        H = canvas.height;
    const hist = new Array(216).fill(0);
    let total = 0;
    for (let i = 0; i < W * H; i++) {
        const r = Math.min(Math.floor(data[i * 4] / 43), 5);
        const g = Math.min(Math.floor(data[i * 4 + 1] / 43), 5);
        const b = Math.min(Math.floor(data[i * 4 + 2] / 43), 5);
        hist[r * 36 + g * 6 + b]++;
        total++;
    }
    if (total > 0) for (let i = 0; i < 216; i++) hist[i] /= total;
    return hist;
}

/** Chi-squared distance between two histograms (better than cosine for histograms) */
function chiSquaredSim(a: number[], b: number[]): number {
    let chi2 = 0;
    for (let i = 0; i < a.length; i++) {
        const sum = a[i] + b[i];
        if (sum > 0) chi2 += (a[i] - b[i]) ** 2 / sum;
    }
    // Convert distance to similarity (0 to 1)
    return Math.exp(-chi2 * 2);
}

/** Full image descriptor: multiple complementary features */
interface ImageDescriptor {
    pHash: number[];
    dominantColors: number[][];
    edgeMap: number[];
    colorHist: number[];
}

async function extractFullDescriptor(src: string): Promise<ImageDescriptor> {
    const canvas = await loadImageToCanvas(src, 128);
    return {
        pHash: computePHash(canvas),
        dominantColors: dominantColors(canvas, 5),
        edgeMap: edgeDensityMap(canvas),
        colorHist: colorHistogram(canvas),
    };
}

/**
 * Match thresholds — be honest about algorithm capability.
 * This is a client-side pixel comparison (no AI model), so we cap displayed
 * confidence at 75% max. Anything above MATCH_THRESHOLD is considered a
 * potential match. On retry we subtract RETRY_REDUCTION.
 */
const MATCH_THRESHOLD = 0.7; // raw score ≥ 0.70 → shown as a match
const RETRY_REDUCTION = 0.2; // second pass: threshold drops by 20 points
const MAX_DISPLAY_PCT = 100; // display actual percentage

/**
 * Compare two image descriptors with weighted multi-feature scoring.
 * Returns raw 0–1 score.
 */
function compareDescriptors(a: ImageDescriptor, b: ImageDescriptor): number {
    const hashDist = hammingDist(a.pHash, b.pHash);
    const hashSim = 1 - hashDist / 64;
    const paletteSim = paletteSimScore(a.dominantColors, b.dominantColors);
    const edgeSim = cosSim(a.edgeMap, b.edgeMap);
    const histSim = chiSquaredSim(a.colorHist, b.colorHist);

    return 0.3 * hashSim + 0.3 * paletteSim + 0.25 * histSim + 0.15 * edgeSim;
}

/** Convert raw score (0–1) to a display percentage capped at MAX_DISPLAY_PCT */
function toDisplayPct(raw: number): number {
    return Math.round(Math.min(raw * 100, MAX_DISPLAY_PCT));
}

interface Props {
    id: string;
}

const RegistrationDetail = ({ id }: Props) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [lightboxSource, setLightboxSource] = useState<'articles' | 'bags'>('articles');
    const [photoPage, setPhotoPage] = useState(1);

    // Draft editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editArticles, setEditArticles] = useState<any[]>([]);
    const [editNotes, setEditNotes] = useState('');
    const [editBagCount, setEditBagCount] = useState(0);
    const [editBagNotes, setEditBagNotes] = useState('');
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isUploadingMore, setIsUploadingMore] = useState(false);
    const [isCompletingDraft, setIsCompletingDraft] = useState(false);
    const addPhotosRef = useRef<HTMLInputElement>(null);
    const addBagPhotosRef = useRef<HTMLInputElement>(null);

    // Compare / image search
    const cameraRef = useRef<HTMLInputElement>(null);
    const [showCompareBar, setShowCompareBar] = useState(false);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<{ idx: number; score: number; photo: RegistrationPhoto }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
    const [tappedPhotoIdx, setTappedPhotoIdx] = useState<number | null>(null); // mobile: tap to reveal status buttons
    const [searchPass, setSearchPass] = useState<1 | 2 | 'none'>(1); // 1 = first attempt, 2 = retried -20%, 'none' = no match

    // Precomputed descriptors for registration photos
    const descriptorsRef = useRef<Map<string, ImageDescriptor>>(new Map());

    const {
        data: reg,
        isLoading,
        error,
    } = useQuery<ArticleRegistration>({
        queryKey: ['registration', id],
        queryFn: () => registrationsApi.get(id),
        enabled: !!id,
    });

    const verifyMutation = useMutation({
        mutationFn: (data: { articleIndex: number; categoryName: string; status: string; matchedPhotoUrl?: string }) => registrationsApi.verifyArticle(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
        },
    });

    const clearVerificationsMutation = useMutation({
        mutationFn: () => registrationsApi.clearVerifications(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
        },
    });

    // ── Draft editing helpers ─────────────────────────────
    const startEditing = () => {
        if (!reg) return;
        setEditArticles(reg.articles.map((a) => ({ ...a })));
        setEditNotes(reg.notes || '');
        setEditBagCount(reg.bags?.count || 0);
        setEditBagNotes(reg.bags?.notes || '');
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditArticles([]);
    };

    const handleSaveDraft = async () => {
        setIsSavingDraft(true);
        try {
            await registrationsApi.update(id, {
                articles: editArticles,
                bags: { count: editBagCount, notes: editBagNotes, photoUrls: [] },
                notes: editNotes,
            });
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
            setIsEditing(false);
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 1500 }).fire({
                icon: 'success',
                title: 'Brouillon mis à jour',
            });
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || 'Erreur lors de la sauvegarde', 'error');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleUploadMorePhotos = async (e: React.ChangeEvent<HTMLInputElement>, type: 'articles' | 'bags' = 'articles') => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = '';
        setIsUploadingMore(true);
        try {
            await registrationsApi.uploadPhotos(id, files, type);
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 1500 }).fire({
                icon: 'success',
                title: `${files.length} photo(s) ajoutée(s)`,
            });
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || "Erreur lors de l'envoi", 'error');
        } finally {
            setIsUploadingMore(false);
        }
    };

    const handleDeletePhoto = async (photoUrl: string) => {
        const confirm = await Swal.fire({
            title: 'Supprimer cette photo ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ef4444',
        });
        if (!confirm.isConfirmed) return;
        try {
            await registrationsApi.removePhoto(id, photoUrl);
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
        } catch (err: any) {
            Swal.fire('Erreur', 'Impossible de supprimer', 'error');
        }
    };

    const handleCompleteDraft = async () => {
        if (!reg || reg.totalArticles === 0) {
            Swal.fire('Attention', 'Veuillez ajouter au moins un article avant de compléter', 'warning');
            return;
        }
        const confirm = await Swal.fire({
            title: "Compléter l'enregistrement ?",
            html: `<b>${reg.totalArticles} pièces</b> pour <b>${reg.clientName}</b>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Compléter',
            cancelButtonText: 'Annuler',
        });
        if (!confirm.isConfirmed) return;
        setIsCompletingDraft(true);
        try {
            await registrationsApi.complete(id);
            queryClient.invalidateQueries({ queryKey: ['registration', id] });
            queryClient.invalidateQueries({ queryKey: ['operations'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            Swal.fire({ icon: 'success', title: 'Enregistrement complété !', timer: 2000, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || 'Erreur lors de la complétion', 'error');
        } finally {
            setIsCompletingDraft(false);
        }
    };

    const editTotalArticles = useMemo(() => editArticles.reduce((sum: number, a: any) => sum + a.quantity, 0), [editArticles]);

    const handleClearAllVerifications = async () => {
        const result = await Swal.fire({
            title: 'Réinitialiser toutes les vérifications ?',
            text: 'Tous les statuts seront remis à zéro.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Réinitialiser',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ef4444',
        });
        if (result.isConfirmed) {
            try {
                await clearVerificationsMutation.mutateAsync();
                Swal.fire({ title: 'Réinitialisé', icon: 'success', timer: 1200, showConfirmButton: false });
            } catch {
                Swal.fire('Erreur', 'Impossible de réinitialiser', 'error');
            }
        }
    };

    const articlePhotos = useMemo(() => reg?.photos?.filter((p) => p.type === 'articles') || [], [reg]);
    const bagPhotos = useMemo(() => reg?.photos?.filter((p) => p.type === 'bags') || [], [reg]);
    const totalPhotoPages = Math.ceil(articlePhotos.length / PHOTOS_PER_PAGE);
    const paginatedPhotos = articlePhotos.slice((photoPage - 1) * PHOTOS_PER_PAGE, photoPage * PHOTOS_PER_PAGE);
    const currentLightboxPhotos = lightboxSource === 'articles' ? articlePhotos : bagPhotos;

    // Flat verification items
    const verificationItems = useMemo(() => {
        if (!reg?.articles) return [];
        const items: { categoryName: string; categoryLabel: string; itemIndex: number; key: string }[] = [];
        for (const article of reg.articles) {
            if (article.quantity <= 0) continue;
            for (let i = 0; i < article.quantity; i++) {
                items.push({
                    categoryName: article.name,
                    categoryLabel: article.label,
                    itemIndex: i,
                    key: `${i}-${article.name}`,
                });
            }
        }
        return items;
    }, [reg]);

    const verificationMap = useMemo(() => {
        const map = new Map<string, any>();
        if (reg?.verifications) {
            for (const v of reg.verifications as any[]) {
                map.set(`${v.articleIndex}-${v.categoryName}`, v);
            }
        }
        return map;
    }, [reg]);

    // Map photo URLs → verification info (to show badge + allow re-verification)
    const photoVerificationMap = useMemo(() => {
        const map = new Map<string, { status: string; articleIndex: number; categoryName: string }>();
        if (reg?.verifications) {
            for (const v of reg.verifications as any[]) {
                if (v.matchedPhotoUrl) {
                    map.set(v.matchedPhotoUrl, {
                        status: v.status,
                        articleIndex: v.articleIndex,
                        categoryName: v.categoryName,
                    });
                }
            }
        }
        return map;
    }, [reg]);

    const stats = useMemo(() => {
        const total = verificationItems.length;
        if (total === 0) return null;
        let found = 0,
            notFound = 0,
            badQuality = 0;
        for (const item of verificationItems) {
            const v = verificationMap.get(item.key);
            if (v?.status === 'found') found++;
            else if (v?.status === 'not_found') notFound++;
            else if (v?.status === 'returned_bad_quality') badQuality++;
        }
        return { total, found, notFound, badQuality, pending: total - found - notFound - badQuality };
    }, [verificationItems, verificationMap]);

    const nextPendingItem = useMemo(() => {
        return verificationItems.find((item) => {
            const v = verificationMap.get(item.key);
            return !v || v.status === 'pending';
        });
    }, [verificationItems, verificationMap]);

    const handleVerify = async (articleIndex: number, categoryName: string, status: string, matchedPhotoUrl?: string) => {
        try {
            await verifyMutation.mutateAsync({ articleIndex, categoryName, status, matchedPhotoUrl });
        } catch {
            Swal.fire('Erreur', 'Impossible de mettre à jour', 'error');
        }
    };

    const handlePhotoVerifyAction = (photoUrl: string, status: string) => {
        // If this photo is already linked to an article verification, update that one
        const existing = photoVerificationMap.get(photoUrl);
        if (existing) {
            handleVerify(existing.articleIndex, existing.categoryName, status, photoUrl);
            return;
        }
        // Otherwise assign to the next pending article
        if (nextPendingItem) {
            handleVerify(nextPendingItem.itemIndex, nextPendingItem.categoryName, status, photoUrl);
        }
    };

    // Precompute descriptors for all article photos (background)
    const [descriptorsReady, setDescriptorsReady] = useState(0);
    useEffect(() => {
        if (!articlePhotos.length) return;
        let cancelled = false;
        const compute = async () => {
            let computed = 0;
            for (let i = 0; i < articlePhotos.length; i++) {
                if (cancelled) break;
                const photo = articlePhotos[i];
                if (descriptorsRef.current.has(photo.url)) {
                    computed++;
                    continue;
                }
                try {
                    const desc = await extractFullDescriptor(`${API_URL}${photo.url}`);
                    if (!cancelled) {
                        descriptorsRef.current.set(photo.url, desc);
                        computed++;
                        setDescriptorsReady(computed);
                    }
                } catch (err) {
                    console.warn(`[ImageSearch] Failed to compute descriptor for photo ${i}:`, photo.url, err);
                }
                // Small delay to avoid blocking UI
                if (i % 3 === 2) await new Promise((r) => setTimeout(r, 50));
            }
            if (!cancelled) setDescriptorsReady(computed);
        };
        compute();
        return () => {
            cancelled = true;
        };
    }, [articlePhotos]);

    // Camera capture → run image search with two-pass threshold
    const handleCameraCapture = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            if (capturedPreview) URL.revokeObjectURL(capturedPreview);
            const objectUrl = URL.createObjectURL(files[0]);
            setCapturedPreview(objectUrl);
            setShowCompareBar(true);
            setSearchResults([]);
            setSelectedMatch(null);
            setSearchPass(1);
            setIsSearching(true);
            e.target.value = '';

            try {
                const queryDesc = await extractFullDescriptor(objectUrl);

                const allResults: { idx: number; score: number; photo: RegistrationPhoto }[] = [];
                let descriptorsAvailable = 0;
                articlePhotos.forEach((photo, idx) => {
                    const storedDesc = descriptorsRef.current.get(photo.url);
                    if (storedDesc) {
                        descriptorsAvailable++;
                        const score = compareDescriptors(queryDesc, storedDesc);
                        allResults.push({ idx, score, photo });
                    } else {
                        allResults.push({ idx, score: 0, photo });
                    }
                });
                allResults.sort((a, b) => b.score - a.score);

                console.log(`[ImageSearch] Query complete: ${descriptorsAvailable}/${articlePhotos.length} descriptors available, top score: ${allResults[0]?.score.toFixed(3)}`);

                const topScore = allResults.length > 0 ? allResults[0].score : 0;

                // Pass 1: check against normal threshold
                if (topScore >= MATCH_THRESHOLD) {
                    setSearchPass(1);
                    setSearchResults(allResults.filter((r) => r.score >= MATCH_THRESHOLD * 0.7).slice(0, 12));
                }
                // Pass 2: retry with reduced threshold (-20%)
                else if (topScore >= MATCH_THRESHOLD - RETRY_REDUCTION) {
                    setSearchPass(2);
                    setSearchResults(allResults.slice(0, 8));
                }
                // No match at all
                else {
                    setSearchPass('none');
                    setSearchResults(allResults.slice(0, 6)); // still show top 6 for manual fallback
                }
            } catch {
                setSearchPass('none');
                setSearchResults(articlePhotos.map((photo, idx) => ({ idx, score: 0, photo })).slice(0, 6));
            }
            setIsSearching(false);
        },
        [capturedPreview, articlePhotos]
    );

    const startCompare = () => {
        setShowCompareBar(true);
    };
    const closeCompare = () => {
        if (capturedPreview) URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
        setShowCompareBar(false);
        setSearchResults([]);
        setSelectedMatch(null);
        setSearchPass(1);
    };

    const handleMatchAction = (photo: RegistrationPhoto, status: string) => {
        handlePhotoVerifyAction(photo.url, status);
        setSelectedMatch(null);
    };

    const openLightbox = (source: 'articles' | 'bags', idx: number) => {
        setLightboxSource(source);
        setLightboxIdx(idx);
    };

    const PhotoStatusBadge = ({ url }: { url: string }) => {
        const entry = photoVerificationMap.get(url);
        if (!entry) return null;
        const status = entry.status;
        const config: Record<string, { bg: string; icon: React.ReactNode }> = {
            found: {
                bg: 'bg-green-500',
                icon: (
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                ),
            },
            not_found: {
                bg: 'bg-red-500',
                icon: (
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ),
            },
            returned_bad_quality: {
                bg: 'bg-amber-500',
                icon: (
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                ),
            },
        };
        const c = config[status];
        if (!c) return null;
        return <div className={`absolute left-1.5 top-1.5 z-[5] flex h-5 w-5 items-center justify-center rounded-full ${c.bg} text-white shadow-md ring-2 ring-white`}>{c.icon}</div>;
    };

    const getPhotoRingClass = (url: string) => {
        const entry = photoVerificationMap.get(url);
        if (!entry) return '';
        if (entry.status === 'found') return 'ring-2 ring-green-500';
        if (entry.status === 'not_found') return 'ring-2 ring-red-500';
        if (entry.status === 'returned_bad_quality') return 'ring-2 ring-amber-500';
        return '';
    };

    if (isLoading)
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );
    if (error || !reg)
        return (
            <div className="py-20 text-center">
                <p className="text-sm text-red-500">Enregistrement introuvable</p>
                <button onClick={() => router.push('/apps/registrations')} className="mt-3 text-sm text-primary hover:underline">
                    Retour à la liste
                </button>
            </div>
        );

    const st = STATUS_MAP[reg.status] || STATUS_MAP.draft;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="mb-1 flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">{reg.registrationId}</h1>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                    <p className="ml-11 text-xs text-slate-500">
                        Créé le{' '}
                        {new Date(reg.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                        {reg.registeredBy && (
                            <span>
                                {' '}
                                · par <strong>{(reg.registeredBy as any)?.name || 'Système'}</strong>
                            </span>
                        )}
                    </p>
                </div>
                <div className="ml-11 flex flex-wrap gap-2 sm:ml-0">
                    {reg.status === 'draft' && (
                        <>
                            {!isEditing ? (
                                <button
                                    onClick={startEditing}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                    </svg>
                                    Modifier
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={isSavingDraft}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                        {isSavingDraft ? 'Sauvegarde...' : '✓ Sauvegarder'}
                                    </button>
                                    <button
                                        onClick={cancelEditing}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleCompleteDraft}
                                disabled={isCompletingDraft || reg.totalArticles === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                                {isCompletingDraft ? 'Finalisation...' : '✓ Compléter'}
                            </button>
                        </>
                    )}
                    {reg.orderRef && (
                        <Link
                            href={`/apps/orders/preview/${reg.orderRef}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:text-slate-300"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                            </svg>
                            Voir la commande
                        </Link>
                    )}
                </div>
            </div>

            <input id="reg-detail-camera" ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
            <input id="reg-detail-photos" ref={addPhotosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadMorePhotos(e, 'articles')} />
            <input id="reg-detail-bag-photos" ref={addBagPhotosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadMorePhotos(e, 'bags')} />

            {/* Draft banner */}
            {reg.status === 'draft' && !isEditing && (
                <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-900/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/30">📝</span>
                        <div>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Brouillon — En cours d&apos;édition</p>
                            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Vous pouvez modifier les articles, ajouter des photos et compléter cet enregistrement.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <label
                            htmlFor="reg-detail-photos"
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white active:scale-95 ${
                                isUploadingMore ? 'pointer-events-none opacity-50' : ''
                            }`}
                        >
                            {isUploadingMore ? (
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                            Ajouter photos
                        </label>
                        <button
                            onClick={startEditing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 active:scale-95 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        >
                            Modifier articles
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-5 lg:col-span-2">
                    {/* Info card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                        <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Informations</h2>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-xs text-slate-400">Client</span>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{reg.clientName || '—'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Commande</span>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{reg.orderRef || '—'}</p>
                            </div>
                            {reg.operationIndex !== undefined && (
                                <div>
                                    <span className="text-xs text-slate-400">Opération</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">Op. {reg.operationIndex + 1}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-xs text-slate-400">Total articles</span>
                                <p className="text-lg font-black text-primary">{reg.totalArticles}</p>
                            </div>
                        </div>
                    </div>

                    {/* Photos */}
                    {(articlePhotos.length > 0 || reg.status === 'draft') && (
                        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/50">
                                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Photos ({articlePhotos.length})</h2>
                                <div className="flex items-center gap-2">
                                    {reg.status === 'draft' && (
                                        <label
                                            htmlFor="reg-detail-photos"
                                            className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-white shadow-sm active:scale-[0.97] ${
                                                isUploadingMore ? 'pointer-events-none opacity-50' : ''
                                            }`}
                                        >
                                            {isUploadingMore ? (
                                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            ) : (
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            )}
                                            Ajouter
                                        </label>
                                    )}
                                    {reg.status !== 'draft' && (
                                        <button
                                            onClick={startCompare}
                                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-white shadow-sm active:scale-[0.97]"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            Comparer
                                        </button>
                                    )}
                                    {totalPhotoPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setPhotoPage(Math.max(1, photoPage - 1))}
                                                disabled={photoPage === 1}
                                                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"
                                            >
                                                ←
                                            </button>
                                            <span className="px-1 text-[11px] text-slate-400">
                                                {photoPage}/{totalPhotoPages}
                                            </span>
                                            <button
                                                onClick={() => setPhotoPage(Math.min(totalPhotoPages, photoPage + 1))}
                                                disabled={photoPage === totalPhotoPages}
                                                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"
                                            >
                                                →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 sm:p-4">
                                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-6">
                                    {paginatedPhotos.map((photo: RegistrationPhoto, idx: number) => {
                                        const globalIdx = (photoPage - 1) * PHOTOS_PER_PAGE + idx;
                                        const isVerifiable = reg.status !== 'draft';
                                        const ringClass = getPhotoRingClass(photo.url);
                                        const isTapped = tappedPhotoIdx === globalIdx;
                                        return (
                                            <div
                                                key={photo.filename}
                                                className="group/photo relative cursor-pointer"
                                                onClick={() => {
                                                    if (isVerifiable) {
                                                        // On mobile: first tap reveals buttons, second tap opens lightbox
                                                        if (isTapped) {
                                                            setTappedPhotoIdx(null);
                                                            openLightbox('articles', globalIdx);
                                                        } else {
                                                            setTappedPhotoIdx(globalIdx);
                                                        }
                                                    } else {
                                                        openLightbox('articles', globalIdx);
                                                    }
                                                }}
                                            >
                                                <PhotoStatusBadge url={photo.url} />
                                                <div className={`relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 ${ringClass}`}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={`${API_URL}${photo.url}`} alt={`Photo ${globalIdx + 1}`} className="h-full w-full object-cover" loading="lazy" />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent py-0.5 text-center text-[9px] font-bold text-white">
                                                        {globalIdx + 1}
                                                    </div>
                                                </div>
                                                {/* Delete button for drafts */}
                                                {reg.status === 'draft' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeletePhoto(photo.url);
                                                        }}
                                                        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 shadow transition-opacity group-hover/photo:opacity-100"
                                                    >
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {/* Status buttons: visible on tap (mobile) or hover (desktop) */}
                                                {isVerifiable && (
                                                    <div
                                                        className={`absolute inset-x-0 top-0 z-10 flex justify-center gap-1.5 rounded-t-xl bg-gradient-to-b from-black/70 via-black/50 to-transparent px-1.5 py-2 transition-opacity ${
                                                            isTapped ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/photo:pointer-events-auto group-hover/photo:opacity-100'
                                                        }`}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePhotoVerifyAction(photo.url, 'found');
                                                                setTappedPhotoIdx(null);
                                                            }}
                                                            disabled={verifyMutation.isPending}
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white shadow-lg active:scale-90"
                                                            title="Trouvé"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePhotoVerifyAction(photo.url, 'returned_bad_quality');
                                                                setTappedPhotoIdx(null);
                                                            }}
                                                            disabled={verifyMutation.isPending}
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-lg active:scale-90"
                                                            title="Retourné"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePhotoVerifyAction(photo.url, 'not_found');
                                                                setTappedPhotoIdx(null);
                                                            }}
                                                            disabled={verifyMutation.isPending}
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white shadow-lg active:scale-90"
                                                            title="Introuvable"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Empty state for drafts with no photos */}
                            {articlePhotos.length === 0 && reg.status === 'draft' && (
                                <div className="p-6 text-center">
                                    <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                    <p className="mt-2 text-sm text-slate-400">Aucune photo encore</p>
                                    <label
                                        htmlFor="reg-detail-photos"
                                        className={`mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white active:scale-95 ${
                                            isUploadingMore ? 'pointer-events-none opacity-50' : ''
                                        }`}
                                    >
                                        Ajouter des photos
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bags */}
                    {reg.bags && reg.bags.count > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                            <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Sacs</h2>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-xl">🛍️</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {reg.bags.count} sac{reg.bags.count > 1 ? 's' : ''}
                                </span>
                                {reg.bags.notes && <span className="text-slate-400">— {reg.bags.notes}</span>}
                            </div>
                            {bagPhotos.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {bagPhotos.map((photo: RegistrationPhoto, idx: number) => (
                                        <button
                                            key={photo.filename}
                                            onClick={() => openLightbox('bags', idx)}
                                            className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`${API_URL}${photo.url}`} alt={`Sac ${idx + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Verification summary */}
                    {reg.status !== 'draft' && verificationItems.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Vérification avant livraison</h2>
                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                        {stats && stats.found === stats.total ? '✓ Tous les articles ont été vérifiés' : 'Vérifiez chaque article individuellement'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {stats && (
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${stats.found === stats.total ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                            {stats.found}/{stats.total}
                                        </span>
                                    )}
                                    <Link href="/apps/registrations/non-found" className="text-[11px] font-semibold text-red-500 active:underline">
                                        Introuvables
                                    </Link>
                                    {stats && stats.pending < stats.total && (
                                        <button
                                            onClick={handleClearAllVerifications}
                                            disabled={clearVerificationsMutation.isPending}
                                            className="min-h-[32px] rounded-md border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 active:border-red-300 active:bg-red-50 active:text-red-600 dark:border-slate-600"
                                        >
                                            {clearVerificationsMutation.isPending ? '…' : 'Tout réinitialiser'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {stats && stats.total > 0 && (
                                <div className="px-4 pb-4">
                                    <div className="mb-1.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        {stats.found > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(stats.found / stats.total) * 100}%` }} />}
                                        {stats.badQuality > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(stats.badQuality / stats.total) * 100}%` }} />}
                                        {stats.notFound > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(stats.notFound / stats.total) * 100}%` }} />}
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-[11px]">
                                        <span className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                                            {stats.found} trouvés
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                            {stats.badQuality} retournés
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                            {stats.notFound} introuvables
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                            {stats.pending} en attente
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {reg.notes && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                            <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-white">Notes</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{reg.notes}</p>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                        <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Résumé</h2>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Total articles</span>
                                <span className="text-lg font-black text-primary">{reg.totalArticles}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Photos</span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{articlePhotos.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400">Sacs</span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{reg.bags?.count || 0}</span>
                            </div>
                            {stats && (
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
                                    <span className="text-xs text-slate-400">Vérification</span>
                                    <span className={`text-sm font-bold ${stats.found === stats.total ? 'text-green-600' : 'text-amber-600'}`}>
                                        {stats.found}/{stats.total}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Détail des articles {isEditing && <span className="text-primary">({editTotalArticles})</span>}</h2>
                            {reg.status === 'draft' && !isEditing && (
                                <button onClick={startEditing} className="text-[11px] font-semibold text-primary hover:underline">
                                    Modifier
                                </button>
                            )}
                        </div>

                        {/* Editing mode */}
                        {isEditing ? (
                            <div className="space-y-2">
                                {editArticles.map((a: any, idx: number) => (
                                    <div key={a.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{CATEGORY_ICONS[a.name] || '📦'}</span>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{a.label}</span>
                                        </div>
                                        <div className="flex items-center gap-0">
                                            <button
                                                onClick={() =>
                                                    setEditArticles((prev: any[]) =>
                                                        prev.map((art, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...art,
                                                                      quantity: Math.max(0, art.quantity - 1),
                                                                  }
                                                                : art
                                                        )
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-l-lg bg-slate-100 text-sm font-bold text-slate-500 active:bg-slate-200 dark:bg-slate-800"
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={a.quantity}
                                                onChange={(e) =>
                                                    setEditArticles((prev: any[]) =>
                                                        prev.map((art, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...art,
                                                                      quantity: Math.max(0, parseInt(e.target.value) || 0),
                                                                  }
                                                                : art
                                                        )
                                                    )
                                                }
                                                className="h-8 w-12 border-x border-slate-200 bg-white text-center text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                            <button
                                                onClick={() =>
                                                    setEditArticles((prev: any[]) =>
                                                        prev.map((art, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...art,
                                                                      quantity: art.quantity + 1,
                                                                  }
                                                                : art
                                                        )
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-r-lg bg-primary/10 text-sm font-bold text-primary active:bg-primary/20"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Notes editing */}
                                <div className="mt-3">
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Notes</label>
                                    <textarea
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        rows={2}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        placeholder="Notes..."
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleSaveDraft} disabled={isSavingDraft} className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-white disabled:opacity-50">
                                        {isSavingDraft ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                    <button
                                        onClick={cancelEditing}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Read-only mode */
                            <div className="space-y-1.5">
                                {reg.articles
                                    ?.filter((a) => a.quantity > 0)
                                    .map((a) => (
                                        <div key={a.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{CATEGORY_ICONS[a.name] || '📦'}</span>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{a.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800 dark:text-white">{a.quantity}</span>
                                                {a.subCount1 && a.subCount1 > 0 && a.subLabel1 && (
                                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                        {a.subCount1} {a.subLabel1}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {reg.summaryText && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Message</h2>
                                <button
                                    onClick={() => navigator.clipboard.writeText(reg.summaryText || '')}
                                    className="min-h-[32px] rounded-lg px-3 py-1 text-[11px] font-semibold text-primary active:bg-primary/10"
                                >
                                    Copier
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">{reg.summaryText}</pre>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(reg.summaryText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 py-2.5 text-sm font-semibold text-green-700 active:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WhatsApp
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* Image search modal */}
            {showCompareBar && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={closeCompare}>
                    <div className="w-full max-w-lg rounded-t-2xl bg-white p-0 shadow-2xl dark:bg-[#1a2234] sm:max-h-[85vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700/50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Recherche visuelle</h3>
                                {nextPendingItem && stats && (
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                        <strong>
                                            {nextPendingItem.categoryLabel} #{nextPendingItem.itemIndex + 1}
                                        </strong>
                                        <span className="ml-1 text-slate-400">
                                            · {stats.found}/{stats.total} vérifiés
                                        </span>
                                    </p>
                                )}
                                {descriptorsReady < articlePhotos.length && (
                                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-500">
                                        <span className="h-2 w-2 animate-spin rounded-full border border-amber-400 border-t-transparent" />
                                        Indexation: {descriptorsReady}/{articlePhotos.length} photos
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <label
                                    htmlFor="reg-detail-camera"
                                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-[11px] font-semibold text-primary active:bg-primary/10"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                        />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Reprendre
                                </label>
                                <button
                                    onClick={closeCompare}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 active:bg-slate-100 active:text-slate-600 dark:active:bg-slate-800"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {capturedPreview && (
                            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-primary/40 shadow">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={capturedPreview} alt="Captured" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Article photographié</p>
                                        {isSearching ? (
                                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                                                Analyse en cours…
                                            </p>
                                        ) : searchPass === 1 && searchResults.length > 0 ? (
                                            <p className="mt-1 text-[11px] font-medium text-green-600">Correspondance trouvée — sélectionnez pour confirmer</p>
                                        ) : searchPass === 2 && searchResults.length > 0 ? (
                                            <p className="mt-1 text-[11px] font-medium text-amber-600">Correspondance faible (-20%) — vérifiez manuellement</p>
                                        ) : searchPass === 'none' ? (
                                            <p className="mt-1 text-[11px] font-medium text-red-500">Aucune correspondance trouvée</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="max-h-[60vh] overflow-y-auto px-4 py-4 sm:max-h-[55vh]">
                            {searchResults.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Confidence banner */}
                                    {searchPass === 'none' && (
                                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-900/20">
                                            <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                                />
                                            </svg>
                                            <div>
                                                <p className="text-xs font-bold text-red-700 dark:text-red-400">Aucune correspondance fiable</p>
                                                <p className="mt-0.5 text-[11px] text-red-600/80 dark:text-red-300/70">
                                                    L&apos;article n&apos;a pas été trouvé parmi les photos enregistrées. Vous pouvez parcourir manuellement ci-dessous ou reprendre une photo.
                                                </p>
                                                <label
                                                    htmlFor="reg-detail-camera"
                                                    className="mt-2 inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-[11px] font-semibold text-white active:scale-95"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                                        />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    Reprendre la photo
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                    {searchPass === 2 && (
                                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
                                            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                                />
                                            </svg>
                                            <div>
                                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Correspondance incertaine</p>
                                                <p className="mt-0.5 text-[11px] text-amber-600/80 dark:text-amber-300/70">
                                                    Le seuil a été réduit de -20%. Les résultats nécessitent une vérification manuelle attentive.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Best match — only show prominently if high or low confidence */}
                                    {searchPass !== 'none' &&
                                        (() => {
                                            const best = searchResults[0];
                                            const bestPct = toDisplayPct(best.score);
                                            const bestStatus = photoVerificationMap.get(best.photo.url)?.status;
                                            const isBestSelected = selectedMatch === best.idx;
                                            const isHigh = searchPass === 1;
                                            return (
                                                <div className="relative">
                                                    <div className="mb-1.5 flex items-center gap-1.5">
                                                        <span className={`h-2 w-2 rounded-full ${isHigh ? 'animate-pulse bg-green-500' : 'bg-amber-500'}`} />
                                                        <span className={`text-[11px] font-bold ${isHigh ? 'text-green-600' : 'text-amber-600'}`}>
                                                            {isHigh ? 'Meilleure correspondance' : 'Correspondance possible'}
                                                        </span>
                                                        <span
                                                            className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                                                bestPct >= 50 ? 'bg-green-100 text-green-700' : bestPct >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            {bestPct}%
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedMatch(isBestSelected ? null : best.idx)}
                                                        className={`relative w-full overflow-hidden rounded-2xl bg-slate-100 transition active:scale-[0.98] dark:bg-slate-800 ${
                                                            isBestSelected ? 'shadow-xl ring-2 ring-primary' : isHigh ? 'shadow-lg ring-2 ring-green-400/60' : 'shadow ring-2 ring-amber-400/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 p-3">
                                                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={`${API_URL}${best.photo.url}`} alt="Best match" className="h-full w-full object-cover" />
                                                            </div>
                                                            <div className="flex flex-1 flex-col gap-1 text-left">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-slate-800 dark:text-white">Photo #{best.idx + 1}</span>
                                                                    {bestStatus && bestStatus !== 'pending' && bestStatus !== 'not_found' && (
                                                                        <span
                                                                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                                                                bestStatus === 'found'
                                                                                    ? 'bg-green-100 text-green-700'
                                                                                    : bestStatus === 'not_found'
                                                                                    ? 'bg-red-100 text-red-700'
                                                                                    : 'bg-amber-100 text-amber-700'
                                                                            }`}
                                                                        >
                                                                            {bestStatus === 'found' ? 'Trouvé' : bestStatus === 'not_found' ? 'Introuvable' : 'Retourné'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-500">Appuyez pour valider ou changer le statut</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                    {isBestSelected && (
                                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/70 backdrop-blur-sm">
                                                            <div className="flex gap-4">
                                                                <button
                                                                    onClick={() => handleMatchAction(best.photo, 'found')}
                                                                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg active:scale-90"
                                                                    title="Trouvé"
                                                                >
                                                                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMatchAction(best.photo, 'returned_bad_quality')}
                                                                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg active:scale-90"
                                                                    title="Retourné"
                                                                >
                                                                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMatchAction(best.photo, 'not_found')}
                                                                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500 text-white shadow-lg active:scale-90"
                                                                    title="Introuvable"
                                                                >
                                                                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => setSelectedMatch(null)}
                                                                className="min-h-[36px] rounded-lg px-4 py-1.5 text-[11px] font-medium text-white/70 active:text-white"
                                                            >
                                                                Annuler
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                    {/* Other matches grid */}
                                    {searchResults.length > (searchPass === 'none' ? 0 : 1) && (
                                        <div>
                                            <p className="mb-2 text-[11px] font-semibold text-slate-400">{searchPass === 'none' ? 'Parcourir manuellement' : 'Autres correspondances'}</p>
                                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                                                {(searchPass === 'none' ? searchResults : searchResults.slice(1)).map(({ idx, score, photo }) => {
                                                    const isSelected = selectedMatch === idx;
                                                    const matchPct = toDisplayPct(score);
                                                    const photoStatus = photoVerificationMap.get(photo.url)?.status;
                                                    return (
                                                        <div key={photo.filename} className="relative">
                                                            <button
                                                                onClick={() => setSelectedMatch(isSelected ? null : idx)}
                                                                className={`relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 transition active:scale-[0.97] dark:bg-slate-800 ${
                                                                    isSelected ? 'shadow-lg ring-2 ring-primary' : 'ring-1 ring-slate-200 dark:ring-slate-700'
                                                                }`}
                                                            >
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={`${API_URL}${photo.url}`} alt="Match" className="h-full w-full object-cover" loading="lazy" />
                                                                <div
                                                                    className={`absolute right-1.5 top-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-sm ${
                                                                        matchPct >= 50 ? 'bg-green-500 text-white' : matchPct >= 30 ? 'bg-amber-500 text-white' : 'bg-slate-700/80 text-white'
                                                                    }`}
                                                                >
                                                                    {matchPct}%
                                                                </div>
                                                                {photoStatus && photoStatus !== 'pending' && photoStatus !== 'not_found' && (
                                                                    <div
                                                                        className={`absolute left-1.5 top-1.5 h-4 w-4 rounded-full ring-2 ring-white ${
                                                                            photoStatus === 'found' ? 'bg-green-500' : photoStatus === 'not_found' ? 'bg-red-500' : 'bg-amber-500'
                                                                        }`}
                                                                    />
                                                                )}
                                                            </button>
                                                            {isSelected && (
                                                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-xl bg-black/70 backdrop-blur-sm">
                                                                    <div className="flex gap-3">
                                                                        <button
                                                                            onClick={() => handleMatchAction(photo, 'found')}
                                                                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg active:scale-90"
                                                                        >
                                                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleMatchAction(photo, 'returned_bad_quality')}
                                                                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg active:scale-90"
                                                                        >
                                                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleMatchAction(photo, 'not_found')}
                                                                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500 text-white shadow-lg active:scale-90"
                                                                        >
                                                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                    <button onClick={() => setSelectedMatch(null)} className="min-h-[32px] text-[11px] font-medium text-white/60 active:text-white">
                                                                        Annuler
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : !isSearching && capturedPreview ? (
                                <div className="py-10 text-center">
                                    <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <p className="mt-2 text-sm text-slate-400">Aucun résultat</p>
                                </div>
                            ) : !capturedPreview ? (
                                <div className="flex flex-col items-center gap-4 py-12">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                        <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                            />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-500">Prenez une photo pour lancer la recherche</p>
                                    <label
                                        htmlFor="reg-detail-camera"
                                        className="min-h-[44px] cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg active:scale-95"
                                    >
                                        Ouvrir la caméra
                                    </label>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Floating camera button */}
            {reg.status !== 'draft' && articlePhotos.length > 0 && !showCompareBar && (
                <button
                    onClick={startCompare}
                    className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 transition hover:bg-primary/90 active:scale-90 lg:hidden"
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            )}

            {/* Lightbox */}
            {lightboxIdx !== null && !showCompareBar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightboxIdx(null)}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIdx(Math.max(0, lightboxIdx - 1));
                        }}
                        disabled={lightboxIdx === 0}
                        className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur disabled:opacity-30"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${API_URL}${currentLightboxPhotos[lightboxIdx]?.url}`} alt={`Photo ${lightboxIdx + 1}`} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
                        <div className="mt-2 text-center text-xs text-white/70">
                            {lightboxIdx + 1} / {currentLightboxPhotos.length}
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIdx(Math.min(currentLightboxPhotos.length - 1, lightboxIdx + 1));
                        }}
                        disabled={lightboxIdx === currentLightboxPhotos.length - 1}
                        className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur disabled:opacity-30"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <button onClick={() => setLightboxIdx(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default RegistrationDetail;
