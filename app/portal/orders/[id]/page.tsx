'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { ClientOrder, clientPortalApi, OperationInfo, OrderPhoto, PackInfo } from '@/lib/api/client-portal'; /* ─── Status Maps ─── */

/* ─── Status Maps ─── */
const STATUS: Record<string, { label: string; color: string; bg: string; icon: string; border: string }> = {
    pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏳', border: 'border-amber-200' },
    confirmed: { label: 'Confirmé', color: 'text-blue-700', bg: 'bg-blue-50', icon: '✅', border: 'border-blue-200' },
    registered: {
        label: 'Enregistré',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        icon: '📝',
        border: 'border-indigo-200',
    },
    processing: {
        label: 'En traitement',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        icon: '🔄',
        border: 'border-purple-200',
    },
    in_progress: {
        label: 'En cours',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        icon: '🔄',
        border: 'border-purple-200',
    },
    ready_for_delivery: {
        label: 'Prêt à livrer',
        color: 'text-teal-700',
        bg: 'bg-teal-50',
        icon: '✨',
        border: 'border-teal-200',
    },
    out_for_delivery: {
        label: 'En livraison',
        color: 'text-sky-700',
        bg: 'bg-sky-50',
        icon: '🚚',
        border: 'border-sky-200',
    },
    not_delivered: {
        label: 'Non livré',
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        icon: '⚠️',
        border: 'border-orange-200',
    },
    delivered: { label: 'Livré', color: 'text-green-700', bg: 'bg-green-50', icon: '✅', border: 'border-green-200' },
    completed: { label: 'Terminé', color: 'text-green-700', bg: 'bg-green-50', icon: '🏁', border: 'border-green-200' },
    cancelled: { label: 'Annulé', color: 'text-red-700', bg: 'bg-red-50', icon: '❌', border: 'border-red-200' },
    active: { label: 'Actif', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🟢', border: 'border-emerald-200' },
    stopped: { label: 'Arrêté', color: 'text-red-700', bg: 'bg-red-50', icon: '🔴', border: 'border-red-200' },
};
const getS = (s: string) =>
    STATUS[s] || {
        label: s,
        color: 'text-slate-600',
        bg: 'bg-slate-50',
        icon: '❓',
        border: 'border-slate-200',
    };
const fmt = (n?: number | null) => (n ?? 0).toLocaleString('fr-FR');
const PMETHODS: Record<string, string> = {
    OrangeMoney: '🟠 Orange Money',
    MTNMoney: '🟡 MTN Money',
    MoovMoney: '🔵 Moov Money',
    Wave: '🌊 Wave',
    Cash: '💵 Espèces',
    Other: '💳 Autre',
};

/**
 * Derive effective delivery status from the paired pickup status.
 * The raw deliverySchedule often has status='pending' even though the pickup
 * is 'delivered' — the BO operations page does this mapping server-side but
 * the raw order data doesn't, so we do it client-side.
 */
function getEffectiveDeliveryStatus(delivery: OperationInfo, pairedPickup?: OperationInfo): string {
    const dStatus = delivery.status || 'pending';
    // If delivery has its own non-pending status, use it
    if (dStatus !== 'pending') return dStatus;
    // Otherwise derive from the paired pickup
    if (!pairedPickup) return dStatus;
    const pStatus = pairedPickup.status || 'pending';
    const MAP: Record<string, string> = {
        pending: 'pending',
        confirmed: 'pending',
        registered: 'registered',
        processing: 'processing',
        in_progress: 'processing',
        ready_for_delivery: 'ready_for_delivery',
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
        completed: 'delivered',
    };
    return MAP[pStatus] || dStatus;
}

/* ─── Pack Usage ─── */
function computePackUsage(order: ClientOrder) {
    let ordinaires = 0,
        couettes = 0,
        vestes = 0,
        draps = 0,
        serviettes = 0,
        totalPieces = 0;
    const add = (p: OperationInfo) => {
        if (!p.clothesCount) return;
        totalPieces += p.clothesCount;
        const d = p.clothesDetails || [];
        couettes += d.find((x) => x.name === 'Couettes')?.quantity || 0;
        vestes += d.find((x) => x.name === 'Vestes')?.quantity || 0;
        draps += (d.find((x) => x.name === 'Draps & Serviettes')?.quantity || 0) + (d.find((x) => x.name === 'Draps')?.quantity || 0);
        serviettes += d.find((x) => x.name === 'Serviettes')?.quantity || 0;
    };
    for (const p of order.pickupSchedule || []) add(p);
    if (order.pickup) add(order.pickup);
    const drapsServiettes = draps + serviettes;
    ordinaires = Math.max(0, totalPieces - couettes - vestes - drapsServiettes);
    return { totalPieces, ordinaires, couettes, vestes, draps, serviettes, drapsServiettes };
}

export default function PortalOrderDetailPage() {
    const router = useRouter();
    const params = useParams();
    const orderId = params?.id as string;
    const [order, setOrder] = useState<ClientOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set());
    const [photos, setPhotos] = useState<OrderPhoto[]>([]);
    const [packs, setPacks] = useState<PackInfo[]>([]);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    // Rating modal
    const [ratingModal, setRatingModal] = useState<{ opType: 'pickup' | 'delivery'; opIndex: number } | null>(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [ratingSaving, setRatingSaving] = useState(false);
    // Comment input
    const [commentText, setCommentText] = useState('');
    const [commentSaving, setCommentSaving] = useState(false);
    // Request action loading
    const [requestingOp, setRequestingOp] = useState<string | null>(null);
    // Time-slot picker modal
    const [timeSlotModal, setTimeSlotModal] = useState<{ type: 'pickup' | 'delivery'; opIndex: number } | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

    useEffect(() => {
        if (localStorage.getItem('portal_auth') !== 'true') {
            router.replace('/portal/login');
            return;
        }
        if (!orderId) return;
        clientPortalApi
            .getOrder(orderId)
            .then(setOrder)
            .catch((err) => {
                if (err?.response?.status === 401) {
                    localStorage.removeItem('portal_auth');
                    router.replace('/portal/login');
                }
            })
            .finally(() => setLoading(false));
        clientPortalApi
            .getOrderPhotos(orderId)
            .then(setPhotos)
            .catch(() => {});
        clientPortalApi
            .getPacks()
            .then(setPacks)
            .catch(() => {});
    }, [orderId, router]);

    // Auto-expand sections that have pending/active operations
    useEffect(() => {
        if (!order) return;
        const pickups = order.pickupSchedule || [];
        const deliveries = order.deliverySchedule || [];
        const sections = new Set<string>();
        const hasPendingPickup = pickups.some((p) => !p.clothesCount || p.clothesCount === 0);
        const hasPendingDelivery = deliveries.some((d) => ['pending', 'confirmed', 'ready_for_delivery', 'out_for_delivery'].includes(d.status || 'pending'));
        if (hasPendingPickup) sections.add('pickups');
        if (hasPendingDelivery) sections.add('deliveries');
        // If no pending ops, expand both
        if (sections.size === 0 && (pickups.length > 0 || deliveries.length > 0)) {
            sections.add('pickups');
            sections.add('deliveries');
        }
        setOpenSections(sections);
    }, [order]);

    const orderStatus = useMemo(() => {
        if (!order) return getS('pending');
        return getS(order.type === 'subscription' ? order.subscriptionStatus || order.status : order.status);
    }, [order]);

    const packInfo = useMemo(() => {
        if (!order?.packName || !packs.length || order.type !== 'subscription') return null;
        return packs.find((p) => p.code === order.packName || p.code?.toUpperCase() === order.packName?.toUpperCase() || p.name === order.packName) || null;
    }, [order, packs]);

    const usage = useMemo(() => (order ? computePackUsage(order) : null), [order]);

    const surplusInfo = useMemo(() => {
        if (!packInfo || !usage) return null;
        const extraOrdinaires = Math.max(0, usage.ordinaires - packInfo.vetements);
        const extraCouettes = Math.max(0, usage.couettes - packInfo.couettes);
        const extraVestes = Math.max(0, usage.vestes - packInfo.vestes);
        const extraDrapsServiettes = Math.max(0, usage.drapsServiettes - packInfo.draps_serviettes);
        const hasExtra = extraOrdinaires > 0 || extraCouettes > 0 || extraVestes > 0 || extraDrapsServiettes > 0;
        return {
            extraOrdinaires,
            extraCouettes,
            extraVestes,
            extraDrapsServiettes,
            hasExtra,
            totalSurplus: order?.surplusAmount || 0,
        };
    }, [packInfo, usage, order]);

    const photosByOp = useMemo(() => {
        const map = new Map<number, OrderPhoto[]>();
        for (const p of photos) {
            const key = p.operationIndex ?? -1;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(p);
        }
        return map;
    }, [photos]);

    const flatPhotos = useMemo(() => {
        const arr: OrderPhoto[] = [];
        photosByOp.forEach((ps) => arr.push(...ps));
        return arr;
    }, [photosByOp]);

    const toggle = (s: string) =>
        setOpenSections((prev) => {
            const next = new Set(prev);
            next.has(s) ? next.delete(s) : next.add(s);
            return next;
        });

    // ── Action handlers ──
    const handleSubmitRating = async () => {
        if (!ratingModal || ratingValue < 1 || !order) return;
        setRatingSaving(true);
        try {
            await clientPortalApi.rateOperation(order._id, ratingModal.opType, ratingModal.opIndex, ratingValue, ratingComment || undefined);
            // Update local state
            const updated = { ...order };
            const schedule = ratingModal.opType === 'pickup' ? updated.pickupSchedule : updated.deliverySchedule;
            if (schedule?.[ratingModal.opIndex]) {
                schedule[ratingModal.opIndex] = {
                    ...schedule[ratingModal.opIndex],
                    clientRating: ratingValue,
                    clientComment: ratingComment || undefined,
                };
            }
            setOrder(updated);
            setRatingModal(null);
            setRatingValue(0);
            setRatingComment('');
            Swal.fire({
                icon: 'success',
                title: 'Merci !',
                text: 'Votre évaluation a été enregistrée',
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || "Impossible d'enregistrer l'évaluation", 'error');
        } finally {
            setRatingSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !order) return;
        setCommentSaving(true);
        try {
            const res = await clientPortalApi.addComment(order._id, commentText.trim());
            setOrder({ ...order, clientComments: res.comments });
            setCommentText('');
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || "Impossible d'ajouter le commentaire", 'error');
        } finally {
            setCommentSaving(false);
        }
    };

    const handleRequestPickup = async (opIndex: number, preferredTime?: string) => {
        if (!order) return;
        const key = `pickup-${opIndex}`;
        setRequestingOp(key);
        try {
            const res = await clientPortalApi.requestPickup(order._id, opIndex, preferredTime);
            if (res.ok) {
                const updated = { ...order };
                if (updated.pickupSchedule?.[opIndex])
                    updated.pickupSchedule[opIndex] = {
                        ...updated.pickupSchedule[opIndex],
                        status: 'confirmed',
                    };
                setOrder(updated);
                Swal.fire({
                    icon: 'success',
                    title: 'Récupération demandée !',
                    text: `Nous avons bien reçu votre demande${preferredTime ? ` (${preferredTime})` : ''}`,
                    timer: 2500,
                    showConfirmButton: false,
                });
            }
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || 'Impossible de demander la récupération', 'error');
        } finally {
            setRequestingOp(null);
        }
    };

    const handleRequestDelivery = async (opIndex: number, preferredTime?: string) => {
        if (!order) return;
        const key = `delivery-${opIndex}`;
        setRequestingOp(key);
        try {
            const res = await clientPortalApi.requestDelivery(order._id, opIndex, preferredTime);
            if (res.gated) {
                // Payment required
                Swal.fire({
                    icon: 'warning',
                    title: 'Paiement requis',
                    html: `<div class="text-left text-sm"><p>${res.message}</p><div class="mt-3 rounded-lg bg-amber-50 p-3"><p class="font-bold text-amber-800">Restant: ${(
                        res.remaining || 0
                    ).toLocaleString('fr-FR')} F</p><p class="text-xs text-amber-600 mt-1">Payé: ${(res.totalPaid || 0).toLocaleString('fr-FR')} F / ${(res.totalPrice || 0).toLocaleString(
                        'fr-FR'
                    )} F</p></div><p class="mt-3 text-xs text-slate-500">Contactez-nous pour compléter votre paiement.</p></div>`,
                    confirmButtonText: 'Compris',
                    confirmButtonColor: '#4361ee',
                });
            } else if (res.ok) {
                const updated = { ...order };
                if (updated.deliverySchedule?.[opIndex])
                    updated.deliverySchedule[opIndex] = {
                        ...updated.deliverySchedule[opIndex],
                        status: 'confirmed',
                    };
                setOrder(updated);
                Swal.fire({
                    icon: 'success',
                    title: 'Livraison demandée !',
                    text: `Nous avons bien reçu votre demande${preferredTime ? ` (${preferredTime})` : ''}`,
                    timer: 2500,
                    showConfirmButton: false,
                });
            }
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || 'Impossible de demander la livraison', 'error');
        } finally {
            setRequestingOp(null);
        }
    };

    const isDateReached = (dateStr: string) => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d <= today;
    };

    if (loading)
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-white">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#4361ee]" />
            </div>
        );
    if (!order)
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f8f9fc] px-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <span className="text-4xl">😕</span>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">Commande non trouvée</p>
                <button onClick={() => router.push('/portal/orders')} className="mt-4 rounded-xl bg-[#4361ee] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-300/40 active:scale-95">
                    ← Retour
                </button>
            </div>
        );

    const pickups = (order.pickupSchedule || []) as OperationInfo[];
    const deliveries = (order.deliverySchedule || []) as OperationInfo[];
    const payments = order.payments || [];
    const surplus = order.surplus || [];
    const remaining = (order.totalPrice || 0) - (order.totalPaid || 0);

    /* ─── Circular Progress ─── */
    const CircleProgress = ({ pct, size = 56, stroke = 5, color = '#4361ee' }: { pct: number; size?: number; stroke?: number; color?: string }) => {
        const r = (size - stroke) / 2;
        const c = 2 * Math.PI * r;
        const offset = c - (Math.min(100, pct) / 100) * c;
        return (
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                />
            </svg>
        );
    };

    /* ─── Status Timeline (kept for potential future use) ─── */
    const _StatusTimeline = ({ ops, type }: { ops: OperationInfo[]; type: 'pickup' | 'delivery' }) => {
        const remaining = (order?.totalPrice || 0) - (order?.totalPaid || 0);
        return (
            <div className="space-y-0">
                {ops.map((op, idx) => {
                    const effectiveStatus = type === 'delivery' ? getEffectiveDeliveryStatus(op, pickups[idx]) : op.status || 'pending';
                    const s = getS(effectiveStatus);
                    const isDone = type === 'pickup' ? !!(op.clothesCount && op.clothesCount > 0) : ['delivered', 'completed'].includes(effectiveStatus);
                    const opPhotos = type === 'pickup' ? photosByOp.get(idx) || [] : [];
                    const isLast = idx === ops.length - 1;
                    const canRequest = (op.status || 'pending') === 'pending' && op.date && isDateReached(op.date);
                    const isRequesting = requestingOp === `${type}-${idx}`;
                    const needsRating = isDone && !op.clientRating;
                    const agentName = (op as any).deliveryAgentName || op.deliveryAgent;
                    // Payment required only when effective status is ready_for_delivery and there's remaining balance
                    const showPaymentRequired = type === 'delivery' && effectiveStatus === 'ready_for_delivery' && remaining > 0;
                    // Payment proofs for this operation
                    const opProofs = (order?.paymentProofs || []).filter((p) => p.operationIndex === idx || p.operationIndex === undefined);

                    return (
                        <div key={idx} className="flex gap-3">
                            {/* Timeline line + dot */}
                            <div className="flex flex-col items-center">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDone ? 'bg-green-500 text-white' : `${s.bg} ${s.color}`}`}>
                                    {isDone ? '✓' : idx + 1}
                                </div>
                                {!isLast && <div className={`w-0.5 flex-1 ${isDone ? 'bg-green-300' : 'bg-slate-200'}`} />}
                            </div>
                            {/* Content */}
                            <div className={`mb-3 flex-1 rounded-xl border p-3 ${isDone ? 'border-green-100 bg-green-50/40' : 'border-slate-100 bg-white'}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800">
                                        {type === 'pickup' ? 'Récupération' : 'Livraison'} {idx + 1}
                                    </p>
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.color} ${s.bg}`}>{s.label}</span>
                                </div>
                                {op.date && (
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                        {new Date(op.date).toLocaleDateString('fr-FR', {
                                            weekday: 'long',
                                            day: '2-digit',
                                            month: 'long',
                                        })}
                                        {op.scheduledTime ? ` · ${op.scheduledTime}` : ''}
                                    </p>
                                )}
                                {/* Delivery agent */}
                                {agentName && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4361ee]/10 text-[10px]">🚗</div>
                                        <span className="text-[10px] font-semibold text-[#4361ee]">{agentName}</span>
                                    </div>
                                )}
                                {(op.clothesCount || op.clothesDetails?.length || op.note || op.address) && (
                                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                                        {op.clothesCount && op.clothesCount > 0 && <p className="text-[10px] font-semibold text-blue-700">👔 {op.clothesCount} pièces</p>}
                                        {op.clothesDetails && op.clothesDetails.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {op.clothesDetails
                                                    .filter((d) => d.quantity > 0)
                                                    .map((d, i) => (
                                                        <span key={i} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                                                            {d.name} ×{d.quantity}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}
                                        {op.address && (
                                            <p className="text-[10px] text-slate-400">
                                                📍 {op.address}
                                                {op.city ? `, ${op.city}` : ''}
                                            </p>
                                        )}
                                        {op.note && <p className="text-[10px] italic text-slate-400">💬 {op.note}</p>}
                                    </div>
                                )}
                                {/* Inline photos */}
                                {opPhotos.length > 0 && (
                                    <div className="mt-2 border-t border-slate-100 pt-2">
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {opPhotos.slice(0, 4).map((photo, i) => {
                                                const globalIdx = flatPhotos.indexOf(photo);
                                                return (
                                                    <button key={i} onClick={() => setLightboxIdx(globalIdx)} className="aspect-square overflow-hidden rounded-lg bg-slate-100 active:scale-95">
                                                        <img src={`/api-proxy${photo.url}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                    </button>
                                                );
                                            })}
                                            {opPhotos.length > 4 && (
                                                <button
                                                    onClick={() => setLightboxIdx(flatPhotos.indexOf(opPhotos[4]))}
                                                    className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500"
                                                >
                                                    +{opPhotos.length - 4}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* ── Request pickup/delivery button ── */}
                                {canRequest && type === 'pickup' && (
                                    <button
                                        onClick={() => {
                                            setTimeSlotModal({ type: 'pickup', opIndex: idx });
                                            setSelectedTimeSlot('');
                                        }}
                                        disabled={isRequesting}
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4361ee] py-2.5 text-xs font-bold text-white shadow-md shadow-blue-300/30 transition active:scale-[0.97] disabled:opacity-60"
                                    >
                                        {isRequesting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : '📦'}
                                        {isRequesting ? 'Demande en cours...' : 'Demander la récupération'}
                                    </button>
                                )}
                                {/* Payment required — only for ready_for_delivery status */}
                                {showPaymentRequired && (
                                    <div className="mt-2 space-y-2">
                                        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">⚠️</span>
                                                <div>
                                                    <p className="text-[11px] font-bold text-amber-800">Paiement requis</p>
                                                    <p className="text-[10px] text-amber-600">
                                                        Complétez le paiement de <strong>{remaining.toLocaleString('fr-FR')} F</strong> pour demander cette livraison.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Payment proof upload */}
                                        <PaymentProofUpload orderId={order!._id} operationIndex={idx} existingProofs={opProofs} onUploaded={(newOrder) => setOrder(newOrder)} />
                                    </div>
                                )}
                                {canRequest && type === 'delivery' && remaining <= 0 && (
                                    <button
                                        onClick={() => {
                                            setTimeSlotModal({ type: 'delivery', opIndex: idx });
                                            setSelectedTimeSlot('');
                                        }}
                                        disabled={isRequesting}
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-300/30 transition active:scale-[0.97] disabled:opacity-60"
                                    >
                                        {isRequesting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : '🚚'}
                                        {isRequesting ? 'Demande en cours...' : 'Demander la livraison'}
                                    </button>
                                )}
                                {/* ── Rating ── */}
                                {needsRating && (
                                    <button
                                        onClick={() => {
                                            setRatingModal({ opType: type, opIndex: idx });
                                            setRatingValue(0);
                                            setRatingComment('');
                                        }}
                                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-2 text-[11px] font-bold text-amber-700 transition active:scale-[0.97]"
                                    >
                                        ⭐ Évaluez cette opération
                                    </button>
                                )}
                                {op.clientRating && (
                                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50/60 px-2 py-1.5">
                                        <span className="text-sm">{'⭐'.repeat(op.clientRating)}</span>
                                        {op.clientComment && <span className="text-[10px] italic text-slate-500">« {op.clientComment} »</span>}
                                    </div>
                                )}
                                {(op as any).adminResponse && (
                                    <div className="mt-1.5 rounded-lg border-l-2 border-[#4361ee] bg-blue-50/60 px-2.5 py-1.5">
                                        <p className="text-[9px] font-bold text-[#4361ee]">Réponse MIRAI</p>
                                        <p className="text-[10px] text-slate-700">{(op as any).adminResponse}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /* ─── Grouped Operations (pickup + delivery paired) ─── */
    const GroupedOperations = () => {
        const remaining = (order?.totalPrice || 0) - (order?.totalPaid || 0);
        const maxOps = Math.max(pickups.length, deliveries.length);
        return (
            <div className="space-y-3">
                {Array.from({ length: maxOps }, (_, idx) => {
                    const pickup = pickups[idx];
                    const delivery = deliveries[idx];
                    const pickupStatus = pickup ? (pickup.status || 'pending') : null;
                    const deliveryEffective = delivery ? getEffectiveDeliveryStatus(delivery, pickup) : null;
                    const pickupS = pickupStatus ? getS(pickupStatus) : null;
                    const deliveryS = deliveryEffective ? getS(deliveryEffective) : null;
                    const pickupDone = pickup ? !!(pickup.clothesCount && pickup.clothesCount > 0) : false;
                    const deliveryDone = delivery ? ['delivered', 'completed'].includes(deliveryEffective || '') : false;
                    const opPhotos = photosByOp.get(idx) || [];
                    const agentName = (pickup as any)?.deliveryAgentName || pickup?.deliveryAgent || (delivery as any)?.deliveryAgentName || delivery?.deliveryAgent;
                    // Payment required only when delivery status is ready_for_delivery
                    const showPaymentRequired = deliveryEffective === 'ready_for_delivery' && remaining > 0;
                    const opProofs = (order?.paymentProofs || []).filter((p) => p.operationIndex === idx || p.operationIndex === undefined);

                    return (
                        <div key={idx} className="rounded-2xl bg-white shadow-lg shadow-slate-200/40 overflow-hidden">
                            {/* Operation header */}
                            <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white px-4 py-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4361ee]/10 text-[11px] font-bold text-[#4361ee]">{idx + 1}</span>
                                    <span className="text-xs font-bold text-slate-800">Opération {idx + 1}</span>
                                </div>
                                {agentName && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px]">🚗</span>
                                        <span className="text-[10px] font-semibold text-[#4361ee]">{agentName}</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                {/* Pickup section */}
                                {pickup && pickupS && (
                                    <div className={`rounded-xl border p-3 ${pickupDone ? 'border-green-100 bg-green-50/30' : 'border-blue-100 bg-blue-50/20'}`}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-bold text-slate-700">📦 Récupération</p>
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${pickupS.color} ${pickupS.bg}`}>{pickupS.label}</span>
                                        </div>
                                        {pickup.date && (
                                            <p className="mt-0.5 text-[10px] text-slate-400">
                                                {new Date(pickup.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                                {pickup.scheduledTime ? ` · ${pickup.scheduledTime}` : ''}
                                            </p>
                                        )}
                                        {pickup.clothesCount && pickup.clothesCount > 0 && (
                                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                <span className="text-[10px] font-semibold text-blue-700">👔 {pickup.clothesCount} pièces</span>
                                                {pickup.clothesDetails?.filter((d) => d.quantity > 0).map((d, i) => (
                                                    <span key={i} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">{d.name} ×{d.quantity}</span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Photos */}
                                        {opPhotos.length > 0 && (
                                            <div className="mt-2 grid grid-cols-4 gap-1.5">
                                                {opPhotos.slice(0, 4).map((photo, i) => {
                                                    const globalIdx = flatPhotos.indexOf(photo);
                                                    return (
                                                        <button key={i} onClick={() => setLightboxIdx(globalIdx)} className="aspect-square overflow-hidden rounded-lg bg-slate-100 active:scale-95">
                                                            <img src={`/api-proxy${photo.url}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                        </button>
                                                    );
                                                })}
                                                {opPhotos.length > 4 && (
                                                    <button onClick={() => setLightboxIdx(flatPhotos.indexOf(opPhotos[4]))} className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">+{opPhotos.length - 4}</button>
                                                )}
                                            </div>
                                        )}
                                        {/* Request pickup button */}
                                        {(pickup.status || 'pending') === 'pending' && pickup.date && isDateReached(pickup.date) && (
                                            <button
                                                onClick={() => { setTimeSlotModal({ type: 'pickup', opIndex: idx }); setSelectedTimeSlot(''); }}
                                                disabled={requestingOp === `pickup-${idx}`}
                                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4361ee] py-2 text-xs font-bold text-white shadow-md shadow-blue-300/30 transition active:scale-[0.97] disabled:opacity-60"
                                            >
                                                {requestingOp === `pickup-${idx}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : '📦'}
                                                {requestingOp === `pickup-${idx}` ? 'Demande en cours...' : 'Demander la récupération'}
                                            </button>
                                        )}
                                        {pickup.clientRating && (
                                            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50/60 px-2 py-1">
                                                <span className="text-sm">{'⭐'.repeat(pickup.clientRating)}</span>
                                                {pickup.clientComment && <span className="text-[10px] italic text-slate-500">« {pickup.clientComment} »</span>}
                                            </div>
                                        )}
                                        {(pickup as any).adminResponse && (
                                            <div className="mt-1 rounded-lg border-l-2 border-[#4361ee] bg-blue-50/60 px-2.5 py-1.5">
                                                <p className="text-[9px] font-bold text-[#4361ee]">Réponse MIRAI</p>
                                                <p className="text-[10px] text-slate-700">{(pickup as any).adminResponse}</p>
                                            </div>
                                        )}
                                        {pickupDone && !pickup.clientRating && (
                                            <button onClick={() => { setRatingModal({ opType: 'pickup', opIndex: idx }); setRatingValue(0); setRatingComment(''); }} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 py-1.5 text-[10px] font-bold text-amber-700 active:scale-[0.97]">⭐ Évaluer</button>
                                        )}
                                    </div>
                                )}

                                {/* Delivery section */}
                                {delivery && deliveryS && (
                                    <div className={`rounded-xl border p-3 ${deliveryDone ? 'border-green-100 bg-green-50/30' : 'border-emerald-100 bg-emerald-50/20'}`}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-bold text-slate-700">🚚 Livraison</p>
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${deliveryS.color} ${deliveryS.bg}`}>{deliveryS.label}</span>
                                        </div>
                                        {delivery.date && (
                                            <p className="mt-0.5 text-[10px] text-slate-400">
                                                {new Date(delivery.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                                {delivery.scheduledTime ? ` · ${delivery.scheduledTime}` : ''}
                                            </p>
                                        )}
                                        {/* Payment required — only for ready_for_delivery */}
                                        {showPaymentRequired && (
                                            <div className="mt-2 space-y-2">
                                                <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">⚠️</span>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-amber-800">Paiement requis</p>
                                                            <p className="text-[10px] text-amber-600">Restant: <strong>{remaining.toLocaleString('fr-FR')} F</strong></p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <PaymentProofUpload orderId={order!._id} operationIndex={idx} existingProofs={opProofs} onUploaded={(newOrder) => setOrder(newOrder)} />
                                            </div>
                                        )}
                                        {/* Request delivery button */}
                                        {(delivery.status || 'pending') === 'pending' && delivery.date && isDateReached(delivery.date) && remaining <= 0 && (
                                            <button
                                                onClick={() => { setTimeSlotModal({ type: 'delivery', opIndex: idx }); setSelectedTimeSlot(''); }}
                                                disabled={requestingOp === `delivery-${idx}`}
                                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white shadow-md shadow-emerald-300/30 transition active:scale-[0.97] disabled:opacity-60"
                                            >
                                                {requestingOp === `delivery-${idx}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : '🚚'}
                                                {requestingOp === `delivery-${idx}` ? 'Demande en cours...' : 'Demander la livraison'}
                                            </button>
                                        )}
                                        {delivery.clientRating && (
                                            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50/60 px-2 py-1">
                                                <span className="text-sm">{'⭐'.repeat(delivery.clientRating)}</span>
                                                {delivery.clientComment && <span className="text-[10px] italic text-slate-500">« {delivery.clientComment} »</span>}
                                            </div>
                                        )}
                                        {(delivery as any).adminResponse && (
                                            <div className="mt-1 rounded-lg border-l-2 border-[#4361ee] bg-blue-50/60 px-2.5 py-1.5">
                                                <p className="text-[9px] font-bold text-[#4361ee]">Réponse MIRAI</p>
                                                <p className="text-[10px] text-slate-700">{(delivery as any).adminResponse}</p>
                                            </div>
                                        )}
                                        {deliveryDone && !delivery.clientRating && (
                                            <button onClick={() => { setRatingModal({ opType: 'delivery', opIndex: idx }); setRatingValue(0); setRatingComment(''); }} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 py-1.5 text-[10px] font-bold text-amber-700 active:scale-[0.97]">⭐ Évaluer</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /* ─── Payment Proof Upload Component ─── */
    const PaymentProofUpload = ({ orderId, operationIndex, existingProofs, onUploaded }: {
        orderId: string;
        operationIndex: number;
        existingProofs: NonNullable<ClientOrder['paymentProofs']>;
        onUploaded: (_order: ClientOrder) => void;
    }) => {
        const [uploading, setUploading] = React.useState(false);
        const fileRef = React.useRef<HTMLInputElement>(null);

        const handleUpload = async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            setUploading(true);
            try {
                await clientPortalApi.uploadPaymentProof(orderId, Array.from(files), operationIndex);
                // Refresh order to get updated payment proofs
                const updatedOrder = await clientPortalApi.getOrder(orderId);
                onUploaded(updatedOrder);
                Swal.fire({ icon: 'success', title: 'Justificatif envoyé !', text: 'Votre justificatif sera vérifié sous peu.', timer: 2500, showConfirmButton: false });
            } catch (err: any) {
                Swal.fire('Erreur', err?.response?.data?.message || "Impossible d'envoyer le justificatif", 'error');
            } finally {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = '';
            }
        };

        return (
            <div className="space-y-2">
                {/* Existing proofs */}
                {existingProofs.length > 0 && (
                    <div>
                        <p className="text-[10px] font-semibold text-slate-500 mb-1">📎 Justificatifs envoyés</p>
                        <div className="grid grid-cols-3 gap-1.5">
                            {existingProofs.map((proof, i) => (
                                <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                                    <img src={`/api-proxy${proof.url}`} alt="Justificatif" className="h-full w-full object-cover" loading="lazy" />
                                    <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-center text-[8px] font-bold ${proof.verified ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                                        {proof.verified ? '✓ Vérifié' : '⏳ En attente'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Upload button */}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 py-2.5 text-xs font-bold text-blue-700 transition active:scale-[0.97] disabled:opacity-60"
                >
                    {uploading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                            Envoi en cours...
                        </>
                    ) : (
                        <>📸 Envoyer un justificatif de paiement</>
                    )}
                </button>
            </div>
        );
    };

    const paymentPct = (order.totalPrice || 0) > 0 ? Math.min(100, ((order.totalPaid || 0) / (order.totalPrice || 1)) * 100) : 0;

    return (
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
            {/* ═══ Header ═══ */}
            <div className="sticky top-0 z-10 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/portal/orders')} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-extrabold text-slate-800">{order.orderId}</h1>
                        <p className="text-[10px] text-slate-400">
                            {order.type === 'subscription' ? 'Abonnement' : 'À la carte'}
                            {order.packName ? ` · ${order.packName}` : ''}
                        </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${orderStatus.color} ${orderStatus.bg}`}>
                        {orderStatus.icon} {orderStatus.label}
                    </span>
                </div>
            </div>

            <div className="space-y-3 p-4">
                {/* ═══ Order Tracking Card ═══ */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50">
                    <div className="bg-gradient-to-br from-[#4361ee] via-[#3a56e8] to-[#2541d0] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-blue-200">Suivi de commande</p>
                                <p className="mt-0.5 text-lg font-black text-white">{order.orderId}</p>
                            </div>
                            <div className="relative flex items-center justify-center">
                                <CircleProgress pct={paymentPct} size={52} stroke={4} color={remaining <= 0 ? '#10b981' : '#fbbf24'} />
                                <span className="absolute text-[10px] font-black text-white">{Math.round(paymentPct)}%</span>
                            </div>
                        </div>
                        {/* Financial row */}
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-white/10 px-2 py-1.5 text-center backdrop-blur-sm">
                                <p className="text-[9px] text-blue-200">Total</p>
                                <p className="text-xs font-bold text-white">{fmt(order.totalPrice)} F</p>
                            </div>
                            <div className="rounded-lg bg-white/10 px-2 py-1.5 text-center backdrop-blur-sm">
                                <p className="text-[9px] text-blue-200">Payé</p>
                                <p className="text-xs font-bold text-white">{fmt(order.totalPaid)} F</p>
                            </div>
                            <div className="rounded-lg bg-white/10 px-2 py-1.5 text-center backdrop-blur-sm">
                                <p className="text-[9px] text-blue-200">Reste</p>
                                <p className={`text-xs font-bold ${remaining <= 0 ? 'text-green-300' : 'text-amber-300'}`}>{remaining <= 0 ? '✓ Payé' : `${fmt(remaining)} F`}</p>
                            </div>
                        </div>
                    </div>
                    {/* Progress steps */}
                    {order.type === 'subscription' && pickups.length > 0 && (
                        <div className="flex items-center gap-1 px-4 py-2.5">
                            <span className="text-[9px] text-slate-400">
                                📦 {pickups.filter((p) => p.clothesCount && p.clothesCount > 0).length}/{pickups.length}
                            </span>
                            <div className="flex flex-1 gap-0.5">
                                {pickups.map((p, i) => (
                                    <div key={`p${i}`} className={`h-1.5 flex-1 rounded-full ${p.clothesCount && p.clothesCount > 0 ? 'bg-[#4361ee]' : 'bg-white/20'}`} />
                                ))}
                            </div>
                            <span className="mx-1 text-[9px] text-slate-300">|</span>
                            <div className="flex flex-1 gap-0.5">
                                {deliveries.map((d, i) => {
                                    const eff = getEffectiveDeliveryStatus(d, pickups[i]);
                                    return <div key={`d${i}`} className={`h-1.5 flex-1 rounded-full ${['delivered', 'completed'].includes(eff) ? 'bg-emerald-400' : 'bg-white/20'}`} />;
                                })}
                            </div>
                            <span className="text-[9px] text-slate-400">
                                🚚 {deliveries.filter((d, i) => ['delivered', 'completed'].includes(getEffectiveDeliveryStatus(d, pickups[i]))).length}/{deliveries.length}
                            </span>
                        </div>
                    )}
                </div>

                {/* ═══ Pack Usage ═══ */}
                {order.type === 'subscription' && packInfo && usage && (
                    <div className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800">📦 Utilisation du Pack</h3>
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">{packInfo.name}</span>
                        </div>
                        {packInfo.description && <p className="mt-2 rounded-lg bg-blue-50/60 px-3 py-2 text-[10px] leading-relaxed text-blue-600">{packInfo.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                            <span>💰 {fmt(packInfo.price)} F</span>
                            <span>📅 {packInfo.validityDays}j</span>
                            <span>
                                🚚 {packInfo.defaultPickups}R + {packInfo.defaultDeliveries}L
                            </span>
                            {order.subscriptionEndDate && (
                                <span>
                                    ⏰{' '}
                                    {new Date(order.subscriptionEndDate).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'short',
                                    })}
                                </span>
                            )}
                        </div>
                        {/* Usage bars */}
                        <div className="mt-3 space-y-2">
                            {[
                                { label: 'Total', used: usage.totalPieces, limit: packInfo.total, color: '#4361ee' },
                                {
                                    label: 'Vêtements',
                                    used: usage.ordinaires,
                                    limit: packInfo.vetements,
                                    color: '#6366f1',
                                },
                                { label: 'Couettes', used: usage.couettes, limit: packInfo.couettes, color: '#8b5cf6' },
                                { label: 'Vestes', used: usage.vestes, limit: packInfo.vestes, color: '#a855f7' },
                                {
                                    label: 'Draps & Serviettes',
                                    used: usage.drapsServiettes,
                                    limit: packInfo.draps_serviettes,
                                    color: '#06b6d4',
                                },
                            ].map((b) => {
                                const pct = b.limit > 0 ? Math.min(100, (b.used / b.limit) * 100) : 0;
                                const rem = Math.max(0, b.limit - b.used);
                                const over = b.used > b.limit;
                                return (
                                    <div key={b.label}>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-medium text-slate-600">{b.label}</span>
                                            <span className={`font-bold ${over ? 'text-red-500' : 'text-slate-700'}`}>
                                                {b.used}/{b.limit}
                                                {rem > 0 && (
                                                    <span className="ml-1 font-normal text-slate-400">
                                                        ({rem} restant{rem > 1 ? 's' : ''})
                                                    </span>
                                                )}
                                                {over && <span className="ml-1 text-red-400">(+{b.used - b.limit})</span>}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${Math.min(100, pct)}%`,
                                                    background: over ? '#ef4444' : b.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ═══ Surplus ═══ */}
                {surplusInfo && surplusInfo.hasExtra && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                        <h3 className="text-xs font-bold text-amber-700">⚡ Surplus & Extras</h3>
                        <div className="mt-2 space-y-1">
                            {surplusInfo.extraOrdinaires > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-700">Vêtements</span>
                                    <span className="font-bold text-amber-700">+{surplusInfo.extraOrdinaires}</span>
                                </div>
                            )}
                            {surplusInfo.extraCouettes > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-700">Couettes</span>
                                    <span className="font-bold text-amber-700">+{surplusInfo.extraCouettes}</span>
                                </div>
                            )}
                            {surplusInfo.extraVestes > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-700">Vestes</span>
                                    <span className="font-bold text-amber-700">+{surplusInfo.extraVestes}</span>
                                </div>
                            )}
                            {surplusInfo.extraDrapsServiettes > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-700">Draps & Serviettes</span>
                                    <span className="font-bold text-amber-700">+{surplusInfo.extraDrapsServiettes}</span>
                                </div>
                            )}
                            {surplusInfo.totalSurplus > 0 && (
                                <div className="flex justify-between border-t border-amber-200 pt-1.5 text-xs">
                                    <span className="font-bold text-slate-700">Total</span>
                                    <span className="font-black text-amber-700">{fmt(surplusInfo.totalSurplus)} F</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ DB surplus fallback ═══ */}
                {surplus.length > 0 && !surplusInfo?.hasExtra && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
                        <h3 className="mb-2 text-xs font-bold text-amber-600">⚡ Surplus</h3>
                        <div className="space-y-1">
                            {surplus.map((s, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                    <span className="text-slate-700">
                                        {s.name} ×{s.quantity}
                                    </span>
                                    <span className="font-bold text-amber-700">{fmt(s.total)} F</span>
                                </div>
                            ))}
                            <div className="flex justify-between border-t border-amber-200 pt-1.5 text-xs">
                                <span className="font-bold">Total</span>
                                <span className="font-black text-amber-700">{fmt(order.surplusAmount)} F</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Details ═══ */}
                <div className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                    <h3 className="mb-3 text-xs font-bold text-slate-800">📋 Informations</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {order.serviceType && <InfoCell label="Service" value={order.serviceType} />}
                        <InfoCell
                            label="Créée le"
                            value={new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                            })}
                        />
                        {order.subscriptionStartDate && (
                            <InfoCell
                                label="Début"
                                value={new Date(order.subscriptionStartDate).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            />
                        )}
                        {order.subscriptionEndDate && (
                            <InfoCell
                                label="Fin"
                                value={new Date(order.subscriptionEndDate).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            />
                        )}
                        {order.basePickupCount !== undefined && <InfoCell label="Récup. incluses" value={`${order.basePickupCount}`} />}
                        {order.note && (
                            <div className="col-span-2">
                                <InfoCell label="Note" value={order.note} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Grouped Operations (subscription) ═══ */}
                {order.type === 'subscription' && (pickups.length > 0 || deliveries.length > 0) && (
                    <div>
                        <div className="mb-2 flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold text-slate-800">🔄 Opérations</h3>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                                {Math.max(pickups.length, deliveries.length)} op.
                            </span>
                        </div>
                        <GroupedOperations />
                    </div>
                )}

                {/* ═══ À la carte — simple status ═══ */}
                {order.type === 'a-la-carte' && (
                    <div className="space-y-3">
                        {/* Order status card */}
                        <div className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-800">📋 Statut de la commande</h3>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${getS(order.status).color} ${getS(order.status).bg}`}>
                                    {getS(order.status).icon} {getS(order.status).label}
                                </span>
                            </div>
                            {/* Show pickup & delivery info inline */}
                            {order.pickup && (
                                <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-3 mb-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-bold text-slate-700">📦 Récupération</p>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${getS(order.status).color} ${getS(order.status).bg}`}>{getS(order.status).label}</span>
                                    </div>
                                    {order.pickup.date && (
                                        <p className="mt-0.5 text-[10px] text-slate-400">
                                            {new Date(order.pickup.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                        </p>
                                    )}
                                    {order.pickup.clothesCount && order.pickup.clothesCount > 0 && (
                                        <p className="mt-1 text-[10px] font-semibold text-blue-700">👔 {order.pickup.clothesCount} pièces</p>
                                    )}
                                </div>
                            )}
                            {order.delivery && (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-bold text-slate-700">🚚 Livraison</p>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${getS(order.status).color} ${getS(order.status).bg}`}>{getS(order.status).label}</span>
                                    </div>
                                    {order.delivery.date && (
                                        <p className="mt-0.5 text-[10px] text-slate-400">
                                            {new Date(order.delivery.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                        </p>
                                    )}
                                    {/* Payment required for à la carte when ready_for_delivery */}
                                    {order.status === 'ready_for_delivery' && remaining > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">⚠️</span>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-amber-800">Paiement requis</p>
                                                        <p className="text-[10px] text-amber-600">Restant: <strong>{remaining.toLocaleString('fr-FR')} F</strong></p>
                                                    </div>
                                                </div>
                                            </div>
                                            <PaymentProofUpload orderId={order._id} operationIndex={0} existingProofs={order.paymentProofs || []} onUploaded={(newOrder) => setOrder(newOrder)} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ Payments ═══ */}
                {(payments.length > 0 || (order.paymentProofs && order.paymentProofs.length > 0)) && (
                    <div className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                        <button onClick={() => toggle('payments')} className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm">💰</span>
                                <div>
                                    <p className="text-xs font-bold text-slate-800">Paiements</p>
                                    <p className="text-[10px] text-slate-400">
                                        {payments.length} paiement{payments.length > 1 ? 's' : ''} · {fmt(order.totalPaid)} F
                                    </p>
                                </div>
                            </div>
                            <svg className={`h-5 w-5 text-slate-400 transition-transform ${openSections.has('payments') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {openSections.has('payments') && (
                            <div className="mt-3 space-y-2">
                                {payments.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{fmt(p.amount)} FCFA</p>
                                            <p className="text-[10px] text-slate-400">
                                                {PMETHODS[p.method] || p.method} ·{' '}
                                                {new Date(p.paidAt).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: '2-digit',
                                                })}
                                            </p>
                                            {p.reference && <p className="text-[9px] text-slate-300">Réf: {p.reference}</p>}
                                        </div>
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs">✅</div>
                                    </div>
                                ))}
                                {/* Payment proof images */}
                                {order.paymentProofs && order.paymentProofs.length > 0 && (
                                    <div className="mt-3 border-t border-slate-100 pt-3">
                                        <p className="text-[10px] font-bold text-slate-600 mb-2">📎 Justificatifs de paiement</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {order.paymentProofs.map((proof, i) => (
                                                <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 shadow-sm">
                                                    <img src={`/api-proxy${proof.url}`} alt="Justificatif" className="h-full w-full object-cover" loading="lazy" />
                                                    <div className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-center text-[8px] font-bold ${proof.verified ? 'bg-green-500/90 text-white' : 'bg-amber-400/90 text-white'}`}>
                                                        {proof.verified ? '✓ Vérifié' : '⏳ En attente'}
                                                    </div>
                                                    <div className="absolute top-1 right-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[7px] text-white">
                                                        {new Date(proof.uploadedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Global Comments Section ═══ */}
            <div className="mx-5 mb-4 rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                <h3 className="text-[13px] font-bold text-slate-800">💬 Commentaires</h3>
                {/* Existing comments */}
                {order.clientComments && order.clientComments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {order.clientComments.map((c, i) => (
                            <div key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-[11px] text-slate-700">{c.text}</p>
                                <p className="mt-0.5 text-[9px] text-slate-400">
                                    {c.createdAt
                                        ? new Date(c.createdAt).toLocaleDateString('fr-FR', {
                                              day: '2-digit',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : ''}
                                    {c.operationType ? ` · ${c.operationType === 'pickup' ? 'Récup.' : 'Livr.'} ${(c.operationIndex || 0) + 1}` : ' · Général'}
                                </p>
                                {(c as any).adminResponse && (
                                    <div className="mt-1.5 rounded-lg border-l-2 border-[#4361ee] bg-blue-50/60 px-2.5 py-1.5">
                                        <p className="text-[9px] font-bold text-[#4361ee]">Réponse MIRAI</p>
                                        <p className="text-[10px] text-slate-700">{(c as any).adminResponse}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {/* Comment input */}
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Ajouter un commentaire..."
                        className="h-10 flex-1 rounded-xl border-2 border-slate-100 bg-slate-50/60 px-3 text-[12px] outline-none transition-all placeholder:text-slate-300 focus:border-[#4361ee] focus:bg-white"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment();
                        }}
                    />
                    <button
                        onClick={handleAddComment}
                        disabled={commentSaving || !commentText.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4361ee] text-white shadow-md shadow-blue-300/30 transition active:scale-90 disabled:opacity-40"
                    >
                        {commentSaving ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ Time-Slot Picker Modal ═══ */}
            {timeSlotModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setTimeSlotModal(null)}>
                    <div className="w-full max-w-lg animate-slideUp rounded-t-3xl bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6" onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
                        <h3 className="text-center text-lg font-extrabold text-slate-800">
                            {timeSlotModal.type === 'pickup' ? '📦 Récupération' : '🚚 Livraison'} {timeSlotModal.opIndex + 1}
                        </h3>
                        <p className="mt-1 text-center text-[12px] text-slate-400">Choisissez un créneau horaire préféré</p>

                        <div className="mt-5 grid grid-cols-2 gap-2.5">
                            {[
                                { value: 'Matin (8h-12h)', label: 'Matin', sub: '8h — 12h', icon: '🌅' },
                                { value: 'Après-midi (12h-17h)', label: 'Après-midi', sub: '12h — 17h', icon: '☀️' },
                                { value: 'Soir (17h-20h)', label: 'Soir', sub: '17h — 20h', icon: '🌇' },
                                { value: '', label: 'Peu importe', sub: 'Pas de préférence', icon: '🕐' },
                            ].map((slot) => (
                                <button
                                    key={slot.label}
                                    onClick={() => setSelectedTimeSlot(slot.value)}
                                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition-all active:scale-95 ${
                                        selectedTimeSlot === slot.value ? 'border-[#4361ee] bg-[#4361ee]/5 shadow-md shadow-blue-200/40' : 'border-slate-100 bg-slate-50/50'
                                    }`}
                                >
                                    <span className="text-2xl">{slot.icon}</span>
                                    <span className={`text-[13px] font-bold ${selectedTimeSlot === slot.value ? 'text-[#4361ee]' : 'text-slate-700'}`}>{slot.label}</span>
                                    <span className="text-[10px] text-slate-400">{slot.sub}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={async () => {
                                const { type, opIndex } = timeSlotModal;
                                setTimeSlotModal(null);
                                if (type === 'pickup') {
                                    await handleRequestPickup(opIndex, selectedTimeSlot || undefined);
                                } else {
                                    await handleRequestDelivery(opIndex, selectedTimeSlot || undefined);
                                }
                            }}
                            className={`mt-5 h-[50px] w-full rounded-2xl text-[14px] font-bold text-white shadow-xl transition-all active:scale-[0.97] ${
                                timeSlotModal.type === 'pickup'
                                    ? 'bg-gradient-to-r from-[#4361ee] to-[#3a56e8] shadow-blue-600/20'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-600/20'
                            }`}
                        >
                            {timeSlotModal.type === 'pickup' ? '📦 Confirmer la récupération' : '🚚 Confirmer la livraison'}
                        </button>
                        <button onClick={() => setTimeSlotModal(null)} className="mt-2 w-full py-2 text-[12px] font-medium text-slate-400 transition active:scale-95">
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ Rating Modal ═══ */}
            {ratingModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRatingModal(null)}>
                    <div className="w-full max-w-lg animate-slideUp rounded-t-3xl bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6" onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
                        <h3 className="text-center text-lg font-extrabold text-slate-800">Évaluez cette opération</h3>
                        <p className="mt-1 text-center text-[12px] text-slate-400">
                            {ratingModal.opType === 'pickup' ? 'Récupération' : 'Livraison'} {ratingModal.opIndex + 1}
                        </p>
                        {/* Stars */}
                        <div className="mt-5 flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRatingValue(star)}
                                    className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all active:scale-90 ${
                                        star <= ratingValue ? 'bg-amber-100 shadow-md shadow-amber-200/50' : 'bg-slate-50'
                                    }`}
                                >
                                    {star <= ratingValue ? '⭐' : '☆'}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-center text-[11px] text-slate-400">
                            {ratingValue === 0 ? 'Touchez une étoile' : ratingValue <= 2 ? 'Peut mieux faire' : ratingValue <= 3 ? 'Correct' : ratingValue === 4 ? 'Très bien' : 'Excellent !'}
                        </p>
                        {/* Comment */}
                        <textarea
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Un commentaire ? (facultatif)"
                            rows={2}
                            className="mt-4 w-full rounded-2xl border-2 border-slate-100 bg-slate-50/60 px-4 py-3 text-[13px] outline-none transition placeholder:text-slate-300 focus:border-[#4361ee] focus:bg-white"
                        />
                        {/* Submit */}
                        <button
                            onClick={handleSubmitRating}
                            disabled={ratingValue < 1 || ratingSaving}
                            className="mt-4 h-[50px] w-full rounded-2xl bg-gradient-to-r from-[#4361ee] to-[#3a56e8] text-[14px] font-bold text-white shadow-xl shadow-blue-600/20 transition-all active:scale-[0.97] disabled:opacity-40"
                        >
                            {ratingSaving ? 'Envoi...' : 'Envoyer mon avis'}
                        </button>
                        <button onClick={() => setRatingModal(null)} className="mt-2 w-full py-2 text-[12px] font-medium text-slate-400 transition active:scale-95">
                            Plus tard
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ Photo Lightbox ═══ */}
            {lightboxIdx !== null && flatPhotos[lightboxIdx] && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" onClick={() => setLightboxIdx(null)}>
                    <div className="flex shrink-0 items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div>
                            <p className="text-xs font-bold text-white/80">
                                {lightboxIdx + 1} / {flatPhotos.length}
                            </p>
                            <p className="text-[10px] text-white/50">
                                {flatPhotos[lightboxIdx].type === 'articles' ? 'Articles' : flatPhotos[lightboxIdx].type === 'bags' ? 'Sacs' : 'Photo'}
                                {flatPhotos[lightboxIdx].operationIndex !== undefined ? ` · Récup. ${flatPhotos[lightboxIdx].operationIndex + 1}` : ''}
                            </p>
                        </div>
                        <button onClick={() => setLightboxIdx(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95">
                            ✕
                        </button>
                    </div>
                    <div className="flex flex-1 items-center justify-center overflow-hidden px-2" onClick={(e) => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api-proxy${flatPhotos[lightboxIdx].url}`} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex shrink-0 items-center justify-center gap-6 px-4 py-4 pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setLightboxIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : flatPhotos.length - 1))}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white active:scale-90"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex max-w-[200px] gap-1.5 overflow-x-auto">
                            {flatPhotos.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setLightboxIdx(i)}
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${i === lightboxIdx ? 'scale-150 bg-white' : 'bg-white/30'}`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setLightboxIdx((prev) => (prev !== null && prev < flatPhotos.length - 1 ? prev + 1 : 0))}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white active:scale-90"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <PortalBottomNav />
        </div>
    );
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700">{value}</p>
        </div>
    );
}

