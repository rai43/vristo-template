'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getOrders } from '@/lib/api/orders';
import { getExpenses } from '@/lib/api/expenses';
import { getSalaries } from '@/lib/api/salaries';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
type Period = 'month' | 'quarter' | 'year';

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

const FinanceDashboard = () => {
    const now = new Date();
    const [period, setPeriod] = useState<Period>('month');

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

    const { data: ordersRaw, isLoading: ol } = useQuery({
        queryKey: ['orders', 'fin-dash', period],
        queryFn: () => getOrders({ limit: 1000 }),
        staleTime: 60_000,
    });
    const { data: expensesRaw, isLoading: el } = useQuery({
        queryKey: ['expenses', 'fin-dash'],
        queryFn: () => getExpenses(),
        staleTime: 60_000,
    });
    const { data: salariesRaw, isLoading: sl } = useQuery({
        queryKey: ['salaries', 'fin-dash'],
        queryFn: () => getSalaries(),
        staleTime: 60_000,
    });

    const allOrders: any[] = useMemo(() => (ordersRaw as any)?.data?.data || [], [ordersRaw]);
    const allExpenses: any[] = useMemo(() => (expensesRaw as any) || [], [expensesRaw]);
    const allSalaries: any[] = useMemo(() => (salariesRaw as any) || [], [salariesRaw]);

    const orders = useMemo(
        () =>
            allOrders.filter((o) => {
                const d = new Date(o.createdAt);
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allOrders, start, end],
    );
    const expenses = useMemo(
        () =>
            allExpenses.filter((e) => {
                const d = new Date(e.date);
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allExpenses, start, end],
    );
    const salariesInPeriod = useMemo(
        () =>
            allSalaries.filter((s) => {
                const d = new Date((s.month || s.period || '2000-01') + '-01');
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allSalaries, start, end],
    );

    const metrics = useMemo(() => {
        const totalRevenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const totalPaid = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
        const totalPending = totalRevenue - totalPaid;
        const subRevenue = orders.filter((o) => o.type === 'subscription').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const alcRevenue = orders.filter((o) => o.type === 'a-la-carte').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const expensesTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const salariesTotal = salariesInPeriod.reduce((s, sal) => s + (sal.payments || []).reduce((ps: number, p: any) => ps + (p.amount || 0), 0), 0);
        const totalOutgo = expensesTotal + salariesTotal;
        const balance = totalPaid - totalOutgo;
        const byMonth = Array(12).fill(0);
        const byMonthPaid = Array(12).fill(0);
        allOrders.forEach((o) => {
            const d = new Date(o.createdAt);
            if (d.getFullYear() === now.getFullYear()) {
                byMonth[d.getMonth()] += o.totalPrice || 0;
                byMonthPaid[d.getMonth()] += o.totalPaid || 0;
            }
        });
        const byMethod: Record<string, number> = {};
        orders.forEach((o) =>
            (o.payments || []).forEach((p: any) => {
                const m = p.method || 'Autre';
                byMethod[m] = (byMethod[m] || 0) + (p.amount || 0);
            }),
        );
        return {
            totalRevenue,
            totalPaid,
            totalPending,
            subRevenue,
            alcRevenue,
            expensesTotal,
            salariesTotal,
            totalOutgo,
            balance,
            byMonth,
            byMonthPaid,
            byMethod,
            totalOrders: orders.length,
            subOrders: orders.filter((o) => o.type === 'subscription').length,
            alcOrders: orders.filter((o) => o.type === 'a-la-carte').length,
        };
    }, [orders, expenses, salariesInPeriod, allOrders]);

    const areaChart: any = {
        series: [
            { name: 'Facturé', data: metrics.byMonth },
            { name: 'Encaissé', data: metrics.byMonthPaid },
        ],
        options: {
            chart: {
                type: 'area',
                height: 240,
                toolbar: { show: false },
                fontFamily: 'inherit',
                background: 'transparent',
            },
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.02 } },
            colors: ['#4361ee', '#00ab55'],
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
        },
    };
    const mixHasData = metrics.subRevenue > 0 || metrics.alcRevenue > 0;
    const mixChart: any = {
        series: [metrics.subRevenue, metrics.alcRevenue],
        options: {
            chart: { type: 'donut', height: 200, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#f59e0b'],
            labels: ['Abonnements', 'À la carte'],
            legend: { position: 'bottom', fontSize: '10px', markers: { size: 4 } },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '11px' },
                            value: {
                                show: true,
                                fontSize: '16px',
                                fontWeight: 700,
                                formatter: (val: string) => money(Number(val)),
                            },
                            total: {
                                show: true,
                                label: 'CA',
                                fontSize: '10px',
                                formatter: () => money(metrics.totalRevenue),
                            },
                        },
                    },
                },
            },
            stroke: { width: 2, colors: ['#fff'] },
            tooltip: {
                y: {
                    formatter: (val: number) => `${money(val)} (${pct(val, metrics.totalRevenue)}%)`,
                },
            },
        },
    };
    const balanceHasData = metrics.totalPaid > 0 || metrics.expensesTotal > 0 || metrics.salariesTotal > 0;
    const balanceChart: any = {
        series: [Math.max(0, metrics.totalPaid), Math.max(0, metrics.expensesTotal), Math.max(0, metrics.salariesTotal)],
        options: {
            chart: { type: 'donut', height: 200, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#00ab55', '#e7515a', '#f59e0b'],
            labels: ['Encaissé', 'Dépenses', 'Salaires'],
            legend: { position: 'bottom', fontSize: '10px', markers: { size: 4 } },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '11px' },
                            value: {
                                show: true,
                                fontSize: '16px',
                                fontWeight: 700,
                                formatter: (val: string) => money(Number(val)),
                            },
                            total: {
                                show: true,
                                label: metrics.balance >= 0 ? 'Excédent' : 'Déficit',
                                fontSize: '10px',
                                formatter: () => money(Math.abs(metrics.balance)),
                            },
                        },
                    },
                },
            },
            stroke: { width: 2, colors: ['#fff'] },
            tooltip: {
                y: {
                    formatter: (val: number) => money(val),
                },
            },
        },
    };

    if (ol || el || sl)
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );

    return (
        <div className="space-y-6">
            {/* Period selector */}
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
                            onClick={() => setPeriod(p)}
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
                    {
                        label: "Chiffre d'affaires",
                        value: money(metrics.totalRevenue),
                        sub: `${metrics.totalOrders} commandes · ${metrics.subOrders} abo / ${metrics.alcOrders} ALC`,
                    },
                    {
                        label: 'Encaissé',
                        value: money(metrics.totalPaid),
                        sub: `${pct(metrics.totalPaid, metrics.totalRevenue)}% du CA`,
                        accent: 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                        label: 'Impayés',
                        value: money(metrics.totalPending),
                        sub: `${pct(metrics.totalPending, metrics.totalRevenue)}% restant`,
                        accent: metrics.totalPending > 0 ? 'text-red-500' : 'text-emerald-500',
                    },
                    {
                        label: metrics.balance >= 0 ? 'Excédent' : 'Déficit',
                        value: money(Math.abs(metrics.balance)),
                        sub: `Dép. ${money(metrics.expensesTotal)} + Sal. ${money(metrics.salariesTotal)}`,
                        accent: metrics.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                        border: metrics.balance >= 0 ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900',
                    },
                ].map((kpi: any) => (
                    <Card key={kpi.label} className={`p-5 ${kpi.border || ''}`}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${kpi.accent || 'text-slate-800 dark:text-white'}`}>{kpi.value}</p>
                        <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Facturé vs Encaissé — {now.getFullYear()}</h3>
                    <ApexChart series={areaChart.series} options={areaChart.options} type="area" height={240} />
                </Card>
                <Card className="p-5">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Mix revenus</h3>
                    {mixHasData ? (
                        <ApexChart series={mixChart.series} options={mixChart.options} type="donut" height={200} />
                    ) : (
                        <div className="flex h-[200px] flex-col items-center justify-center text-sm text-slate-400">
                            <span className="text-3xl">📊</span>
                            <p className="mt-2">Aucun revenu sur la période</p>
                        </div>
                    )}
                </Card>
                <Card className="p-5">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Flux financier</h3>
                    {balanceHasData ? (
                        <ApexChart series={balanceChart.series} options={balanceChart.options} type="donut" height={200} />
                    ) : (
                        <div className="flex h-[200px] flex-col items-center justify-center text-sm text-slate-400">
                            <span className="text-3xl">💰</span>
                            <p className="mt-2">Aucune transaction</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Bottom row */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Modes de paiement</h3>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {Object.entries(metrics.byMethod).length === 0 && <p className="py-6 text-center text-sm text-slate-400">Aucun paiement</p>}
                        {Object.entries(metrics.byMethod)
                            .sort((a, b) => b[1] - a[1])
                            .map(([method, amount]) => (
                                <div key={method} className="px-5 py-3">
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{method}</span>
                                        <span className="text-sm font-bold">{money(amount)}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct(amount, metrics.totalPaid)}%` }} />
                                    </div>
                                    <p className="mt-0.5 text-right text-[10px] text-slate-400">{pct(amount, metrics.totalPaid)}%</p>
                                </div>
                            ))}
                    </div>
                </Card>

                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Transactions récentes</h3>
                        <Link href="/apps/orders/list" className="text-xs text-primary hover:underline">
                            Voir tout →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                    {['Date', 'Client', 'Montant', 'Encaissé', 'Statut'].map((h) => (
                                        <th
                                            key={h}
                                            className={`px-5 py-2.5 text-xs font-semibold text-slate-400 ${
                                                h === 'Montant' || h === 'Encaissé' ? 'text-right' : h === 'Statut' ? 'text-center' : 'text-left'
                                            }`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {orders.slice(0, 8).map((o: any) => (
                                    <tr key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-5 py-2 text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-5 py-2 font-medium text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</td>
                                        <td className="px-5 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(o.totalPrice || 0)}</td>
                                        <td className="px-5 py-2 text-right text-emerald-600">{money(o.totalPaid || 0)}</td>
                                        <td className="px-5 py-2 text-center">
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
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                                            Aucune commande sur la période
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default FinanceDashboard;
