'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDashboardMonthlyRevenue, getDashboardStats } from '@/lib/api/dashboard';
import { getOrders } from '@/lib/api/orders';
import { useAuth } from '@/hooks/useAuth';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import PeriodSelector from '@/components/common/PeriodSelector';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

const KPICard = ({ label, value, sub, accent = 'text-slate-800 dark:text-white' }: { label: string; value: string; sub?: string; accent?: string }) => (
    <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
);

const ComponentsDashboardFinance = () => {
    const { isAdmin } = useAuth();
    const router = useRouter();

    const periodHook = useOperationalPeriod({ defaultToAll: true });
    const dateFrom = periodHook.dateFrom;
    const dateTo = periodHook.dateTo;
    const year = new Date().getFullYear();

    const { data: statsData, isLoading } = useQuery({
        queryKey: ['dashboard', 'finance', dateFrom, dateTo],
        queryFn: () => getDashboardStats({ dateFrom, dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    const { data: monthlyData } = useQuery({
        queryKey: ['dashboard', 'monthly', year],
        queryFn: () => getDashboardMonthlyRevenue({ year }),
        staleTime: 120_000,
        enabled: isAdmin,
    });

    const { data: ordersRaw } = useQuery({
        queryKey: ['orders', 'finance', dateFrom, dateTo],
        queryFn: () => getOrders({ limit: 500, startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
        enabled: isAdmin,
    });

    // Restrict to admin and super_admin only
    if (!isAdmin) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="text-center">
                    <p className="text-6xl">🔒</p>
                    <h2 className="mt-4 text-xl font-bold text-slate-700 dark:text-white">Accès restreint</h2>
                    <p className="mt-2 text-sm text-slate-500">Le tableau de bord financier est réservé aux administrateurs.</p>
                    <button onClick={() => router.push('/apps/orders')} className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white">
                        Aller aux commandes
                    </button>
                </div>
            </div>
        );
    }

    const s = statsData?.data;
    const orders: any[] = (ordersRaw as any)?.data?.data || [];
    const monthly: any[] = (monthlyData as any)?.data || [];

    const totalRevenue = s?.paymentStats?.totalAmount ?? 0;
    const outstanding = s?.paymentStats?.outstandingAmount ?? 0;
    const totalPayments = s?.paymentStats?.totalPayments ?? 0;
    const collectionRate = pct(totalRevenue, totalRevenue + outstanding);
    const byMethod: any[] = s?.paymentStats?.byMethod ?? [];

    // outstanding by order
    const unpaidOrders = orders.filter((o) => o.paymentStatus !== 'paid' && (o.totalPrice || 0) > (o.totalPaid || 0));
    const unpaidTotal = unpaidOrders.reduce((s, o) => s + ((o.totalPrice || 0) - (o.totalPaid || 0)), 0);

    // Revenue area chart
    const areaChart: any = {
        series: [{ name: 'Encaissements', data: monthly.map((m) => m.revenue || 0) }],
        options: {
            chart: {
                type: 'area',
                height: 220,
                toolbar: { show: false },
                fontFamily: 'inherit',
                background: 'transparent',
                sparkline: { enabled: false },
            },
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02 } },
            colors: ['#4361ee'],
            dataLabels: { enabled: false },
            xaxis: { categories: monthly.map((m) => m.month || ''), labels: { style: { fontSize: '10px' } } },
            yaxis: {
                labels: {
                    formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)),
                    style: { fontSize: '10px' },
                },
            },
            grid: { borderColor: 'rgba(100,100,100,0.08)' },
            tooltip: { y: { formatter: (v: number) => money(v) } },
        },
    };

    // Payment methods donut
    const methodChart: any = {
        series: byMethod.map((m) => m.total || 0),
        options: {
            chart: { type: 'donut', height: 220, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#00ab55', '#e2a03f', '#00bcd4', '#805dca'],
            labels: byMethod.map((m) => m._id || 'Autre'),
            legend: { position: 'bottom', fontSize: '11px' },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '68%',
                        labels: { show: true, total: { show: true, label: 'Total', formatter: () => money(totalRevenue) } },
                    },
                },
            },
            stroke: { width: 2 },
        },
    };

    if (isLoading)
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Finance</h1>
                    <p className="mt-0.5 text-sm text-slate-400">Revenus, paiements et recouvrement</p>
                </div>
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
                <KPICard label="Encaissé" value={money(totalRevenue)} sub={`${totalPayments} paiement${totalPayments !== 1 ? 's' : ''}`} />
                <KPICard
                    label="Impayés"
                    value={money(outstanding)}
                    sub={`${unpaidOrders.length} commande${unpaidOrders.length !== 1 ? 's' : ''} concernée${unpaidOrders.length !== 1 ? 's' : ''}`}
                    accent={outstanding > 0 ? 'text-red-500' : 'text-emerald-500'}
                />
                <KPICard
                    label="Taux de recouvrement"
                    value={`${collectionRate}%`}
                    sub={collectionRate >= 90 ? 'Excellent' : collectionRate >= 70 ? 'Bien' : 'À améliorer'}
                    accent={collectionRate >= 90 ? 'text-emerald-500' : collectionRate >= 70 ? 'text-amber-500' : 'text-red-500'}
                />
                <KPICard label="Chiffre d'affaires" value={money(totalRevenue + outstanding)} sub={`Facturé (encaissé + impayé)`} />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Encaissements mensuels — {year}</h3>
                    {monthly.length > 0 ? (
                        <ApexChart series={areaChart.series} options={areaChart.options} type="area" height={220} />
                    ) : (
                        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                    )}
                </Card>
                <Card className="p-5 lg:col-span-2">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Répartition par mode</h3>
                    {byMethod.length > 0 ? (
                        <ApexChart series={methodChart.series} options={methodChart.options} type="donut" height={220} />
                    ) : (
                        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Aucun paiement</div>
                    )}
                </Card>
            </div>

            {/* Payment methods breakdown */}
            {byMethod.length > 0 && (
                <Card>
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Détail par mode de paiement</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">Mode</th>
                                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-400">Transactions</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">Montant total</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">% du total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {byMethod
                                    .sort((a, b) => b.total - a.total)
                                    .map((m, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-5 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{m._id || 'Autre'}</td>
                                            <td className="px-5 py-2.5 text-center text-slate-500">{m.count}</td>
                                            <td className="px-5 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{money(m.total)}</td>
                                            <td className="px-5 py-2.5 text-right text-slate-400">{pct(m.total, totalRevenue)}%</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Unpaid orders */}
            {unpaidOrders.length > 0 && (
                <Card>
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Commandes impayées / partielles</h3>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 dark:bg-red-500/10">{money(unpaidTotal)} à recouvrer</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-50 dark:border-slate-800">
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">Client</th>
                                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400">N° Commande</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">Total</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">Payé</th>
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-400">Restant</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {unpaidOrders.slice(0, 10).map((o: any) => {
                                    const rest = (o.totalPrice || 0) - (o.totalPaid || 0);
                                    return (
                                        <tr key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{o.customerId?.name || '—'}</td>
                                            <td className="px-5 py-2.5 font-mono text-[10px] text-slate-400">{o.orderId}</td>
                                            <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-300">{money(o.totalPrice || 0)}</td>
                                            <td className="px-5 py-2.5 text-right text-emerald-600">{money(o.totalPaid || 0)}</td>
                                            <td className="px-5 py-2.5 text-right font-bold text-red-500">{money(rest)}</td>
                                            <td className="px-3">
                                                <Link href={`/apps/orders/view?id=${o.orderId}`} className="text-xs text-primary hover:underline">
                                                    →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default ComponentsDashboardFinance;
