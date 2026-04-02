'use client';
import React from 'react';
import IconSearch from '@/components/icon/icon-search';
import { OperationalPeriod } from '@/lib/api/operational-periods';

interface FilterBarProps {
    dateFrom: string;
    dateTo: string;
    searchQuery: string;
    onDateFromChange: (_val: string) => void;
    onDateToChange: (_val: string) => void;
    onSearchChange: (_val: string) => void;
    onResetWeek: () => void;
    // Operational period props
    periods?: OperationalPeriod[];
    selectedPeriodId?: string | null;
    onSelectPeriod?: (_id: string) => void;
    isCustom?: boolean;
    onClearCustom?: () => void;
    isLoadingPeriods?: boolean;
    isAllPeriods?: boolean;
}

const OperationsFilterBar = ({
    dateFrom,
    dateTo,
    searchQuery,
    onDateFromChange,
    onDateToChange,
    onSearchChange,
    onResetWeek,
    periods,
    selectedPeriodId,
    onSelectPeriod,
    isCustom,
    onClearCustom,
    isLoadingPeriods,
    isAllPeriods,
}: FilterBarProps) => {
    const hasPeriods = periods && periods.length > 0;

    const formatShortDate = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        } catch {
            return iso;
        }
    };

    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/60 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700/40 dark:bg-[#1a2234]/95">
            {/* Period selector */}
            {hasPeriods && onSelectPeriod && (
                <div className="flex items-center gap-1.5">
                    <select
                        className="h-7 rounded-md border-slate-200/80 bg-slate-50 px-2 text-xs font-medium text-slate-700 focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                        value={isCustom ? '__custom__' : isAllPeriods ? '__all__' : selectedPeriodId || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val !== '__custom__') {
                                onSelectPeriod(val);
                            }
                        }}
                        disabled={isLoadingPeriods}
                    >
                        {periods.length > 1 && (
                            <option value="__all__">📊 Tout l&apos;exercice</option>
                        )}
                        {periods.map((p) => (
                            <option key={p._id} value={p._id}>
                                {p.name}
                                {p.isCurrent ? ' ★' : ''}
                                {' — '}
                                {formatShortDate(p.startDate)} → {formatShortDate(p.endDate)}
                            </option>
                        ))}
                        {isCustom && <option value="__custom__">📅 Personnalisé</option>}
                    </select>
                    {isCustom && onClearCustom && (
                        <button
                            type="button"
                            className="h-7 rounded-md bg-primary/10 px-2 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
                            onClick={onClearCustom}
                            title="Revenir à la période sélectionnée"
                        >
                            ↩
                        </button>
                    )}
                </div>
            )}

            {/* Date range */}
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Du</span>
                <input
                    type="date"
                    className="h-7 border-0 bg-transparent p-0 text-xs font-medium text-slate-700 focus:ring-0 dark:text-slate-200"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                />
                <span className="text-slate-300 dark:text-slate-600">—</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Au</span>
                <input
                    type="date"
                    className="h-7 border-0 bg-transparent p-0 text-xs font-medium text-slate-700 focus:ring-0 dark:text-slate-200"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                />
            </div>

            <button
                type="button"
                className="h-7 rounded-md bg-slate-100 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                onClick={onResetWeek}
            >
                Cette semaine
            </button>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full sm:w-56">
                <input
                    type="text"
                    className="form-input h-8 w-full rounded-lg border-slate-200/80 bg-slate-50 pl-8 text-xs dark:border-slate-700 dark:bg-slate-800/60"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
        </div>
    );
};

export default OperationsFilterBar;
