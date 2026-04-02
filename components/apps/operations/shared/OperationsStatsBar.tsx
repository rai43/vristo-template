'use client';
import React from 'react';
import { OperationStats, ViewTab } from '../types';

interface StatsBarProps {
    stats: OperationStats;
    activeView: ViewTab;
    onViewChange: (_view: ViewTab) => void;
    pickupCount: number;
    deliveryCount: number;
    stockCount: number;
}

const statCards: Array<{
    key: keyof OperationStats;
    label: string;
    targetView: ViewTab;
    bg: string;
    text: string;
    ring: string;
}> = [
    {
        key: 'total',
        label: 'Total opérations',
        targetView: 'daily',
        bg: 'bg-slate-50 dark:bg-slate-800/60',
        text: 'text-slate-700 dark:text-slate-200',
        ring: 'ring-slate-300',
    },
    {
        key: 'awaitingPickup',
        label: 'Récup. en attente',
        targetView: 'pickups',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        ring: 'ring-amber-300',
    },
    {
        key: 'overduePickups',
        label: 'Retard récup.',
        targetView: 'priority',
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-600 dark:text-red-400',
        ring: 'ring-red-300',
    },
    {
        key: 'readyForDelivery',
        label: 'Prêt livraison',
        targetView: 'deliveries',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        ring: 'ring-emerald-300',
    },
    {
        key: 'inStock',
        label: 'En stock',
        targetView: 'stock',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        ring: 'ring-blue-300',
    },
    {
        key: 'toWashToday',
        label: 'À laver',
        targetView: 'daily',
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        text: 'text-orange-700 dark:text-orange-400',
        ring: 'ring-orange-300',
    },
];

const OperationsStatsBar = ({ stats, activeView, onViewChange }: StatsBarProps) => {
    return (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((card) => {
                const value = stats[card.key] ?? 0;
                const isActive = activeView === card.targetView;
                const hasValue = value > 0;
                return (
                    <button
                        key={card.key}
                        type="button"
                        onClick={() => onViewChange(card.targetView)}
                        className={`relative rounded-xl px-3.5 py-3 text-left transition-all duration-150 ${card.bg} ${
                            isActive ? `ring-2 ${card.ring} shadow-sm` : 'ring-1 ring-transparent hover:ring-1 hover:ring-slate-200 dark:hover:ring-slate-600'
                        }`}
                    >
                        <div className={`text-2xl font-bold tabular-nums leading-none ${hasValue ? card.text : 'text-slate-300 dark:text-slate-600'}`}>{value}</div>
                        <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">{card.label}</div>
                    </button>
                );
            })}
        </div>
    );
};

export default OperationsStatsBar;
