'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { ClientOrder, clientPortalApi, ClientProfile, OperationInfo } from '@/lib/api/client-portal';

const BLUE = '#4361ee';
const STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏳' },
    confirmed: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-50', icon: '✅' },
    registered: { label: 'Enregistrée', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: '📝' },
    processing: { label: 'En traitement', color: 'text-violet-700', bg: 'bg-violet-50', icon: '🔄' },
    in_progress: { label: 'En cours', color: 'text-violet-700', bg: 'bg-violet-50', icon: '🔄' },
    ready_for_delivery: { label: 'Prêt', color: 'text-teal-700', bg: 'bg-teal-50', icon: '✨' },
    out_for_delivery: { label: 'En livraison', color: 'text-sky-700', bg: 'bg-sky-50', icon: '🚚' },
    delivered: { label: 'Livré', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '✅' },
    completed: { label: 'Terminée', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🏁' },
    cancelled: { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-50', icon: '❌' },
    active: { label: 'Actif', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🟢' },
    stopped: { label: 'Arrêté', color: 'text-red-700', bg: 'bg-red-50', icon: '🔴' },
};
const getS = (s: string) => STATUS[s] || { label: s, color: 'text-slate-600', bg: 'bg-slate-50', icon: '❓' };
const fmt = (n?: number | null) => (n ?? 0).toLocaleString('fr-FR');

function getEffDelivery(d: OperationInfo, p?: OperationInfo): string {
    const ds = d.status || 'pending';
    if (ds !== 'pending') return ds;
    if (!p) return ds;
    const ps = p.status || 'pending';
    const M: Record<string, string> = {
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
    return M[ps] || ds;
}

export default function PortalDashboard() {
    const router = useRouter();
    const [client, setClient] = useState<ClientProfile | null>(null);
    const [orders, setOrders] = useState<ClientOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── Pull-to-refresh ──
    const pullRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const pulling = useRef(false);
    const [pullDistance, setPullDistance] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const [me, ord] = await Promise.all([clientPortalApi.getMe(), clientPortalApi.getOrders()]);
            setClient(me);
            setOrders(ord);
            localStorage.setItem('portal_client', JSON.stringify(me));
        } catch (err: any) {
            if (err?.response?.status === 401) {
                localStorage.removeItem('portal_auth');
                localStorage.removeItem('portal_client');
                router.replace('/portal/login');
            }
        }
    }, [router]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    useEffect(() => {
        if (localStorage.getItem('portal_auth') !== 'true') {
            router.replace('/portal/login');
            return;
        }
        const cached = localStorage.getItem('portal_client');
        if (cached)
            try {
                setClient(JSON.parse(cached));
            } catch {}
        fetchData().finally(() => setLoading(false));
    }, [router, fetchData]);

    // Pull-to-refresh touch handlers
    useEffect(() => {
        const el = pullRef.current;
        if (!el) return;
        const onTouchStart = (e: TouchEvent) => {
            if (el.scrollTop <= 0) {
                startY.current = e.touches[0].clientY;
                pulling.current = true;
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!pulling.current) return;
            const dy = Math.max(0, e.touches[0].clientY - startY.current);
            setPullDistance(Math.min(dy * 0.4, 80));
        };
        const onTouchEnd = () => {
            if (pullDistance > 50) handleRefresh();
            pulling.current = false;
            setPullDistance(0);
        };
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [pullDistance, handleRefresh]);

    const firstName = client?.name?.split(' ')[0] || '';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const activeOrders = useMemo(() => orders.filter((o) => !['completed', 'cancelled', 'delivered'].includes(o.type === 'subscription' ? o.subscriptionStatus || o.status : o.status)), [orders]);

    const nextOp = useMemo(() => {
        const now = Date.now();
        const ops: { type: 'pickup' | 'delivery'; op: OperationInfo; orderId: string; orderDbId: string }[] = [];
        for (const o of orders) {
            for (const p of o.pickupSchedule || [])
                if (p.date && ['pending', 'confirmed'].includes(p.status || ''))
                    ops.push({
                        type: 'pickup',
                        op: p,
                        orderId: o.orderId,
                        orderDbId: o._id,
                    });
            for (const d of o.deliverySchedule || [])
                if (d.date && ['pending', 'confirmed', 'ready_for_delivery', 'out_for_delivery'].includes(d.status || ''))
                    ops.push({
                        type: 'delivery',
                        op: d,
                        orderId: o.orderId,
                        orderDbId: o._id,
                    });
            if (o.pickup?.date && ['pending', 'confirmed'].includes(o.pickup.status || ''))
                ops.push({
                    type: 'pickup',
                    op: o.pickup,
                    orderId: o.orderId,
                    orderDbId: o._id,
                });
            if (o.delivery?.date && ['pending', 'confirmed', 'ready_for_delivery', 'out_for_delivery'].includes(o.delivery.status || ''))
                ops.push({
                    type: 'delivery',
                    op: o.delivery,
                    orderId: o.orderId,
                    orderDbId: o._id,
                });
        }
        return ops.filter((x) => new Date(x.op.date).getTime() >= now - 86400000).sort((a, b) => new Date(a.op.date).getTime() - new Date(b.op.date).getTime())[0] || null;
    }, [orders]);

    const pay = useMemo(() => {
        let total = 0,
            paid = 0;
        for (const o of orders) {
            total += o.totalPrice || 0;
            paid += o.totalPaid || 0;
        }
        return { total, paid, rem: total - paid, pct: total > 0 ? Math.min(100, (paid / total) * 100) : 0 };
    }, [orders]);

    // Count operations the client can request today
    const requestableCount = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let count = 0;
        for (const o of orders) {
            for (const p of o.pickupSchedule || []) {
                if ((p.status || 'pending') === 'pending' && p.date) {
                    const d = new Date(p.date);
                    d.setHours(0, 0, 0, 0);
                    if (d <= today) count++;
                }
            }
            for (const d of o.deliverySchedule || []) {
                if (['pending', 'ready_for_delivery'].includes(d.status || 'pending') && d.date) {
                    const dd = new Date(d.date);
                    dd.setHours(0, 0, 0, 0);
                    if (dd <= today) count++;
                }
            }
        }
        return count;
    }, [orders]);

    // Count pending ratings
    const pendingRatings = useMemo(() => {
        let count = 0;
        for (const o of orders) {
            for (const p of o.pickupSchedule || []) if (p.clothesCount && p.clothesCount > 0 && !p.clientRating) count++;
            for (const d of o.deliverySchedule || []) if (['delivered', 'completed'].includes(d.status || '')) if (!d.clientRating) count++;
        }
        return count;
    }, [orders]);

    // Live delivery tracking (any order with out_for_delivery status)
    const liveDelivery = useMemo(() => {
        for (const o of orders) {
            for (const d of o.deliverySchedule || []) {
                if (d.status === 'out_for_delivery') {
                    return { order: o, op: d };
                }
            }
            if (o.delivery?.status === 'out_for_delivery') {
                return { order: o, op: o.delivery };
            }
        }
        return null;
    }, [orders]);

    if (loading && !client)
        return (
            <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
                {/* Skeleton Header */}
                <div className="rounded-b-[32px] bg-gradient-to-br from-[#4361ee] via-[#3a56e8] to-[#2541d0] px-6 pb-24 pt-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
                            <div className="mt-2 h-7 w-32 animate-pulse rounded bg-white/20" />
                        </div>
                        <div className="h-[50px] w-[50px] animate-pulse rounded-[16px] bg-white/20" />
                    </div>
                </div>
                {/* Skeleton Stats */}
                <div className="-mt-14 px-5">
                    <div className="grid grid-cols-3 gap-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="animate-pulse rounded-2xl bg-white p-3.5 shadow-lg shadow-slate-200/50">
                                <div className="mb-2 h-9 w-9 rounded-xl bg-slate-100" />
                                <div className="h-5 w-8 rounded bg-slate-100" />
                                <div className="mt-1 h-2 w-12 rounded bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Skeleton Orders */}
                <div className="mt-5 space-y-3 px-5">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/40">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-slate-100" />
                                <div className="flex-1">
                                    <div className="h-4 w-24 rounded bg-slate-100" />
                                    <div className="mt-1 h-3 w-32 rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="mt-3 h-10 rounded-xl bg-slate-50" />
                        </div>
                    ))}
                </div>
                <PortalBottomNav />
            </div>
        );

    return (
        <div ref={pullRef} className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
            {/* ═══ Pull-to-refresh indicator ═══ */}
            {(pullDistance > 0 || refreshing) && (
                <div
                    className="flex items-center justify-center overflow-hidden transition-all"
                    style={{ height: refreshing ? 48 : pullDistance }}
                >
                    <div className={`h-6 w-6 rounded-full border-[3px] border-slate-200 border-t-[#4361ee] ${refreshing || pullDistance > 50 ? 'animate-spin' : ''}`} />
                </div>
            )}
            {/* ═══ Hero Header ═══ */}
            <div className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#4361ee] via-[#3a56e8] to-[#2541d0] px-6 pb-24 pt-10">
                <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/[0.05]" />
                <div className="absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-white/[0.04]" />
                <div className="absolute right-12 top-1/2 h-20 w-20 rounded-full bg-white/[0.03]" />

                <div className="relative flex items-center justify-between">
                    <div>
                        <p className="text-[13px] font-medium text-blue-200/70">{greeting} 👋</p>
                        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-white">{firstName}</h1>
                        {client?.location && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-blue-200/60">
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                {client.location}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => router.push('/portal/profile')}
                        className="flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-[16px] bg-white shadow-lg shadow-blue-900/20 transition active:scale-90"
                    >
                        <Image src="/mirai-logo.png" alt="Mirai" width={34} height={34} />
                    </button>
                </div>
            </div>

            {/* ═══ Floating Stats ═══ */}
            <div className="-mt-14 px-5">
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            n: activeOrders.length,
                            label: 'En cours',
                            emoji: '📦',
                            bg: 'bg-blue-50',
                            color: 'text-[#4361ee]',
                        },
                        {
                            n: orders.length,
                            label: 'Commandes',
                            emoji: '📋',
                            bg: 'bg-emerald-50',
                            color: 'text-emerald-600',
                        },
                        {
                            n: pay.rem > 0 ? `${Math.round(pay.pct)}%` : '✓',
                            label: pay.rem > 0 ? 'Payé' : 'À jour',
                            emoji: '💰',
                            bg: pay.rem > 0 ? 'bg-amber-50' : 'bg-emerald-50',
                            color: pay.rem > 0 ? 'text-amber-600' : 'text-emerald-600',
                        },
                    ].map((s, i) => (
                        <div key={i} className="rounded-2xl bg-white p-3.5 shadow-lg shadow-slate-200/50">
                            <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} text-[15px]`}>{s.emoji}</div>
                            <p className={`text-[22px] font-extrabold ${s.color}`}>{s.n}</p>
                            <p className="text-[10px] font-medium text-slate-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 space-y-4 px-5">
                {/* ═══ Live Delivery Tracking Banner ═══ */}
                {liveDelivery && (
                    <button
                        onClick={() => router.push(`/portal/orders/${liveDelivery.order._id}`)}
                        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-0 text-left shadow-xl shadow-emerald-200/50 transition active:scale-[0.98]"
                    >
                        {/* Animated background pattern */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="animate-pulse-slow absolute -left-4 top-1/2 -translate-y-1/2 text-[60px] opacity-10">🚚</div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[40px] opacity-10">📍</div>
                        </div>
                        <div className="relative flex items-center gap-3 px-4 py-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                                <span className="animate-bounce text-2xl">🚚</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                                    </span>
                                    <p className="text-[13px] font-extrabold text-white">En route vers vous !</p>
                                </div>
                                <p className="mt-0.5 text-[11px] font-medium text-white/70">
                                    {(liveDelivery.op as any).deliveryAgentName || 'Votre livreur'} est en chemin
                                    {liveDelivery.op.scheduledTime ? ` · ${liveDelivery.op.scheduledTime}` : ''}
                                </p>
                            </div>
                            <svg className="h-5 w-5 text-white/50 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </button>
                )}

                {/* ═══ Quick Actions ═══ */}
                {(requestableCount > 0 || pendingRatings > 0) && (
                    <div className="flex gap-2.5">
                        {requestableCount > 0 && (
                            <button
                                onClick={() => router.push('/portal/orders')}
                                className="flex flex-1 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#4361ee]/10 to-blue-50 p-3.5 text-left transition active:scale-[0.97]"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4361ee] text-base text-white shadow-md shadow-blue-300/30">📋</div>
                                <div>
                                    <p className="text-[13px] font-bold text-[#4361ee]">{requestableCount} à demander</p>
                                    <p className="text-[10px] text-slate-400">Récup. / livraisons prêtes</p>
                                </div>
                            </button>
                        )}
                        {pendingRatings > 0 && (
                            <button
                                onClick={() => router.push('/portal/orders')}
                                className="flex flex-1 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/50 p-3.5 text-left transition active:scale-[0.97]"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-base text-white shadow-md shadow-amber-300/30">⭐</div>
                                <div>
                                    <p className="text-[13px] font-bold text-amber-700">{pendingRatings} à évaluer</p>
                                    <p className="text-[10px] text-slate-400">Donnez votre avis</p>
                                </div>
                            </button>
                        )}
                    </div>
                )}
                {/* ═══ Next Operation ═══ */}
                {nextOp && (
                    <button
                        onClick={() => router.push(`/portal/orders/${nextOp.orderDbId}`)}
                        className="group w-full overflow-hidden rounded-2xl bg-white p-0 text-left shadow-lg shadow-slate-200/50 transition active:scale-[0.98]"
                    >
                        <div className={`px-4 py-3 ${nextOp.type === 'pickup' ? 'bg-gradient-to-r from-[#4361ee] to-[#5a7aff]' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg backdrop-blur-sm">{nextOp.type === 'pickup' ? '📦' : '🚚'}</div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{nextOp.type === 'pickup' ? 'Prochaine récupération' : 'Prochaine livraison'}</p>
                                    <p className="text-[14px] font-extrabold text-white">
                                        {new Date(nextOp.op.date).toLocaleDateString('fr-FR', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                        })}
                                    </p>
                                </div>
                                <svg className="h-5 w-5 text-white/40 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5">
                            {nextOp.op.scheduledTime && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 6v6l4 2" />
                                    </svg>
                                    {nextOp.op.scheduledTime}
                                </span>
                            )}
                            <span className="text-[11px] text-slate-300">{nextOp.orderId}</span>
                        </div>
                    </button>
                )}

                {/* ═══ Payment Card ═══ */}
                {pay.total > 0 && (
                    <div className="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-slate-800">Paiements</h3>
                            {pay.rem <= 0 ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">✓ À jour</span>
                            ) : (
                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-500">{fmt(pay.rem)} F restant</span>
                            )}
                        </div>
                        <div className="mt-4 flex items-end gap-4">
                            <div className="flex-1">
                                <p className="text-[10px] font-medium text-slate-400">Payé</p>
                                <p className="text-[26px] font-extrabold leading-none text-slate-800">
                                    {fmt(pay.paid)}
                                    <span className="ml-1 text-[13px] font-semibold text-slate-400">F</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400">Total</p>
                                <p className="text-[14px] font-bold text-slate-500">{fmt(pay.total)} F</p>
                            </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${pay.pct}%`,
                                    background: pay.rem <= 0 ? '#10b981' : `linear-gradient(90deg, ${BLUE}, #5a7aff)`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* ═══ Recent Orders ═══ */}
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-[15px] font-extrabold text-slate-800">Mes commandes</h2>
                        {orders.length > 3 && (
                            <button onClick={() => router.push('/portal/orders')} className="text-[12px] font-bold text-[#4361ee] transition active:scale-95">
                                Voir tout →
                            </button>
                        )}
                    </div>

                    {orders.length === 0 && !loading && (
                        <div className="rounded-2xl bg-white py-14 text-center shadow-sm">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                                <span className="text-3xl">📦</span>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-400">Aucune commande</p>
                            <p className="mt-1 text-[11px] text-slate-300">Vos commandes apparaîtront ici</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {orders.slice(0, 5).map((order) => {
                            const s = getS(order.type === 'subscription' ? order.subscriptionStatus || order.status : order.status);
                            const pickups = order.pickupSchedule || [];
                            const deliveries = order.deliverySchedule || [];
                            const doneP = pickups.filter((p) => p.clothesCount && p.clothesCount > 0).length;
                            const doneD = deliveries.filter((d, i) => ['delivered', 'completed'].includes(getEffDelivery(d, pickups[i]))).length;
                            const rem = (order.totalPrice || 0) - (order.totalPaid || 0);
                            const next =
                                pickups.find((p) => p.date && ['pending', 'confirmed'].includes(p.status || '')) ||
                                deliveries.find((d) => d.date && ['pending', 'confirmed', 'ready_for_delivery'].includes(d.status || ''));

                            return (
                                <button
                                    key={order._id}
                                    onClick={() => router.push(`/portal/orders/${order._id}`)}
                                    className="group w-full rounded-2xl bg-white p-4 text-left shadow-lg shadow-slate-200/40 transition active:scale-[0.98]"
                                >
                                    {/* Header */}
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-[17px] ${s.bg}`}>{s.icon}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="truncate text-[14px] font-bold text-slate-800">{order.orderId}</p>
                                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${s.color} ${s.bg}`}>{s.label}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {order.type === 'subscription' ? 'Abonnement' : 'À la carte'}
                                                {order.packName ? ` · ${order.packName}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Finance row */}
                                    <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2">
                                        <div>
                                            <p className="text-[9px] text-slate-400">Montant</p>
                                            <p className="text-[13px] font-bold text-slate-800">{fmt(order.totalPrice)} F</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] text-slate-400">Payé</p>
                                            <p className={`text-[13px] font-bold ${rem <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(order.totalPaid)} F</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-slate-400">Créée</p>
                                            <p className="text-[11px] font-semibold text-slate-500">
                                                {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    {order.type === 'subscription' && pickups.length > 0 && (
                                        <div className="mt-2.5">
                                            <div className="flex items-center justify-between text-[9px] text-slate-400">
                                                <span>
                                                    📦 {doneP}/{pickups.length} récup.
                                                </span>
                                                <span>
                                                    🚚 {doneD}/{deliveries.length} livr.
                                                </span>
                                            </div>
                                            <div className="mt-1 flex gap-[3px]">
                                                {pickups.map((_, i) => (
                                                    <div key={`p${i}`} className={`h-[5px] flex-1 rounded-full transition-colors ${i < doneP ? 'bg-[#4361ee]' : 'bg-slate-200'}`} />
                                                ))}
                                                <div className="w-2" />
                                                {deliveries.map((_, i) => (
                                                    <div key={`d${i}`} className={`h-[5px] flex-1 rounded-full transition-colors ${i < doneD ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                ))}
                                            </div>
                                            {next && (
                                                <p className="mt-1.5 text-[10px] font-medium text-[#4361ee]">
                                                    📅 Prochain:{' '}
                                                    {new Date(next.date).toLocaleDateString('fr-FR', {
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short',
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <PortalBottomNav />
        </div>
    );
}
