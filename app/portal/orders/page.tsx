'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { ClientOrder, clientPortalApi, OperationInfo } from '@/lib/api/client-portal';

function getEffectiveDeliveryStatus(delivery: OperationInfo, pickup?: OperationInfo): string {
    const dStatus = delivery.status || 'pending';
    if (dStatus !== 'pending') return dStatus;
    if (!pickup) return dStatus;
    const pStatus = pickup.status || 'pending';
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

/* ─── Maps ──────────────────────────────────────────── */
const STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50', icon: '⏳' },
    confirmed: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-50', icon: '✅' },
    registered: { label: 'Enregistrée', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: '📝' },
    processing: { label: 'En traitement', color: 'text-purple-700', bg: 'bg-purple-50', icon: '🔄' },
    in_progress: { label: 'En cours', color: 'text-purple-700', bg: 'bg-purple-50', icon: '🔄' },
    ready_for_delivery: { label: 'Prêt', color: 'text-teal-700', bg: 'bg-teal-50', icon: '✨' },
    out_for_delivery: { label: 'En livraison', color: 'text-sky-700', bg: 'bg-sky-50', icon: '🚚' },
    delivered: { label: 'Livré', color: 'text-green-700', bg: 'bg-green-50', icon: '✅' },
    completed: { label: 'Terminée', color: 'text-green-700', bg: 'bg-green-50', icon: '🏁' },
    cancelled: { label: 'Annulée', color: 'text-red-700', bg: 'bg-red-50', icon: '❌' },
    active: { label: 'Actif', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: '🟢' },
    stopped: { label: 'Arrêté', color: 'text-red-700', bg: 'bg-red-50', icon: '🔴' },
};
const getS = (s: string) => STATUS[s] || { label: s, color: 'text-slate-600', bg: 'bg-slate-50', icon: '❓' };
const fmt = (n?: number | null) => (n ?? 0).toLocaleString('fr-FR');

const PAYMENT_COLORS: Record<string, string> = {
    paid: 'text-green-600',
    partial: 'text-amber-600',
    unpaid: 'text-red-500',
    overpaid: 'text-blue-600',
};

type Tab = 'all' | 'active' | 'completed';

