'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Operation, OperationStatus } from '../types';
import { STATUS_CONFIG, formatDateShort } from '../utils';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardTabProps {
    operations: Operation[];
    search: (_ops: Operation[]) => Operation[];
    onViewOrder: (_orderId: string) => void;
}

const DashboardTab = ({ operations, search }: DashboardTabProps) => {
    const filtered = search(operations);

    // ── KPI values ─────────────────────────────────────────
    const kpis = useMemo(() => {
        const active = filtered.filter((op) => !op.isTerminal);
        return {
            total: filtered.length,
            activeTotal: active.length,
            pickupsPending: active.filter((op) => op.operationType === 'pickup' && op.status === 'pending').length,
            deliveriesReady: active.filter((op) => op.isReadyForDelivery).length,
            overdue: active.filter((op) => op.isOverdue).length,
            completed: filtered.filter((op) => op.status === 'delivered').length,
            inStock: active.filter((op) => op.status === 'registered' && op.operationType === 'pickup').length,
            avgDaysInStock: (() => {
                const stockOps = active.filter((op) => op.status === 'registered' && op.operationType === 'pickup');
                if (!stockOps.length) return 0;
                const sum = stockOps.reduce((acc, op) => acc + (op.daysAfterPickup || 0), 0);
                return Math.round(sum / stockOps.length);
            })(),
        };
    }, [filtered]);

    // ── Status breakdown for donut ─────────────────────────
    const statusChart = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach((op) => {
            counts[op.status] = (counts[op.status] || 0) + 1;
        });
        const statuses = Object.keys(counts) as OperationStatus[];
        const colorMap: Record<string, string> = {
            pending: '#94a3b8',
            confirmed: '#2196f3',
            registered: '#2196f3',
            processing: '#4361ee',
            ready_for_delivery: '#00ab55',
            out_for_delivery: '#e2a03f',
            not_delivered: '#e7515a',
            delivered: '#00ab55',
            returned: '#e7515a',
            cancelled: '#805dca',
        };
        return {
            labels: statuses.map((s) => STATUS_CONFIG[s]?.label || s),
            series: statuses.map((s) => counts[s]),
            colors: statuses.map((s) => colorMap[s] || '#94a3b8'),
        };
    }, [filtered]);

    // ── Daily counts bar chart ─────────────────────────────
    const dailyChart = useMemo(() => {
        const dayMap: Record<string, { pickups: number; deliveries: number }> = {};
        filtered.forEach((op) => {
            const day = op.date?.split('T')[0] || '';
            if (!dayMap[day]) dayMap[day] = { pickups: 0, deliveries: 0 };
            if (op.operationType === 'pickup') dayMap[day].pickups++;
            else dayMap[day].deliveries++;
        });
        const sortedDays = Object.keys(dayMap).sort();
        return {
            categories: sortedDays.map((d) => formatDateShort(d)),
            pickups: sortedDays.map((d) => dayMap[d].pickups),
            deliveries: sortedDays.map((d) => dayMap[d].deliveries),
        };
    }, [filtered]);

    // ── Agent workload ─────────────────────────────────────
    const agentChart = useMemo(() => {
        const agentMap: Record<string, number> = {};
        filtered.filter((op) => !op.isTerminal).forEach((op) => {
            const agent = op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent;
            if (agent) agentMap[agent] = (agentMap[agent] || 0) + 1;
        });
        const sorted = Object.entries(agentMap).sort((a, b) => b[1] - a[1]);
        return {
            categories: sorted.map(([name]) => name),
            values: sorted.map(([, count]) => count),
        };
    }, [filtered]);

    // ── Zone distribution ──────────────────────────────────
    const zoneChart = useMemo(() => {
        const zoneMap: Record<string, number> = {};
        filtered.forEach((op) => {
            const zone = op.city || op.customer?.zone || 'Non défini';
            zoneMap[zone] = (zoneMap[zone] || 0) + 1;
        });
        const sorted = Object.entries(zoneMap).sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(([z]) => z),
            series: sorted.map(([, c]) => c),
        };
    }, [filtered]);

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const kpiCards = [
        { label: 'Total opérations', value: kpis.total, color: 'bg-slate-50 dark:bg-slate-800/60', textColor: 'text-slate-700 dark:text-slate-200', icon: '📊' },
        { label: 'Récup. en attente', value: kpis.pickupsPending, color: 'bg-amber-50 dark:bg-amber-500/10', textColor: 'text-amber-700 dark:text-amber-400', icon: '📦' },
        { label: 'Prêt livraison', value: kpis.deliveriesReady, color: 'bg-emerald-50 dark:bg-emerald-500/10', textColor: 'text-emerald-700 dark:text-emerald-400', icon: '🚚' },
        { label: 'En retard', value: kpis.overdue, color: 'bg-red-50 dark:bg-red-500/10', textColor: 'text-red-600 dark:text-red-400', icon: '⚠️' },
        { label: 'En stock', value: kpis.inStock, color: 'bg-blue-50 dark:bg-blue-500/10', textColor: 'text-blue-700 dark:text-blue-400', icon: '🏬' },
        { label: 'Moy. jours stock', value: `${kpis.avgDaysInStock}j`, color: 'bg-orange-50 dark:bg-orange-500/10', textColor: 'text-orange-700 dark:text-orange-400', icon: '⏱️' },
        { label: 'Livrées', value: kpis.completed, color: 'bg-green-50 dark:bg-green-500/10', textColor: 'text-green-700 dark:text-green-400', icon: '✅' },
        { label: 'Actives', value: kpis.activeTotal, color: 'bg-purple-50 dark:bg-purple-500/10', textColor: 'text-purple-700 dark:text-purple-400', icon: '🔄' },
    ];

    return (
        <div className="space-y-5">
            {/* ── KPI Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {kpiCards.map((card) => (
                    <div key={card.label} className={`rounded-xl px-4 py-3.5 ${card.color}`}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{card.icon}</span>
                            <div className={`text-2xl font-bold tabular-nums ${card.textColor}`}>{card.value}</div>
                        </div>
                        <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ────────────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-2">
                {/* Status Donut */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Répartition par statut</h3>
                    {statusChart.series.length > 0 ? (
                        <ReactApexChart
                            type="donut"
                            height={300}
                            series={statusChart.series}
                            options={{
                                chart: { fontFamily: 'Nunito, sans-serif' },
                                labels: statusChart.labels,
                                colors: statusChart.colors,
                                legend: { position: 'bottom', labels: { colors: textColor } },
                                plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', color: textColor } } } } },
                                dataLabels: { enabled: false },
                                stroke: { colors: isDark ? ['#1a2234'] : ['#fff'] },
                            }}
                        />
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                    )}
                </div>

                {/* Daily Counts Bar */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Opérations par jour</h3>
                    {dailyChart.categories.length > 0 ? (
                        <ReactApexChart
                            type="bar"
                            height={300}
                            series={[
                                { name: 'Récupérations', data: dailyChart.pickups },
                                { name: 'Livraisons', data: dailyChart.deliveries },
                            ]}
                            options={{
                                chart: { fontFamily: 'Nunito, sans-serif', stacked: true, toolbar: { show: false } },
                                xaxis: { categories: dailyChart.categories, labels: { style: { colors: textColor } } },
                                yaxis: { labels: { style: { colors: textColor } } },
                                colors: ['#e2a03f', '#00ab55'],
                                plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
                                grid: { borderColor: gridColor },
                                legend: { position: 'top', labels: { colors: textColor } },
                                dataLabels: { enabled: false },
                                tooltip: { theme: isDark ? 'dark' : 'light' },
                            }}
                        />
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                    )}
                </div>

                {/* Agent Workload */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Charge par agent</h3>
                    {agentChart.categories.length > 0 ? (
                        <ReactApexChart
                            type="bar"
                            height={Math.max(200, agentChart.categories.length * 40)}
                            series={[{ name: 'Opérations', data: agentChart.values }]}
                            options={{
                                chart: { fontFamily: 'Nunito, sans-serif', toolbar: { show: false } },
                                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
                                xaxis: { labels: { style: { colors: textColor } } },
                                yaxis: { labels: { style: { colors: textColor } } },
                                colors: ['#4361ee'],
                                grid: { borderColor: gridColor },
                                dataLabels: { enabled: true, style: { colors: ['#fff'] } },
                                tooltip: { theme: isDark ? 'dark' : 'light' },
                            }}
                        />
                    ) : (
                        <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">Aucun agent assigné</div>
                    )}
                </div>

                {/* Zone Distribution */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Répartition par zone</h3>
                    {zoneChart.labels.length > 0 ? (
                        <ReactApexChart
                            type="pie"
                            height={300}
                            series={zoneChart.series}
                            options={{
                                chart: { fontFamily: 'Nunito, sans-serif' },
                                labels: zoneChart.labels,
                                colors: ['#4361ee', '#00ab55', '#e2a03f', '#e7515a', '#805dca', '#2196f3', '#3b82f6', '#f97316'],
                                legend: { position: 'bottom', labels: { colors: textColor } },
                                dataLabels: { enabled: true, dropShadow: { enabled: false } },
                                stroke: { colors: isDark ? ['#1a2234'] : ['#fff'] },
                            }}
                        />
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardTab;

