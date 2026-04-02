'use client';
import React from 'react';
import { ViewTab } from '../types';

interface TabNavProps {
    activeView: ViewTab;
    onViewChange: (_view: ViewTab) => void;
    counts: {
        priority: number;
        pickups: number;
        deliveries: number;
        stock: number;
    };
}

const tabs: Array<{
    key: ViewTab;
    label: string;
    countKey?: keyof TabNavProps['counts'];
    activeClass: string;
    badgeClass: string;
}> = [
    { key: 'daily', label: 'Quotidien', activeClass: 'bg-primary text-white', badgeClass: '' },
    { key: 'calendar', label: 'Calendrier', activeClass: 'bg-primary text-white', badgeClass: '' },
    {
        key: 'priority',
        label: 'Priorités',
        countKey: 'priority',
        activeClass: 'bg-red-500 text-white',
        badgeClass: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
    },
    {
        key: 'pickups',
        label: 'Récupérations',
        countKey: 'pickups',
        activeClass: 'bg-amber-500 text-white',
        badgeClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    },
    {
        key: 'deliveries',
        label: 'Livraisons',
        countKey: 'deliveries',
        activeClass: 'bg-emerald-500 text-white',
        badgeClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    },
    {
        key: 'stock',
        label: 'En Stock',
        countKey: 'stock',
        activeClass: 'bg-blue-500 text-white',
        badgeClass: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    },
];

const OperationsTabNav = ({ activeView, onViewChange, counts }: TabNavProps) => {
    return (
        <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => {
                const isActive = activeView === tab.key;
                const count = tab.countKey ? counts[tab.countKey] : undefined;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onViewChange(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-150 ${
                            isActive
                                ? `${tab.activeClass} shadow-sm`
                                : 'bg-white text-slate-500 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-700 dark:bg-[#1a2234] dark:text-slate-400 dark:ring-slate-700/50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {tab.label}
                        {count !== undefined && count > 0 && (
                            <span
                                className={`inline-flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                                    isActive ? 'bg-white/25 text-white' : tab.badgeClass
                                }`}
                            >
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default OperationsTabNav;
