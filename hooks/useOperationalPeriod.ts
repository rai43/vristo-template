'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OperationalPeriod, operationalPeriodsApi } from '@/lib/api/operational-periods';

const LS_KEY = 'mirai_selected_period';
const ALL_PERIODS_ID = '__all__';

interface UseOperationalPeriodOptions {
    /** When true, defaults to "Tout l'exercice" (all periods combined) instead of the current period. Ideal for dashboards. */
    defaultToAll?: boolean;
}

/**
 * Hook to manage operational period selection.
 * - Fetches all periods from the API
 * - Auto-selects the period marked `isCurrent` (or all periods if defaultToAll)
 * - Persists selection in localStorage
 * - Exposes dateFrom / dateTo for use as date filter defaults
 * - Supports "all periods" mode for dashboards (exercise = all periods combined)
 * - Allows manual override (custom dates)
 */
export function useOperationalPeriod(options?: UseOperationalPeriodOptions) {
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
    const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);

    // Fetch all periods
    const {
        data: periods = [],
        isLoading,
        refetch,
    } = useQuery<OperationalPeriod[]>({
        queryKey: ['operational-periods'],
        queryFn: () => operationalPeriodsApi.getAll(),
        staleTime: 5 * 60_000, // 5 min
    });

    // Auto-select on first load
    useEffect(() => {
        if (periods.length === 0) return;

        // Try localStorage first
        const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
        if (saved && (saved === ALL_PERIODS_ID || periods.some((p) => p._id === saved))) {
            setSelectedPeriodId(saved);
            return;
        }

        // Default to all periods for dashboards
        if (options?.defaultToAll) {
            setSelectedPeriodId(ALL_PERIODS_ID);
            return;
        }

        // Otherwise pick the one marked isCurrent, or the first one
        const current = periods.find((p) => p.isCurrent) || periods[0];
        if (current) {
            setSelectedPeriodId(current._id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periods]);

    // Persist selection
    useEffect(() => {
        if (selectedPeriodId && typeof window !== 'undefined') {
            localStorage.setItem(LS_KEY, selectedPeriodId);
        }
    }, [selectedPeriodId]);

    const isAllPeriods = selectedPeriodId === ALL_PERIODS_ID;
    const selectedPeriod = isAllPeriods ? null : (periods.find((p) => p._id === selectedPeriodId) || null);

    // Full exercise range (all periods combined)
    const exerciseRange = useMemo(() => {
        if (periods.length === 0) return null;
        const starts = periods.map((p) => p.startDate.split('T')[0]).sort();
        const ends = periods.map((p) => p.endDate.split('T')[0]).sort();
        return { dateFrom: starts[0], dateTo: ends[ends.length - 1] };
    }, [periods]);

    // Resolved dates — custom range > all periods > selected period > current month fallback
    const resolvedDates = (() => {
        if (customRange) {
            return { dateFrom: customRange.from, dateTo: customRange.to };
        }
        if (isAllPeriods && exerciseRange) {
            return exerciseRange;
        }
        if (selectedPeriod) {
            return {
                dateFrom: selectedPeriod.startDate.split('T')[0],
                dateTo: selectedPeriod.endDate.split('T')[0],
            };
        }
        // Fallback to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            dateFrom: firstDay.toISOString().split('T')[0],
            dateTo: lastDay.toISOString().split('T')[0],
        };
    })();

    const selectPeriod = useCallback(
        (periodId: string) => {
            setSelectedPeriodId(periodId);
            setCustomRange(null);
        },
        [],
    );

    const selectAllPeriods = useCallback(() => {
        setSelectedPeriodId(ALL_PERIODS_ID);
        setCustomRange(null);
    }, []);

    const setCustomDates = useCallback((from: string, to: string) => {
        setCustomRange({ from, to });
    }, []);

    const clearCustomRange = useCallback(() => {
        setCustomRange(null);
    }, []);

    const isCustom = customRange !== null;

    return {
        periods,
        selectedPeriod,
        selectedPeriodId,
        selectPeriod,
        isLoading,
        refetch,
        // Date range
        dateFrom: resolvedDates.dateFrom,
        dateTo: resolvedDates.dateTo,
        // All periods (exercise) mode
        isAllPeriods,
        selectAllPeriods,
        exerciseRange,
        // Custom range management
        isCustom,
        setCustomDates,
        clearCustomRange,
    };
}