export default function PortalOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<ClientOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');

    useEffect(() => {
        if (localStorage.getItem('portal_auth') !== 'true') {
            router.replace('/portal/login');
            return;
        }
        clientPortalApi
            .getOrders()
            .then(setOrders)
            .catch((err) => {
                if (err?.response?.status === 401) {
                    localStorage.removeItem('portal_auth');
                    router.replace('/portal/login');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    const filtered = useMemo(() => {
        const done = ['completed', 'cancelled', 'delivered'];
        if (tab === 'active') return orders.filter((o) => !done.includes(o.status));
        if (tab === 'completed') return orders.filter((o) => done.includes(o.status));
        return orders;
    }, [orders, tab]);

    const counts = useMemo(() => {
        const done = ['completed', 'cancelled', 'delivered'];
        return {
            all: orders.length,
            active: orders.filter((o) => !done.includes(o.status)).length,
            completed: orders.filter((o) => done.includes(o.status)).length,
        };
    }, [orders]);

    return (
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
            {/* ═══ Header ═══ */}
            <div className="sticky top-0 z-10 bg-white/90 px-5 pb-4 pt-5 shadow-sm backdrop-blur-xl">
                <h1 className="text-xl font-extrabold text-slate-800">Mes commandes</h1>
                <div className="mt-3 flex gap-2">
                    {[
                        { key: 'all' as Tab, label: 'Tout', count: counts.all },
                        { key: 'active' as Tab, label: 'En cours', count: counts.active },
                        { key: 'completed' as Tab, label: 'Terminées', count: counts.completed },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                                tab === t.key ? 'bg-[#4361ee] text-white shadow-md shadow-blue-300/40' : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {t.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${tab === t.key ? 'bg-white/20' : 'bg-slate-200/80'}`}>{t.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3 p-5">
                {loading && (
                    <div className="flex justify-center py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#4361ee]" />
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="rounded-2xl bg-white py-14 text-center shadow-lg shadow-slate-200/40">
                        <p className="text-4xl">{tab === 'active' ? '🧼' : tab === 'completed' ? '🏁' : '📦'}</p>
                        <p className="mt-3 text-sm font-medium text-slate-400">
                            {tab === 'active' ? 'Aucune commande en cours' : tab === 'completed' ? 'Aucune commande terminée' : 'Aucune commande'}
                        </p>
                    </div>
                )}

                {filtered.map((order) => {
                    const s = getS(order.type === 'subscription' ? order.subscriptionStatus || order.status : order.status);
                    const pickups = order.pickupSchedule || [];
                    const deliveries = order.deliverySchedule || [];
                    const donePickups = pickups.filter((p) => p.clothesCount && p.clothesCount > 0).length;
                    const doneDeliveries = deliveries.filter((d, i) => ['delivered', 'completed'].includes(getEffectiveDeliveryStatus(d, pickups[i]))).length;
                    const pColor = PAYMENT_COLORS[order.paymentStatus] || 'text-slate-500';

                    // Next pending operation for this order
                    const nextOp = [...pickups, ...deliveries]
                        .filter((op) => op.date && ['pending', 'confirmed'].includes(op.status || ''))
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

                    return (
                        <button
                            key={order._id}
                            onClick={() => router.push(`/portal/orders/${order._id}`)}
                            className="w-full rounded-2xl bg-white p-4 text-left shadow-lg shadow-slate-200/40 transition active:scale-[0.98]"
                        >
                            {/* Row 1: Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-base ${s.bg}`}>{s.icon}</div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{order.orderId}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {order.type === 'subscription' ? 'Abonnement' : 'À la carte'}
                                            {order.packName ? ` · ${order.packName}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${s.color} ${s.bg}`}>{s.label}</span>
                                </div>
                            </div>

                            {/* Row 2: Details */}
                            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5">
                                <div className="text-center">
                                    <p className="text-[9px] text-slate-400">Montant</p>
                                    <p className="text-xs font-bold text-slate-700">{order.totalPrice ? `${fmt(order.totalPrice)} F` : '—'}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] text-slate-400">Payé</p>
                                    <p className={`text-xs font-bold ${pColor}`}>{order.totalPaid ? `${fmt(order.totalPaid)} F` : '—'}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] text-slate-400">Créée le</p>
                                    <p className="text-xs font-bold text-slate-700">
                                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                                            day: '2-digit',
                                            month: 'short',
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Subscription period dates */}
                            {order.type === 'subscription' && (order as any).subscriptionStartDate && (
                                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5">
                                    <span className="text-[10px]">📅</span>
                                    <span className="text-[10px] font-semibold text-indigo-700">
                                        {new Date((order as any).subscriptionStartDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        {' → '}
                                        {(order as any).subscriptionEndDate
                                            ? new Date((order as any).subscriptionEndDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'}
                                    </span>
                                </div>
                            )}

                            {/* Row 3: Progress bars */}
                            {order.type === 'subscription' && pickups.length > 0 && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                                        <span>
                                            📦 {donePickups}/{pickups.length} récup.
                                        </span>
                                        <span>
                                            🚚 {doneDeliveries}/{deliveries.length} livr.
                                        </span>
                                    </div>
                                    <div className="mt-1 flex gap-0.5">
                                        {pickups.map((_, i) => (
                                            <div key={`p${i}`} className={`h-1 flex-1 rounded-full ${i < donePickups ? 'bg-[#4361ee]' : 'bg-slate-200'}`} />
                                        ))}
                                        <div className="w-1.5" />
                                        {deliveries.map((_, i) => (
                                            <div key={`d${i}`} className={`h-1 flex-1 rounded-full ${i < doneDeliveries ? 'bg-green-500' : 'bg-slate-200'}`} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {nextOp && (
                                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5">
                                    <span className="text-[10px]">📅</span>
                                    <span className="text-[10px] font-semibold text-blue-700">
                                        Prochain:{' '}
                                        {new Date(nextOp.date).toLocaleDateString('fr-FR', {
                                            weekday: 'short',
                                            day: '2-digit',
                                            month: 'short',
                                        })}
                                        {nextOp.scheduledTime ? ` à ${nextOp.scheduledTime}` : ''}
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <PortalBottomNav />
        </div>
    );
}




