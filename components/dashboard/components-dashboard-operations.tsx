'use client';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getAllOperations, getOrders } from '@/lib/api/orders';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import PeriodSelector from '@/components/common/PeriodSelector';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
);

const STATUS_FR: Record<string, string> = {
    en_attente: 'En attente',
    pending: 'En attente',
    enregistrement: 'Enregistré',
    registered: 'Enregistré',
    en_traitement: 'En traitement',
    processing: 'En traitement',
    pret_livraison: 'Prêt livraison',
    ready_for_delivery: 'Prêt livraison',
    out_for_delivery: 'En livraison',
    not_delivered: 'Pas livré',
    delivered: 'Livré',
    returned: 'Retourné',
    cancelled: 'Annulé',
};

const STATUS_COLOR: Record<string, string> = {
    en_attente: '#94a3b8',
    pending: '#94a3b8',
    enregistrement: '#00bcd4',
    registered: '#00bcd4',
    en_traitement: '#4361ee',
    processing: '#4361ee',
    pret_livraison: '#e2a03f',
    ready_for_delivery: '#e2a03f',
    out_for_delivery: '#805dca',
    not_delivered: '#e7515a',
    delivered: '#00ab55',
    returned: '#ff6b6b',
    cancelled: '#6b7280',
};

const ComponentsDashboardOperations = () => {
    const today = useMemo(() => new Date(), []);

    const periodHook = useOperationalPeriod({ defaultToAll: true });
    const dateFrom = periodHook.dateFrom;
    const dateTo = periodHook.dateTo;

    const { data: opsData, isLoading: opsLoading } = useQuery({
        queryKey: ['operations', 'dashboard', dateFrom, dateTo],
        queryFn: () => getAllOperations({ startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
    });

    const { data: ordersData } = useQuery({
        queryKey: ['orders', 'ops-dashboard', dateFrom, dateTo],
        queryFn: () => getOrders({ limit: 500, startDate: dateFrom, endDate: dateTo }),
        staleTime: 60_000,
    });

    const operations: any[] = useMemo(() => (opsData as any)?.data?.operations || [], [opsData]);
    const orders: any[] = useMemo(() => (ordersData as any)?.data?.data || [], [ordersData]);

    const metrics = useMemo(() => {
        const todayStr = today.toDateString();
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const todayOps = operations.filter((op) => new Date(op.date).toDateString() === todayStr);
        const weekOps = operations.filter((op) => new Date(op.date) >= weekStart);
        const overdue = operations.filter((op) => op.isOverdue);
        const pickup = operations.filter((op) => op.operationType === 'pickup');
        const delivery = operations.filter((op) => op.operationType === 'delivery');
        const readyForDelivery = operations.filter((op) => op.status === 'ready_for_delivery');
        const inStock = operations.filter((op) => ['registered', 'processing'].includes(op.status));
        const delivered = operations.filter((op) => op.status === 'delivered');
        const notDelivered = operations.filter((op) => op.status === 'not_delivered');
        const outForDelivery = operations.filter((op) => op.status === 'out_for_delivery');

        // status distribution
        const statusCounts: Record<string, number> = {};
        operations.forEach((op) => {
            const key = STATUS_FR[op.status] || op.status;
            statusCounts[key] = (statusCounts[key] || 0) + 1;
        });

        // daily trend (last 14 days)
        const dailyMap: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            dailyMap[d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })] = 0;
        }
        operations.forEach((op) => {
            const d = new Date(op.date);
            const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            if (dailyMap[key] !== undefined) dailyMap[key]++;
        });

        return {
            total: operations.length,
            today: todayOps.length,
            week: weekOps.length,
            overdue: overdue.length,
            pickup: pickup.length,
            delivery: delivery.length,
            readyForDelivery: readyForDelivery.length,
            inStock: inStock.length,
            delivered: delivered.length,
            notDelivered: notDelivered.length,
            outForDelivery: outForDelivery.length,
            statusCounts,
            dailyMap,
        };
    }, [operations, today]);

    // Daily trend bar chart
    const dailyLabels = Object.keys(metrics.dailyMap);
    const trendChart: any = {
        series: [{ name: 'Opérations', data: dailyLabels.map((k) => metrics.dailyMap[k]) }],
        options: {
            chart: { type: 'bar', height: 180, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
            colors: ['#4361ee'],
            dataLabels: { enabled: false },
            xaxis: { categories: dailyLabels, labels: { style: { fontSize: '9px' } } },
            yaxis: { labels: { style: { fontSize: '9px' } }, min: 0 },
            grid: { borderColor: 'rgba(100,100,100,0.08)' },
        },
    };

    // Status donut
    const statusKeys = Object.keys(metrics.statusCounts);
    const statusHasData = statusKeys.length > 0 && statusKeys.some((k) => metrics.statusCounts[k] > 0);
    const statusChart: any = {
        series: statusKeys.map((k) => metrics.statusCounts[k]),
        options: {
            chart: { type: 'donut', height: 240, fontFamily: 'inherit', background: 'transparent' },
            colors: statusKeys.map((k) => {
                const eng = Object.entries(STATUS_FR).find(([, v]) => v === k)?.[0] || k;
                return STATUS_COLOR[eng] || '#94a3b8';
            }),
            labels: statusKeys,
            legend: { position: 'bottom', fontSize: '10px', markers: { size: 4 } },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '12px' },
                            value: { show: true, fontSize: '18px', fontWeight: 700 },
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '11px',
                                formatter: () => String(metrics.total),
                            },
                        },
                    },
                },
            },
            stroke: { width: 2, colors: ['#fff'] },
            tooltip: {
                y: {
                    formatter: (val: number) => `${val} opération${val !== 1 ? 's' : ''} (${metrics.total > 0 ? Math.round((val / metrics.total) * 100) : 0}%)`,
                },
            },
        },
    };

    // Type donut (pickup vs delivery)
    const typeHasData = metrics.pickup > 0 || metrics.delivery > 0;
    const typeChart: any = {
        series: [metrics.pickup, metrics.delivery],
        options: {
            chart: { type: 'donut', height: 240, fontFamily: 'inherit', background: 'transparent' },
            colors: ['#4361ee', '#00ab55'],
            labels: ['Récupérations', 'Livraisons'],
            legend: { position: 'bottom', fontSize: '11px', markers: { size: 4 } },
            dataLabels: { enabled: false },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            name: { show: true, fontSize: '12px' },
                            value: { show: true, fontSize: '18px', fontWeight: 700 },
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '11px',
                                formatter: () => String(metrics.pickup + metrics.delivery),
                            },
                        },
                    },
                },
            },
            stroke: { width: 2, colors: ['#fff'] },
            tooltip: {
                y: {
                    formatter: (val: number) => {
                        const t = metrics.pickup + metrics.delivery;
                        return `${val} (${t > 0 ? Math.round((val / t) * 100) : 0}%)`;
                    },
                },
            },
        },
    };

    if (opsLoading)
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
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Tableau de bord Opérations</h1>
                    <p className="mt-0.5 text-sm text-slate-400">
                        {today.toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}{' '}
                        · Suivi des récupérations, traitements et livraisons
                    </p>
                </div>
                <Link href="/apps/operations" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                    Gérer les opérations →
                </Link>
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

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                    {
                        label: 'Opérations',
                        val: metrics.total,
                        sub: `${metrics.pickup} récup. · ${metrics.delivery} livr.`,
                        color: 'text-slate-800 dark:text-white',
                    },
                    {
                        label: "Aujourd'hui",
                        val: metrics.today,
                        sub: metrics.overdue > 0 ? `${metrics.overdue} en retard · ${metrics.week} cette sem.` : `${metrics.week} cette semaine`,
                        color: metrics.today > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400',
                    },
                    {
                        label: 'En retard',
                        val: metrics.overdue,
                        sub: metrics.overdue > 0 ? 'Action requise' : 'Aucun retard',
                        color: metrics.overdue > 0 ? 'text-red-500' : 'text-emerald-500',
                    },
                    {
                        label: 'Prêts livraison',
                        val: metrics.readyForDelivery,
                        sub: metrics.inStock > 0 ? `${metrics.inStock} en traitement` : 'Aucun en traitement',
                        color: metrics.readyForDelivery > 0 ? 'text-amber-500' : 'text-slate-400',
                    },
                ].map((kpi) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.val}</p>
                        <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Second row stats */}
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                {[
                    { label: 'Récupérations', val: metrics.pickup },
                    { label: 'Livraisons', val: metrics.delivery },
                    { label: 'En traitement', val: metrics.inStock },
                    { label: 'En livraison', val: metrics.outForDelivery },
                    { label: 'Livrés', val: metrics.delivered },
                    { label: 'Pas livré', val: metrics.notDelivered },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 text-center dark:border-slate-700/50 dark:bg-slate-800/30">
                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{s.val}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Activité (14 derniers jours)</h3>
                    <ApexChart series={trendChart.series} options={trendChart.options} type="bar" height={180} />
                </Card>
                <Card className="p-5">
                    <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">Par statut</h3>
                    {statusHasData ? (
                        <ApexChart series={statusChart.series} options={statusChart.options} type="donut" height={240} />
                    ) : (
                        <div className="flex h-[240px] flex-col items-center justify-center text-sm text-slate-400">
                            <span className="text-3xl">📊</span>
                            <p className="mt-2">Aucune opération</p>
                        </div>
                    )}
                </Card>
                <Card className="p-5">
                    <h3 className="mb-2 font-semibold text-slate-800 dark:text-white">Récup. / Livr.</h3>
                    {typeHasData ? (
                        <ApexChart series={typeChart.series} options={typeChart.options} type="donut" height={240} />
                    ) : (
                        <div className="flex h-[240px] flex-col items-center justify-center text-sm text-slate-400">
                            <span className="text-3xl">📊</span>
                            <p className="mt-2">Aucune opération</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Status breakdown table */}
            {Object.keys(metrics.statusCounts).length > 0 && (
                <Card>
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Répartition détaillée par statut</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
                        {Object.entries(metrics.statusCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([label, count]) => {
                                const engKey = Object.entries(STATUS_FR).find(([, v]) => v === label)?.[0] || label;
                                const color = STATUS_COLOR[engKey] || '#94a3b8';
                                const pctVal = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                                return (
                                    <div key={label} className="rounded-lg border border-slate-100 p-3 dark:border-slate-700/30">
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{count}</p>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                            <div className="h-full rounded-full" style={{ width: `${pctVal}%`, backgroundColor: color }} />
                                        </div>
                                        <p className="mt-1 text-[10px] text-slate-400">{pctVal}%</p>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    {
                        href: '/apps/operations',
                        title: 'Centre des opérations',
                        desc: 'Gérer toutes les opérations',
                        sub: `${metrics.today} planifiées aujourd'hui`,
                    },
                    {
                        href: '/apps/operations?view=calendar',
                        title: 'Calendrier',
                        desc: 'Vue temporelle des opérations',
                        sub: `${metrics.week} cette semaine`,
                    },
                    {
                        href: '/apps/orders/list',
                        title: 'Commandes',
                        desc: 'Voir toutes les commandes',
                        sub: `${orders.length} commandes au total`,
                    },
                ].map((c) => (
                    <Link
                        key={c.href}
                        href={c.href}
                        className="group rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/50 dark:bg-[#1a2234]"
                    >
                        <h3 className="font-semibold text-slate-800 group-hover:text-primary dark:text-white">{c.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{c.desc}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>{c.sub}</span>
                            <span className="text-primary">→</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ComponentsDashboardOperations;
