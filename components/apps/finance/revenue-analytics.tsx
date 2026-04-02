'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { getOrders } from '@/lib/api/orders';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

type Period = 'month' | 'quarter' | 'year';
const PAGE = 10;

const RevenueAnalytics = () => {
    const now = new Date();
    const [period, setPeriod] = useState<Period>('month');
    const [page, setPage] = useState(1);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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
        queryKey: ['orders', 'rev-analytics'],
        queryFn: () => getOrders({ limit: 1000 }),
        staleTime: 60_000,
    });
    const allOrders: any[] = useMemo(() => (ordersRaw as any)?.data?.data || [], [ordersRaw]);

    const orders = useMemo(
        () =>
            allOrders.filter((o) => {
                const d = new Date(o.createdAt);
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allOrders, start, end]
    );

    const metrics = useMemo(() => {
        const totalRevenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const totalPaid = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
        const subRevenue = orders.filter((o) => o.type === 'subscription').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const alcRevenue = orders.filter((o) => o.type === 'a-la-carte').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const avg = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Monthly trend for chart
        const byMonth = Array(12).fill(0);
        const byMonthSub = Array(12).fill(0);
        const byMonthAlc = Array(12).fill(0);
        allOrders.forEach((o) => {
            const d = new Date(o.createdAt);
            if (d.getFullYear() === now.getFullYear()) {
                byMonth[d.getMonth()] += o.totalPrice || 0;
                if (o.type === 'subscription') byMonthSub[d.getMonth()] += o.totalPrice || 0;
                else byMonthAlc[d.getMonth()] += o.totalPrice || 0;
            }
        });

        // By pack
        const byPack: Record<string, { name: string; revenue: number; count: number }> = {};
        orders
            .filter((o) => o.type === 'subscription')
            .forEach((o) => {
                const key = o.packName || 'Inconnu';
                if (!byPack[key]) byPack[key] = { name: key, revenue: 0, count: 0 };
                byPack[key].revenue += o.totalPrice || 0;
                byPack[key].count += 1;
            });

        return {
            totalRevenue,
            totalPaid,
            subRevenue,
            alcRevenue,
            avg,
            byMonth,
            byMonthSub,
            byMonthAlc,
            byPack: Object.values(byPack).sort((a, b) => b.revenue - a.revenue),
            totalOrders: orders.length,
        };
    }, [orders, allOrders]);

    // Stacked bar chart
    const stackedChart: any = {
        series: [
            { name: 'Abonnements', data: metrics.byMonthSub },
            { name: 'À la carte', data: metrics.byMonthAlc },
        ],
        options: {
            chart: {
                type: 'bar',
                height: 240,
                stacked: true,
                toolbar: { show: false },
                fontFamily: 'inherit',
                background: 'transparent',
            },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
            colors: ['#4361ee', '#f59e0b'],
            dataLabels: { enabled: false },
            xaxis: { categories: MONTHS_FR, labels: { style: { fontSize: '10px' } } },
            yaxis: {
                labels: {
                    formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
                    style: { fontSize: '10px' },
                },
            },
            grid: { borderColor: 'rgba(100,100,100,0.08)' },
            tooltip: { y: { formatter: (v: number) => money(v) } },
            legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px' },
            fill: { opacity: 1 },
        },
    };

    // Donut
    const donutChart: any = {
        series: [metrics.subRevenue, metrics.alcRevenue],
        options: {
            chart: { type: 'donut', height: 200, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#f59e0b'],
            labels: ['Abonnements', 'À la carte'],
            legend: { position: 'bottom', fontSize: '10px' },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: {
                            show: true,
                            total: { show: true, label: 'Total', formatter: () => money(metrics.totalRevenue) },
                        },
                    },
                },
            },
            stroke: { width: 2 },
        },
    };

    const sorted = [...orders].sort((a, b) =>
        sortDir === 'desc' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const totalPages = Math.ceil(sorted.length / PAGE);
    const paginated = sorted.slice((page - 1) * PAGE, page * PAGE);

    if (isLoading)
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );

    return (
        <div className="space-y-6">
            {/* Header + period */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                    Période :{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                        {start} → {end}
                    </strong>
                </p>
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
                            {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trimestre' : 'Année'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    { label: 'CA total', value: money(metrics.totalRevenue), sub: `${metrics.totalOrders} commandes` },
                    {
                        label: 'Encaissé',
                        value: money(metrics.totalPaid),
                        sub: `${pct(metrics.totalPaid, metrics.totalRevenue)}% du CA`,
                        accent: 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                        label: 'Abonnements',
                        value: money(metrics.subRevenue),
                        sub: `${pct(metrics.subRevenue, metrics.totalRevenue)}% du CA`,
                        accent: 'text-blue-600 dark:text-blue-400',
                    },
                    { label: 'Panier moyen', value: money(Math.round(metrics.avg)), sub: 'par commande' },
                ].map((kpi: any) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${kpi.accent || 'text-slate-800 dark:text-white'}`}>{kpi.value}</p>
                        <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">CA par type — {now.getFullYear()}</h3>
                    <ApexChart series={stackedChart.series} options={stackedChart.options} type="bar" height={240} />
                </Card>
                <Card className="p-5 lg:col-span-2">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Répartition</h3>
                    <ApexChart series={donutChart.series} options={donutChart.options} type="donut" height={200} />
                </Card>
            </div>

            {/* Revenue by pack */}
            {metrics.byPack.length > 0 && (
                <Card>
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Revenus par pack</h3>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {metrics.byPack.map((p) => (
                            <div key={p.name} className="flex items-center gap-4 px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{money(p.revenue)}</span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct(p.revenue, metrics.subRevenue)}%` }} />
                                    </div>
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                        {p.count} commande{p.count !== 1 ? 's' : ''} · {pct(p.revenue, metrics.totalRevenue)}% du CA
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Orders table */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Détail des commandes</h3>
                    <button type="button" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))} className="text-xs text-slate-400 hover:text-primary">
                        Date {sortDir === 'desc' ? '↓' : '↑'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800">
                                {['Date', 'N°', 'Client', 'Type', 'Pack/Détail', 'Montant', 'Encaissé', 'Statut'].map((h, i) => (
                                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 ${i >= 5 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {paginated.map((o: any) => (
                                <tr key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-2 text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{o.orderId?.slice(-8)}</td>
                                    <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</td>
                                    <td className="px-4 py-2">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.type === 'subscription' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {o.type === 'subscription' ? 'Abo' : 'ALC'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-slate-500">{o.packName || o.items?.[0]?.name || '—'}</td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(o.totalPrice || 0)}</td>
                                    <td className="px-4 py-2 text-right text-emerald-600">{money(o.totalPaid || 0)}</td>
                                    <td className="px-4 py-2 text-right">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : o.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                            }`}
                                        >
                                            {o.paymentStatus === 'paid' ? 'Payé' : o.paymentStatus === 'partial' ? 'Partiel' : 'Impayé'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        Aucune commande sur la période
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-50 px-5 py-3 dark:border-slate-800">
                        <span className="text-xs text-slate-400">{orders.length} commandes</span>
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

export default RevenueAnalytics;
