'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { getOrders } from '@/lib/api/orders';
import { getExpenses } from '@/lib/api/expenses';
import { getSalaries } from '@/lib/api/salaries';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

type Period = 'month' | 'quarter' | 'year';

const FinancialReports = () => {
    const now = new Date();
    const [period, setPeriod] = useState<Period>('month');
    const [reportType, setReportType] = useState<'pnl' | 'cashflow' | 'expenses'>('pnl');

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
        queryKey: ['orders', 'reports'],
        queryFn: () => getOrders({ limit: 1000 }),
        staleTime: 60_000,
    });
    const { data: expensesRaw, isLoading: el } = useQuery({
        queryKey: ['expenses', 'reports'],
        queryFn: () => getExpenses(),
        staleTime: 60_000,
    });
    const { data: salariesRaw, isLoading: sl } = useQuery({
        queryKey: ['salaries', 'reports'],
        queryFn: () => getSalaries(),
        staleTime: 60_000,
    });

    const allOrders: any[] = useMemo(() => (ordersRaw as any)?.data?.data || [], [ordersRaw]);
    const allExpenses: any[] = useMemo(() => (expensesRaw as any) || [], [expensesRaw]);
    const allSalaries: any[] = useMemo(() => (salariesRaw as any) || [], [salariesRaw]);

    const inRange = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
    };
    const orders = useMemo(() => allOrders.filter((o) => inRange(o.createdAt)), [allOrders, start, end]);
    const expenses = useMemo(() => allExpenses.filter((e) => inRange(e.date)), [allExpenses, start, end]);
    const salaries = useMemo(
        () =>
            allSalaries.filter((s) => {
                const d = new Date((s.month || s.period || '2000-01') + '-01');
                return d >= new Date(start) && d <= new Date(end + 'T23:59:59');
            }),
        [allSalaries, start, end]
    );

    const report = useMemo(() => {
        const revenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const collected = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
        const pending = revenue - collected;
        const subRevenue = orders.filter((o) => o.type === 'subscription').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const alcRevenue = orders.filter((o) => o.type === 'a-la-carte').reduce((s, o) => s + (o.totalPrice || 0), 0);
        const expensesTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const salariesTotal = salaries.reduce((s, sal) => s + (sal.payments || []).reduce((ps: number, p: any) => ps + (p.amount || 0), 0), 0);
        const grossMargin = collected - expensesTotal;
        const netMargin = collected - expensesTotal - salariesTotal;

        // By category for expenses
        const byCategory: Record<string, number> = {};
        expenses.forEach((e) => {
            const c = e.category || 'Autre';
            byCategory[c] = (byCategory[c] || 0) + (e.amount || 0);
        });

        // Monthly cashflow
        const byMonth = Array(12)
            .fill(0)
            .map(() => ({ revenue: 0, collected: 0, expenses: 0, salaries: 0 }));
        allOrders.forEach((o) => {
            const m = new Date(o.createdAt).getMonth();
            if (new Date(o.createdAt).getFullYear() === now.getFullYear()) {
                byMonth[m].revenue += o.totalPrice || 0;
                byMonth[m].collected += o.totalPaid || 0;
            }
        });
        allExpenses.forEach((e) => {
            const m = new Date(e.date).getMonth();
            if (new Date(e.date).getFullYear() === now.getFullYear()) byMonth[m].expenses += e.amount || 0;
        });

        return {
            revenue,
            collected,
            pending,
            subRevenue,
            alcRevenue,
            expensesTotal,
            salariesTotal,
            grossMargin,
            netMargin,
            byCategory,
            byMonth,
            totalExpenses: expensesTotal + salariesTotal,
        };
    }, [orders, expenses, salaries, allOrders, allExpenses]);

    // P&L bar
    const pnlChart: any = {
        series: [
            { name: 'CA', data: report.byMonth.map((m) => m.revenue) },
            { name: 'Encaissé', data: report.byMonth.map((m) => m.collected) },
            { name: 'Dépenses', data: report.byMonth.map((m) => -m.expenses) },
        ],
        options: {
            chart: {
                type: 'bar',
                height: 240,
                stacked: false,
                toolbar: { show: false },
                fontFamily: 'inherit',
                background: 'transparent',
            },
            plotOptions: { bar: { borderRadius: 2, columnWidth: '50%' } },
            colors: ['#4361ee', '#00ab55', '#e7515a'],
            dataLabels: { enabled: false },
            xaxis: { categories: MONTHS_FR, labels: { style: { fontSize: '10px' } } },
            yaxis: {
                labels: {
                    formatter: (v: number) => (v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
                    style: { fontSize: '10px' },
                },
            },
            grid: { borderColor: 'rgba(100,100,100,0.08)' },
            tooltip: { y: { formatter: (v: number) => money(Math.abs(v)) } },
            legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px' },
        },
    };

    // Expense by category donut
    const catKeys = Object.keys(report.byCategory);
    const expCatChart: any = {
        series: catKeys.map((k) => report.byCategory[k]),
        options: {
            chart: { type: 'donut', height: 200, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#00ab55', '#e7515a', '#e2a03f', '#805dca', '#00bcd4', '#94a3b8'],
            labels: catKeys,
            legend: { position: 'bottom', fontSize: '10px' },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: {
                            show: true,
                            total: { show: true, label: 'Total', formatter: () => money(report.expensesTotal) },
                        },
                    },
                },
            },
            stroke: { width: 2 },
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
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    {[
                        { key: 'pnl', label: 'P&L' },
                        { key: 'cashflow', label: 'Flux de trésorerie' },
                        {
                            key: 'expenses',
                            label: 'Dépenses',
                        },
                    ].map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => setReportType(r.key as any)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                reportType === r.key
                                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-800'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
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
                            {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trim.' : 'Année'}
                        </button>
                    ))}
                </div>
            </div>

            {/* P&L Summary */}
            {reportType === 'pnl' && (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[
                            {
                                label: "Chiffre d'affaires",
                                value: money(report.revenue),
                                sub: `${orders.length} commandes`,
                            },
                            {
                                label: 'Encaissé',
                                value: money(report.collected),
                                sub: `${pct(report.collected, report.revenue)}% du CA`,
                                accent: 'text-emerald-600',
                            },
                            {
                                label: 'Charges totales',
                                value: money(report.totalExpenses),
                                sub: `Dép. + Salaires`,
                                accent: 'text-red-500',
                            },
                            {
                                label: 'Marge nette',
                                value: money(report.netMargin),
                                sub: `${pct(report.netMargin, report.revenue)}% du CA`,
                                accent: report.netMargin >= 0 ? 'text-emerald-600' : 'text-red-500',
                            },
                        ].map((kpi: any) => (
                            <Card key={kpi.label} className="p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                                <p className={`mt-2 text-2xl font-bold ${kpi.accent || 'text-slate-800 dark:text-white'}`}>{kpi.value}</p>
                                <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                            </Card>
                        ))}
                    </div>
                    <Card className="p-5">
                        <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Compte de résultat — {now.getFullYear()}</h3>
                        <ApexChart series={pnlChart.series} options={pnlChart.options} type="bar" height={240} />
                    </Card>
                    {/* P&L table */}
                    <Card>
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                            <h3 className="font-semibold text-slate-800 dark:text-white">
                                Résumé P&L — {start} → {end}
                            </h3>
                        </div>
                        <div className="p-5">
                            {[
                                {
                                    label: 'Revenus (abonnements)',
                                    value: report.subRevenue,
                                    accent: 'text-slate-700 dark:text-slate-200',
                                },
                                {
                                    label: 'Revenus (à la carte)',
                                    value: report.alcRevenue,
                                    accent: 'text-slate-700 dark:text-slate-200',
                                },
                                {
                                    label: 'Total revenus',
                                    value: report.revenue,
                                    accent: 'font-bold text-slate-800 dark:text-white',
                                    border: true,
                                },
                                { label: 'Impayés (non-recouvré)', value: -report.pending, accent: 'text-red-500' },
                                {
                                    label: 'Revenus encaissés',
                                    value: report.collected,
                                    accent: 'text-emerald-600 font-semibold',
                                    border: true,
                                },
                                {
                                    label: '— Dépenses opérationnelles',
                                    value: -report.expensesTotal,
                                    accent: 'text-red-500',
                                },
                                { label: '— Salaires décaissés', value: -report.salariesTotal, accent: 'text-red-500' },
                                {
                                    label: 'Résultat net',
                                    value: report.netMargin,
                                    accent: report.netMargin >= 0 ? 'font-bold text-emerald-600' : 'font-bold text-red-500',
                                    border: true,
                                },
                            ].map((row, i) => (
                                <div key={i} className={`flex items-center justify-between py-2 ${row.border ? 'mt-1 border-t border-slate-200 pt-2 dark:border-slate-700' : ''}`}>
                                    <span className="text-sm text-slate-600 dark:text-slate-300">{row.label}</span>
                                    <span className={`text-sm ${row.accent}`}>{row.value < 0 ? '(' + money(Math.abs(row.value)) + ')' : money(row.value)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </>
            )}

            {/* Cash flow */}
            {reportType === 'cashflow' && (
                <>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Entrées (encaissé)', value: money(report.collected), accent: 'text-emerald-600' },
                            {
                                label: 'Sorties (dép. + sal.)',
                                value: money(report.totalExpenses),
                                accent: 'text-red-500',
                            },
                            {
                                label: 'Flux net',
                                value: money(Math.abs(report.netMargin)),
                                sub: report.netMargin >= 0 ? 'Positif' : 'Négatif',
                                accent: report.netMargin >= 0 ? 'text-emerald-600' : 'text-red-500',
                            },
                        ].map((kpi: any) => (
                            <Card key={kpi.label} className="p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                                <p className={`mt-2 text-2xl font-bold ${kpi.accent}`}>{kpi.value}</p>
                                {kpi.sub && <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>}
                            </Card>
                        ))}
                    </div>
                    <Card className="p-5">
                        <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Flux de trésorerie mensuel</h3>
                        <ApexChart series={pnlChart.series} options={pnlChart.options} type="bar" height={240} />
                    </Card>
                </>
            )}

            {/* Expenses */}
            {reportType === 'expenses' && (
                <>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            {
                                label: 'Dépenses opérat.',
                                value: money(report.expensesTotal),
                                sub: `${expenses.length} entrées`,
                                accent: 'text-red-500',
                            },
                            {
                                label: 'Salaires décaissés',
                                value: money(report.salariesTotal),
                                sub: `${salaries.length} employés`,
                                accent: 'text-amber-500',
                            },
                            {
                                label: 'Charges totales',
                                value: money(report.totalExpenses),
                                sub: `${pct(report.totalExpenses, report.collected)}% du collecté`,
                                accent: 'text-red-500',
                            },
                        ].map((kpi: any) => (
                            <Card key={kpi.label} className="p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                                <p className={`mt-2 text-2xl font-bold ${kpi.accent}`}>{kpi.value}</p>
                                <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                            </Card>
                        ))}
                    </div>
                    <div className="grid gap-6 lg:grid-cols-5">
                        <Card className="p-5 lg:col-span-3">
                            <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Détail des dépenses</h3>
                            <div className="space-y-2">
                                {Object.entries(report.byCategory)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([cat, amt]) => (
                                        <div key={cat}>
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-sm text-slate-600 dark:text-slate-300">{cat}</span>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{money(amt)}</span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                                <div className="h-full rounded-full bg-red-400" style={{ width: `${pct(amt, report.expensesTotal)}%` }} />
                                            </div>
                                            <p className="mt-0.5 text-right text-[10px] text-slate-400">{pct(amt, report.expensesTotal)}%</p>
                                        </div>
                                    ))}
                                {Object.keys(report.byCategory).length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune dépense enregistrée</p>}
                            </div>
                        </Card>
                        <Card className="p-5 lg:col-span-2">
                            <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Répartition</h3>
                            {catKeys.length > 0 ? (
                                <ApexChart series={expCatChart.series} options={expCatChart.options} type="donut" height={200} />
                            ) : (
                                <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                            )}
                        </Card>
                    </div>
                    {/* Expenses list */}
                    <Card>
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                            <h3 className="font-semibold text-slate-800 dark:text-white">Journal des dépenses</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-50 dark:border-slate-800">
                                        {['Date', 'Description', 'Catégorie', 'Fournisseur', 'Mode', 'Montant', 'Statut'].map((h, i) => (
                                            <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 ${i === 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {expenses
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((e: any) => (
                                            <tr key={e._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-2 text-xs text-slate-400">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                                                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{e.description}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500">{e.category}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500">{e.vendor || '—'}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500">{e.paymentMethod}</td>
                                                <td className="px-4 py-2 text-right font-semibold text-red-500">{money(e.amount)}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                            e.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : e.status === 'approved' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                                                        }`}
                                                    >
                                                        {e.status === 'paid' ? 'Payé' : e.status === 'approved' ? 'Approuvé' : 'En attente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    {expenses.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-400">
                                                Aucune dépense sur la période
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default FinancialReports;
