'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getOrders } from '@/lib/api/orders';

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const PAGE = 10;

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

type Filter = 'all' | 'unpaid' | 'partial';
type Period = 'month' | 'quarter' | 'year';

const PaymentReconciliation = () => {
    const now = new Date();
    const [period, setPeriod] = useState<Period>('month');
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const ranges: Record<Period, { start: string; end: string }> = {
        month: {
            start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
        },
        quarter: {
            start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0],
            end: now.toISOString().split('T')[0],
        },
        year: { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` },
    };
    const { start, end } = ranges[period];

    const { data: ordersRaw, isLoading } = useQuery({
        queryKey: ['orders', 'reconciliation'],
        queryFn: () => getOrders({ limit: 1000 }),
        staleTime: 60_000,
    });
    const allOrders: any[] = useMemo(() => (ordersRaw as any)?.data?.data || [], [ordersRaw]);

    const periodOrders = useMemo(
        () =>
            allOrders.filter((o) => {
                const d = new Date(o.createdAt);
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allOrders, start, end]
    );

    const metrics = useMemo(() => {
        const totalRevenue = periodOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const totalPaid = periodOrders.reduce((s, o) => s + (o.totalPaid || 0), 0);
        const totalPending = totalRevenue - totalPaid;
        const unpaidCount = periodOrders.filter((o) => o.paymentStatus === 'unpaid').length;
        const partialCount = periodOrders.filter((o) => o.paymentStatus === 'partial').length;
        const paidCount = periodOrders.filter((o) => o.paymentStatus === 'paid').length;
        return {
            totalRevenue,
            totalPaid,
            totalPending,
            unpaidCount,
            partialCount,
            paidCount,
            totalCount: periodOrders.length,
        };
    }, [periodOrders]);

    const filtered = useMemo(() => {
        let result = periodOrders;
        if (filter === 'unpaid') result = result.filter((o) => o.paymentStatus === 'unpaid');
        else if (filter === 'partial') result = result.filter((o) => o.paymentStatus === 'partial');
        else result = result.filter((o) => (o.totalPrice || 0) > (o.totalPaid || 0) || filter === 'all');
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((o) => (o.customerId?.name || '').toLowerCase().includes(q) || (o.orderId || '').toLowerCase().includes(q));
        }
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [periodOrders, filter, search]);

    const totalPages = Math.ceil(filtered.length / PAGE);
    const paginated = filtered.slice((page - 1) * PAGE, page * PAGE);

    const filterBtns: { key: Filter; label: string; count: number }[] = [
        { key: 'all', label: 'Tous', count: metrics.totalCount },
        { key: 'partial', label: 'Partiels', count: metrics.partialCount },
        { key: 'unpaid', label: 'Impayés', count: metrics.unpaidCount },
    ];

    if (isLoading)
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );

    return (
        <div className="space-y-6">
            {/* Period + search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 items-center gap-3">
                    <input
                        type="text"
                        placeholder="Rechercher client ou N°..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-[#1a2234] dark:text-white"
                    />
                    <div className="flex rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        {(['month', 'quarter', 'year'] as Period[]).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => {
                                    setPeriod(p);
                                    setPage(1);
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    period === p ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trim.' : 'Année'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    { label: 'CA période', value: money(metrics.totalRevenue), sub: `${metrics.totalCount} commandes` },
                    {
                        label: 'Encaissé',
                        value: money(metrics.totalPaid),
                        sub: `${pct(metrics.totalPaid, metrics.totalRevenue)}% du CA`,
                        accent: 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                        label: 'À encaisser',
                        value: money(metrics.totalPending),
                        sub: `Impayés + partiels`,
                        accent: metrics.totalPending > 0 ? 'text-red-500' : 'text-emerald-500',
                    },
                    {
                        label: 'Taux recouvrement',
                        value: `${pct(metrics.totalPaid, metrics.totalRevenue)}%`,
                        sub: `${metrics.paidCount} payées sur ${metrics.totalCount}`,
                        accent: pct(metrics.totalPaid, metrics.totalRevenue) >= 90 ? 'text-emerald-500' : pct(metrics.totalPaid, metrics.totalRevenue) >= 70 ? 'text-amber-500' : 'text-red-500',
                    },
                ].map((kpi: any) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${kpi.accent || 'text-slate-800 dark:text-white'}`}>{kpi.value}</p>
                        <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Progress bar */}
            <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Progression du recouvrement</h3>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {money(metrics.totalPaid)} / {money(metrics.totalRevenue)}
                    </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct(metrics.totalPaid, metrics.totalRevenue)}%` }} />
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="text-emerald-600">{metrics.paidCount} payés</span>
                    <span className="text-amber-500">{metrics.partialCount} partiels</span>
                    <span className="text-red-500">{metrics.unpaidCount} impayés</span>
                </div>
            </Card>

            {/* Filter tabs + table */}
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                    <div className="flex gap-2">
                        {filterBtns.map((btn) => (
                            <button
                                key={btn.key}
                                type="button"
                                onClick={() => {
                                    setFilter(btn.key);
                                    setPage(1);
                                }}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    filter === btn.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                            >
                                {btn.label}
                                <span className={`rounded-full px-1.5 text-[10px] ${filter === btn.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                                    {btn.count}
                                </span>
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-400">
                        {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800">
                                {['Date', 'Client', 'N°', 'Type', 'Total', 'Payé', 'Restant', 'Statut', ''].map((h, i) => (
                                    <th key={`${h}${i}`} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 ${i >= 4 && i <= 6 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {paginated.map((o: any) => {
                                const remaining = (o.totalPrice || 0) - (o.totalPaid || 0);
                                return (
                                    <tr key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</td>
                                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{o.orderId?.slice(-8)}</td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    o.type === 'subscription' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                                                }`}
                                            >
                                                {o.type === 'subscription' ? 'Abo' : 'ALC'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">{money(o.totalPrice || 0)}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{money(o.totalPaid || 0)}</td>
                                        <td className={`px-4 py-2.5 text-right font-bold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>{remaining > 0 ? money(remaining) : '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    o.paymentStatus === 'paid'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : o.paymentStatus === 'partial'
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-red-50 text-red-700'
                                                }`}
                                            >
                                                {o.paymentStatus === 'paid' ? 'Payé' : o.paymentStatus === 'partial' ? 'Partiel' : 'Impayé'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Link href={`/apps/orders/view?id=${o.orderId}`} className="text-xs text-primary hover:underline">
                                                →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                        Aucune commande
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-50 px-5 py-3 dark:border-slate-800">
                        <span className="text-xs text-slate-400">{filtered.length} commandes</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                                ← Préc.
                            </button>
                            <span className="text-xs text-slate-400">
                                {page}/{totalPages}
                            </span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                            >
                                Suiv. →
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default PaymentReconciliation;
