'use client';
import React from 'react';
import { OperationalPeriod } from '@/lib/api/operational-periods';

interface PeriodSelectorProps {
    periods: OperationalPeriod[];
    selectedPeriodId: string | null;
    onSelectPeriod: (_periodId: string) => void;
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (_date: string) => void;
    onDateToChange: (_date: string) => void;
    isCustom: boolean;
    onClearCustom: () => void;
    isLoading?: boolean;
    compact?: boolean;
    isAllPeriods?: boolean; // True when "Tout l'exercice" is selected
}

/**
 * Global date filter component with operational period presets.
 * - Dropdown to pick a predefined operational period
 * - Date inputs for manual override ("Personnalisé")
 * - The latest period is auto-selected
 */
const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    periods,
    selectedPeriodId,
    onSelectPeriod,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    isCustom,
    onClearCustom,
    isLoading,
    compact,
    isAllPeriods,
}) => {
    const formatShortDate = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return iso;
        }
    };

    const selectedPeriod = periods.find((p) => p._id === selectedPeriodId);

    return (
        <div className={`flex flex-wrap items-end gap-3 ${compact ? 'gap-2' : 'gap-4'}`}>
            {/* Period dropdown */}
            <div className={compact ? 'min-w-[180px]' : 'min-w-[220px]'}>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Période d&apos;opération
                </label>
                <select
                    className="form-select w-full rounded-md border-slate-200 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    value={isCustom ? '__custom__' : isAllPeriods ? '__all__' : selectedPeriodId || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                            // Switch to custom — keep current dates
                            onDateFromChange(dateFrom);
                            onDateToChange(dateTo);
                        } else {
                            onSelectPeriod(val);
                        }
                    }}
                    disabled={isLoading || periods.length === 0}
                >
                    {isLoading && <option value="">Chargement...</option>}
                    {!isLoading && periods.length === 0 && <option value="">Aucune période</option>}
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
                    <option value="__custom__">📅 Personnalisé</option>
                </select>
            </div>

            {/* Date inputs — always visible, editable sets custom mode */}
            <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Du
                </label>
                <input
                    type="date"
                    className="form-input w-full rounded-md text-sm"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                />
            </div>
            <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Au
                </label>
                <input
                    type="date"
                    className="form-input w-full rounded-md text-sm"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    min={dateFrom}
                />
            </div>

            {/* Reset to selected period */}
            {isCustom && (selectedPeriod || isAllPeriods) && (
                <button
                    type="button"
                    className="btn btn-sm btn-outline-primary flex items-center gap-1.5"
                    onClick={onClearCustom}
                    title={isAllPeriods ? "Revenir à tout l'exercice" : `Revenir à ${selectedPeriod?.name}`}
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isAllPeriods ? "Tout l'exercice" : selectedPeriod?.name}
                </button>
            )}
        </div>
    );
};

export default PeriodSelector;






