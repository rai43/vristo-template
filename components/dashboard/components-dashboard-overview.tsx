'use client';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDashboardStats } from '@/lib/api/dashboard';
import { getAllOperations, getOrders } from '@/lib/api/orders';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import PeriodSelector from '@/components/common/PeriodSelector';

/* ── helpers ── */
const _money = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M F` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k F` : `${n.toLocaleString('fr-FR')} F`);
const moneyFull = (n: number) => n.toLocaleString('fr-FR') + ' F';

/* ── stat card ── */
const Stat = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) => (
    <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
    </div>
);

/* ── activity row ── */
const ActivityRow = ({ item }: { item: any }) => {
    const typeColor: Record<string, string> = {
        payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
        order: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
        subscription: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    };
    const typeLabel: Record<string, string> = { payment: 'Paiement', order: 'Commande', subscription: 'Abonnement' };
    return (
        <div className="flex items-center gap-3 py-2.5">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${typeColor[item.type] || typeColor.order}`}>{typeLabel[item.type] || item.type}</span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.clientName}</p>
                <p className="truncate text-xs text-slate-400">{item.description}</p>
            </div>
            <div className="text-right">
                {item.amount != null && <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.amount.toLocaleString('fr-FR')} F</p>}
                <p className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString('fr-FR')}</p>
            </div>
        </div>
    );
};

const ComponentsDashboardOverview = () => {
    const { isAdmin } = useAuth();
    const router = useRouter();

    const today = useMemo(() => new Date(), []);

    // ── Operational period ───────────────────────────────────
    const periodHook = useOperationalPeriod({ defaultToAll: true });
    const dateFrom = periodHook.dateFrom;
    const dateTo = periodHook.dateTo;

    // ── Data fetching ──────────────────────────────────────
    const { data: statsAll } = useQuery({
        queryKey: ['dashboard', 'all', dateFrom, dateTo],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    const { data: allOrdersRaw } = useQuery({
        queryKey: ['orders', 'overview-all', dateFrom, dateTo],
        queryFn: () => getOrders({ limit: 1000, startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    const { data: recentOrdersRaw } = useQuery({
        queryKey: ['orders', 'overview-list', dateFrom, dateTo],
        queryFn: () => getOrders({ limit: 5, page: 1, startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    const { data: opsData } = useQuery({
        queryKey: ['operations', 'overview', dateFrom, dateTo],
        queryFn: () => getAllOperations({ startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    // ── Data extraction ────────────────────────────────────
    const s = statsAll?.data;
    const allOrders: any[] = useMemo(() => (allOrdersRaw as any)?.data?.data || [], [allOrdersRaw]);
    const recentOrders: any[] = useMemo(() => (recentOrdersRaw as any)?.data?.data || [], [recentOrdersRaw]);
    const operations: any[] = useMemo(() => (opsData as any)?.data?.operations || [], [opsData]);

    // ── KPIs computed from actual orders ───────────────────
    const kpis = useMemo(() => {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        const totalPaid = allOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
        const outstanding = totalRevenue - totalPaid;

        const monthOrders = allOrders.filter((o) => new Date(o.createdAt) >= monthStart);
        const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        const monthPaid = monthOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);

        const activeSubscriptions = allOrders.filter((o) => o.type === 'subscription' && (o.subscriptionStatus === 'active' || (!o.subscriptionStatus && o.status !== 'cancelled'))).length;
        const subOrders = allOrders.filter((o) => o.type === 'subscription').length;
        const alcOrders = allOrders.filter((o) => o.type === 'a-la-carte').length;

        const unpaidCount = allOrders.filter((o) => o.paymentStatus === 'unpaid').length;
        const partialCount = allOrders.filter((o) => o.paymentStatus === 'partial').length;
        const paidCount = allOrders.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'overpaid').length;

        return {
            totalRevenue,
            totalPaid,
            outstanding,
            monthRevenue,
            monthPaid,
            activeSubscriptions,
            subOrders,
            alcOrders,
            totalOrders: allOrders.length,
            unpaidCount,
            partialCount,
            paidCount,
        };
    }, [allOrders, today]);

    // ── Operations metrics ─────────────────────────────────
    const overdueCount = useMemo(() => operations.filter((op: any) => op.isOverdue).length, [operations]);
    const todayOpsCount = useMemo(() => operations.filter((op: any) => new Date(op.date).toDateString() === today.toDateString()).length, [operations, today]);
    const pendingCount = useMemo(() => operations.filter((op: any) => op.status === 'pending').length, [operations]);
    const readyCount = useMemo(() => operations.filter((op: any) => op.status === 'ready_for_delivery').length, [operations]);
    const confirmedPickups = useMemo(() => operations.filter((op: any) => op.status === 'confirmed' && op.operationType === 'pickup'), [operations]);
    const weekOpsCount = useMemo(() => {
        const ws = new Date(today);
        ws.setDate(ws.getDate() - ws.getDay());
        ws.setHours(0, 0, 0, 0);
        return operations.filter((op: any) => new Date(op.date) >= ws).length;
    }, [operations, today]);

    const totalClients = s?.clientStats?.totalClients ?? 0;

    if (!isAdmin) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="text-center">
                    <p className="text-6xl">🔒</p>
                    <h2 className="mt-4 text-xl font-bold text-slate-700 dark:text-white">Accès restreint</h2>
                    <p className="mt-2 text-sm text-slate-500">Le tableau de bord est réservé aux administrateurs.</p>
                    <button type="button" onClick={() => router.push('/apps/orders')} className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white">
                        Aller aux commandes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page title */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Vue d&apos;ensemble</h1>
                <p className="mt-0.5 text-sm text-slate-400">
                    {today.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}{' '}
                    · MIRAI Services
                </p>
            </div>

            {/* Period selector */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <PeriodSelector
                    periods={periodHook.periods}
                    selectedPeriodId={periodHook.selectedPeriodId}
                    onSelectPeriod={periodHook.selectPeriod}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={(v) => periodHook.setCustomDates(v, dateTo)}
                    onDateToChange={(v) => periodHook.setCustomDates(dateFrom, v)}
                    isCustom={periodHook.isCustom}
                    onClearCustom={periodHook.clearCustomRange}
                    isLoading={periodHook.isLoading}
                    isAllPeriods={periodHook.isAllPeriods}
                    compact
                />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat
                    label="Chiffre d'affaires"
                    value={moneyFull(kpis.totalRevenue)}
                    sub={`${moneyFull(kpis.monthRevenue)} ce mois · ${kpis.totalOrders} commande${kpis.totalOrders !== 1 ? 's' : ''}`}
                    accent="text-slate-800 dark:text-white"
                />
                <Stat
                    label="Encaissé"
                    value={moneyFull(kpis.totalPaid)}
                    sub={`${kpis.totalRevenue > 0 ? Math.round((kpis.totalPaid / kpis.totalRevenue) * 100) : 0}% du CA · ${moneyFull(kpis.monthPaid)} ce mois`}
                    accent="text-emerald-600 dark:text-emerald-400"
                />
                <Stat
                    label="Impayés"
                    value={moneyFull(kpis.outstanding)}
                    sub={
                        kpis.outstanding > 0 ? `${kpis.unpaidCount} impayé${kpis.unpaidCount !== 1 ? 's' : ''} · ${kpis.partialCount} partiel${kpis.partialCount !== 1 ? 's' : ''}` : 'Tout encaissé ✓'
                    }
                    accent={kpis.outstanding > 0 ? 'text-red-500' : 'text-emerald-500'}
                />
                <Stat
                    label="Abonnements actifs"
                    value={String(kpis.activeSubscriptions)}
                    sub={`${kpis.subOrders} abo · ${kpis.alcOrders} ALC · ${totalClients} clients`}
                    accent="text-blue-600 dark:text-blue-400"
                />
            </div>

            {/* Operations status pills */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                    {
                        label: "Opérations aujourd'hui",
                        val: todayOpsCount,
                        bg: todayOpsCount > 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800',
                        text: todayOpsCount > 0 ? 'text-blue-600' : 'text-slate-400',
                    },
                    {
                        label: 'En attente',
                        val: pendingCount,
                        bg: 'bg-slate-100 dark:bg-slate-800',
                        text: 'text-slate-600 dark:text-slate-300',
                    },
                    {
                        label: '📦 Demandes récup.',
                        val: confirmedPickups.length,
                        bg: confirmedPickups.length > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-100 dark:bg-slate-800',
                        text: confirmedPickups.length > 0 ? 'text-amber-600' : 'text-slate-400',
                    },
                    {
                        label: 'En retard',
                        val: overdueCount,
                        bg: overdueCount > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-slate-100 dark:bg-slate-800',
                        text: overdueCount > 0 ? 'text-red-600' : 'text-slate-400',
                    },
                    {
                        label: 'Prêts livraison',
                        val: readyCount,
                        bg: readyCount > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-100 dark:bg-slate-800',
                        text: readyCount > 0 ? 'text-emerald-600' : 'text-slate-400',
                    },
                ].map((p) => (
                    <div key={p.label} className={`flex items-center justify-between rounded-xl p-4 ${p.bg}`}>
                        <span className={`text-sm font-medium ${p.text}`}>{p.label}</span>
                        <span className={`text-2xl font-bold ${p.text}`}>{p.val}</span>
                    </div>
                ))}
            </div>

            {/* Confirmed pickup requests widget */}
            {confirmedPickups.length > 0 && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 shadow-sm dark:border-amber-700/50 dark:bg-amber-900/10">
                    <div className="flex items-center justify-between border-b border-amber-200/60 px-5 py-3 dark:border-amber-700/40">
                        <h3 className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                            <span className="text-lg">📦</span>
                            Demandes de récupération clients
                        </h3>
                        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-700 dark:text-amber-200">
                            {confirmedPickups.length}
                        </span>
                    </div>
                    <div className="divide-y divide-amber-100 dark:divide-amber-800/30">
                        {confirmedPickups.slice(0, 10).map((op: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm dark:bg-amber-800/30">📦</div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{op.customer?.name || '—'}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                        <span>{op.city || op.customer?.zone || '—'}</span>
                                        {op.scheduledTime && <span>⏰ {op.scheduledTime}</span>}
                                        <span>{new Date(op.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/apps/orders/view?id=${op.orderId}`}
                                    className="rounded-lg bg-amber-200/60 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-700/30 dark:text-amber-300"
                                >
                                    Traiter →
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent orders */}
                <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Dernières commandes</h3>
                        <Link href="/apps/orders/list" className="text-xs font-medium text-primary hover:underline">
                            Voir tout →
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {recentOrders.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucune commande</p>}
                        {recentOrders.map((o: any) => (
                            <div key={o._id} className="flex items-center gap-3 px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</p>
                                    <p className="font-mono text-[10px] text-slate-400">{o.orderId}</p>
                                </div>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                        o.type === 'subscription'
                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                    }`}
                                >
                                    {o.type === 'subscription' ? 'Abo.' : 'ALC'}
                                </span>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                        o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : o.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                    }`}
                                >
                                    {o.paymentStatus === 'paid' ? 'Payé' : o.paymentStatus === 'partial' ? `${Math.round(((o.totalPaid || 0) / (o.totalPrice || 1)) * 100)}% Partiel` : 'Impayé'}
                                </span>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{moneyFull(o.totalPrice || 0)}</p>
                                <Link href={`/apps/orders/view?id=${o.orderId}`} className="text-xs text-primary hover:underline">
                                    Voir
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Activité récente</h3>
                    </div>
                    <div className="divide-y divide-slate-50 px-5 dark:divide-slate-800">
                        {(s?.recentActivities || []).length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucune activité</p>}
                        {(s?.recentActivities || []).slice(0, 7).map((item: any, i: number) => (
                            <ActivityRow key={i} item={item} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Nav cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    {
                        href: '/dashboard/commercial',
                        title: 'Gestion Commerciale',
                        desc: 'Commandes, clients, CA',
                        sub: `${kpis.totalOrders} commandes · ${moneyFull(kpis.totalRevenue)} CA`,
                    },
                    {
                        href: '/dashboard/finance',
                        title: 'Finance',
                        desc: 'Revenus, paiements, balance',
                        sub: `${moneyFull(kpis.outstanding)} impayés`,
                    },
                    {
                        href: '/dashboard/operations',
                        title: 'Opérations',
                        desc: 'Récupérations, livraisons',
                        sub: `${todayOpsCount} aujourd'hui · ${weekOpsCount} cette semaine`,
                    },
                ].map((card) => (
                    <Link
                        key={card.href}
                        href={card.href}
                        className="group rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/50 dark:bg-[#1a2234]"
                    >
                        <h3 className="font-semibold text-slate-800 group-hover:text-primary dark:text-white">{card.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{card.desc}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>{card.sub}</span>
                            <span className="text-primary">→</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ComponentsDashboardOverview;
