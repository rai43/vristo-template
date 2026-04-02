'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getOrders } from '@/lib/api/orders';
import { getCustomers } from '@/lib/api/clients';
import { getDashboardStats } from '@/lib/api/dashboard';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import PeriodSelector from '@/components/common/PeriodSelector';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

const StatusLabel: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Payé', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
    partial: { label: 'Partiel', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
    unpaid: { label: 'Impayé', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

const ComponentsDashboardCommercial = () => {
    const [page, setPage] = useState(1);
    const PAGE = 8;

    const periodHook = useOperationalPeriod({ defaultToAll: true });
    const {
        periods,
        selectedPeriodId,
        dateFrom,
        dateTo,
        isCustom,
        isAllPeriods,
        selectPeriod,
        setCustomDates,
        clearCustomRange,
        isLoading: periodsLoading,
    } = periodHook;

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard', 'commercial', dateFrom, dateTo],
        queryFn: () => getDashboardStats(dateFrom ? { dateFrom, dateTo: dateTo || undefined } : undefined),
        staleTime: 60_000,
    });

    const { data: ordersRaw, isLoading: ordersLoading } = useQuery({
        queryKey: ['orders', 'commercial', dateFrom, dateTo],
        queryFn: () => getOrders({ limit: 500, ...(dateFrom ? { startDate: dateFrom, endDate: dateTo || undefined } : {}) }),
        staleTime: 60_000,
    });

    const { data: customersRaw } = useQuery({
        queryKey: ['customers', 'commercial'],
        queryFn: () => getCustomers({ limit: 1000 }),
        staleTime: 120_000,
    });

    const orders: any[] = useMemo(() => (ordersRaw as any)?.data?.data || [], [ordersRaw]);
    const customers: any[] = useMemo(() => (customersRaw as any)?.data?.data || [], [customersRaw]);

    // Metrics
    const metrics = useMemo(() => {
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
        const totalPaid = orders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
        const subOrders = orders.filter((o) => o.type === 'subscription');
        const alcOrders = orders.filter((o) => o.type === 'a-la-carte');
        const avg = orders.length > 0 ? totalRevenue / orders.length : 0;
        const unpaid = orders.filter((o) => o.paymentStatus === 'unpaid').length;
        const partial = orders.filter((o) => o.paymentStatus === 'partial').length;
        const paid = orders.filter((o) => o.paymentStatus === 'paid').length;

        // top customers
        const custMap: Record<string, { name: string; revenue: number; orders: number; id: string }> = {};
        orders.forEach((o: any) => {
            const id = o.customerId?._id || o.customerId;
            if (!id) return;
            if (!custMap[id]) custMap[id] = { name: o.customerId?.name || '—', revenue: 0, orders: 0, id };
            custMap[id].revenue += o.totalPrice || 0;
            custMap[id].orders += 1;
        });
        const topCustomers = Object.values(custMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8);

        // Monthly trend
        const byMonth: Record<string, number> = {};
        orders.forEach((o: any) => {
            const m = new Date(o.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            byMonth[m] = (byMonth[m] || 0) + (o.totalPrice || 0);
        });

        // new customers in period
        const since = dateFrom ? new Date(dateFrom) : new Date(0);
        const newCustomers = customers.filter((c: any) => new Date(c.createdAt) >= since).length;

        return { totalRevenue, totalPaid, subOrders: subOrders.length, alcOrders: alcOrders.length, avg, unpaid, partial, paid, topCustomers, byMonth, newCustomers };
    }, [orders, customers, dateFrom]);

    // Revenue bar chart (last 12 months)
    const monthKeys = Object.keys(metrics.byMonth).slice(-12);
    const revenueChart: any = {
        series: [{ name: 'CA', data: monthKeys.map((k) => metrics.byMonth[k] || 0) }],
        options: {
            chart: { type: 'bar', height: 200, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
            colors: ['#4361ee'],
            dataLabels: { enabled: false },
            xaxis: { categories: monthKeys, labels: { style: { fontSize: '10px' } } },
            yaxis: { labels: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)), style: { fontSize: '10px' } } },
            grid: { borderColor: 'rgba(100,100,100,0.1)' },
            tooltip: { y: { formatter: (v: number) => money(v) } },
            theme: { mode: 'light' },
        },
    };

    // Donut: sub vs alc
    const mixChart: any = {
        series: [metrics.subOrders, metrics.alcOrders],
        options: {
            chart: { type: 'donut', height: 180, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#00ab55'],
            labels: ['Abonnements', 'À la carte'],
            legend: { position: 'bottom', fontSize: '11px' },
            dataLabels: { enabled: false },
            plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => String(metrics.subOrders + metrics.alcOrders) } } } } },
            stroke: { width: 2 },
        },
    };

    // Donut: payment
    const payChart: any = {
        series: [metrics.paid, metrics.partial, metrics.unpaid],
        options: {
            chart: { type: 'donut', height: 180, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#00ab55', '#e2a03f', '#e7515a'],
            labels: ['Payé', 'Partiel', 'Impayé'],
            legend: { position: 'bottom', fontSize: '11px' },
            dataLabels: { enabled: false },
            plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Cmds', formatter: () => String(orders.length) } } } } },
            stroke: { width: 2 },
        },
    };

    const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = sorted.slice((page - 1) * PAGE, page * PAGE);
    const totalPages = Math.ceil(sorted.length / PAGE);

    if (ordersLoading || statsLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestion Commerciale</h1>
                    <p className="mt-0.5 text-sm text-slate-400">
                        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                        · Commandes, clients et chiffre d&apos;affaires
                    </p>
                </div>
                <PeriodSelector
                    periods={periods}
                    selectedPeriodId={selectedPeriodId}
                    onSelectPeriod={(id) => { selectPeriod(id); setPage(1); }}
                    dateFrom={dateFrom || ''}
                    dateTo={dateTo || ''}
                    onDateFromChange={(d) => { setCustomDates(d, dateTo || ''); setPage(1); }}
                    onDateToChange={(d) => { setCustomDates(dateFrom || '', d); setPage(1); }}
                    isCustom={isCustom}
                    onClearCustom={clearCustomRange}
                    isLoading={periodsLoading}
                    isAllPeriods={isAllPeriods}
                />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    { label: 'Commandes', val: String(orders.length), sub: `${metrics.subOrders} abo · ${metrics.alcOrders} ALC` },
                    { label: "Chiffre d'affaires", val: money(metrics.totalRevenue), sub: `${money(metrics.totalPaid)} encaissé (${pct(metrics.totalPaid, metrics.totalRevenue)}%)` },
                    { label: 'Panier moyen', val: money(Math.round(metrics.avg)), sub: 'par commande' },
                    { label: 'Nouveaux clients', val: String(metrics.newCustomers), sub: `${customers.length} clients total` },
                ].map((kpi) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">{kpi.val}</p>
                        <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Évolution du CA</h3>
                    <ApexChart series={revenueChart.series} options={revenueChart.options} type="bar" height={200} />
                </Card>
                <Card className="p-5">
                    <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">Mix commandes</h3>
                    <ApexChart series={mixChart.series} options={mixChart.options} type="donut" height={180} />
                </Card>
                <Card className="p-5">
                    <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">Paiements</h3>
                    <ApexChart series={payChart.series} options={payChart.options} type="donut" height={180} />
                </Card>
            </div>

            {/* Bottom grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Top customers */}
                <Card>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Top clients</h3>
                        <Link href="/apps/customers" className="text-xs font-medium text-primary hover:underline">Voir tout →</Link>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {metrics.topCustomers.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                                <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{c.name}</p>
                                    <p className="text-xs text-slate-400">{c.orders} commande{c.orders !== 1 ? 's' : ''}</p>
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{money(c.revenue)}</span>
                            </div>
                        ))}
                        {metrics.topCustomers.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun client</p>}
                    </div>
                </Card>

                {/* Recent orders table */}
                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Commandes récentes</h3>
                        <Link href="/apps/orders/list" className="text-xs font-medium text-primary hover:underline">Voir tout →</Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">N°</th>
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">Client</th>
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">Type</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">Montant</th>
                                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-400">Paiement</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {paginated.map((o: any) => {
                                    const ps = StatusLabel[o.paymentStatus] || StatusLabel.unpaid;
                                    return (
                                        <tr key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-5 py-2.5 font-mono text-[10px] text-slate-400">{o.orderId?.slice(-8)}</td>
                                            <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</td>
                                            <td className="px-5 py-2.5">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.type === 'subscription' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-amber-50 text-amber-700'}`}>
                                                    {o.type === 'subscription' ? 'Abo.' : 'ALC'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{(o.totalPrice || 0).toLocaleString('fr-FR')} F</td>
                                            <td className="px-5 py-2.5 text-center">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ps.cls}`}>{ps.label}</span>
                                            </td>
                                            <td className="px-3">
                                                <Link href={`/apps/orders/view?id=${o.orderId}`} className="text-xs text-primary hover:underline">→</Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginated.length === 0 && (
                                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">Aucune commande</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-end gap-2 border-t border-slate-50 px-5 py-3 dark:border-slate-800">
                            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">← Préc.</button>
                            <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">Suiv. →</button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ComponentsDashboardCommercial;
