'use client';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllOperations, rescheduleOperation } from '@/lib/api/orders';
import { Lead, leadsApi, PACK_LABELS } from '@/lib/api/leads';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import Swal from 'sweetalert2';
import { CalendarEvent, DailyOperations, Operation, OperationStats, ViewTab } from './types';
import { filterBySearch, isToday } from './utils';

// ─── Helpers ───────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(['delivered', 'returned', 'cancelled']);

const getEventColorClass = (op: Operation): string => {
    if (op.isLead) return 'secondary'; // Purple for confirmed leads
    if (op.isOverdue) return 'danger';
    if (op.isLate) return 'danger';
    if (op.shouldBeInProgress) return 'info';
    if (op.isReadyForDelivery) return 'success';
    if (op.status === 'registered') return 'info';
    if (op.status === 'processing') return 'primary';
    if (op.status === 'out_for_delivery') return 'warning';
    if (op.status === 'not_delivered') return 'danger';
    if (op.status === 'delivered') return 'success';
    if (op.status === 'returned') return 'danger';
    if (op.status === 'cancelled') return 'secondary';
    if (op.operationType === 'pickup') return 'warning';
    return 'secondary';
};

// ─── Hook ──────────────────────────────────────────────────

export const useOperations = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    // ── State ──────────────────────────────────────────────
    const [activeView, setActiveView] = useState<ViewTab>('daily');

    // Operational period-based date filtering
    const periodHook = useOperationalPeriod();
    const dateFrom = periodHook.dateFrom;
    const dateTo = periodHook.dateTo;
    const setDateFrom = (d: string) => periodHook.setCustomDates(d, dateTo);
    const setDateTo = (d: string) => periodHook.setCustomDates(dateFrom, d);

    const [searchQuery, setSearchQuery] = useState('');

    // Calendar filters
    const [calendarOrderType, setCalendarOrderType] = useState<'all' | 'subscription' | 'a-la-carte'>('all');
    const [calendarOperationType, setCalendarOperationType] = useState<'all' | 'pickup' | 'delivery'>('all');

    // Delivery sub-view
    const [deliverySubView, setDeliverySubView] = useState<'inProgress' | 'completed'>('inProgress');

    // ── Fetch operations ───────────────────────────────────
    const {
        data: rawData,
        isLoading: isLoadingOps,
        refetch,
    } = useQuery({
        queryKey: ['operations', dateFrom, dateTo],
        queryFn: async () => {
            const res = await getAllOperations({ startDate: dateFrom, endDate: dateTo });
            return res.data as { operations: Operation[]; stats: OperationStats };
        },
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    // ── Fetch confirmed leads as potential operations ──────
    const { data: confirmedLeads, isLoading: isLoadingLeads } = useQuery({
        queryKey: ['leads-potential-operations'],
        queryFn: () => leadsApi.getPotentialOperations(),
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    const isLoading = isLoadingOps || isLoadingLeads;

    // Convert confirmed leads to Operation objects for display
    const leadOperations: Operation[] = useMemo(() => {
        if (!confirmedLeads?.length) return [];
        return confirmedLeads
            .filter((lead: Lead) => lead.preferredPickupDate)
            .map((lead: Lead) => {
                const packInfo = PACK_LABELS[lead.packChoice];
                return {
                    orderId: lead.leadId,
                    orderMongoId: lead._id,
                    operationType: 'pickup' as const,
                    operationIndex: 0,
                    date: lead.preferredPickupDate!,
                    status: 'pending' as const,
                    city: lead.zone || '',
                    customer: {
                        name: lead.name,
                        phone: lead.phones?.[0]?.number || '',
                        zone: lead.zone || '',
                    },
                    packName: packInfo?.label || lead.packChoice,
                    isOverdue: new Date(lead.preferredPickupDate!) < new Date(new Date().toDateString()),
                    isSubscription: lead.packChoice !== 'a_la_carte',
                    isLead: true, // marker for UI
                    note: 'Prospect confirmé — en attente de conversion',
                } as Operation & { isLead?: boolean };
            });
    }, [confirmedLeads]);

    const allOperations: Operation[] = useMemo(() => {
        const ops: Operation[] = [];
        if (rawData?.operations) {
            const now = new Date();
            rawData.operations.forEach((op) => {
                const opDate = new Date(op.date);
                const diffMs = now.getTime() - opDate.getTime();
                const isNew = diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;
                ops.push({ ...op, isNew });
            });
        }
        // Merge confirmed leads as potential operations
        ops.push(...leadOperations);
        return ops;
    }, [rawData, leadOperations]);

    const stats: OperationStats = useMemo(() => {
        if (!rawData?.operations) {
            return {
                total: 0,
                awaitingPickup: 0,
                overduePickups: 0,
                readyForDelivery: 0,
                overdueDeliveries: 0,
                shouldBeInProgress: 0,
                inStock: 0,
                toWashToday: 0,
                lateCount: 0,
            };
        }
        // Recompute from the same allOperations/activeOperations used by the tabs
        // so stats bar is always perfectly in sync with what each tab shows
        const active = allOperations.filter((op) => !op.isTerminal);
        return {
            total: active.length,
            awaitingPickup: active.filter((op) => op.operationType === 'pickup' && op.status === 'pending').length,
            overduePickups: active.filter((op) => op.operationType === 'pickup' && op.isOverdue).length,
            readyForDelivery: active.filter((op) => op.isReadyForDelivery).length,
            overdueDeliveries: active.filter((op) => op.operationType === 'delivery' && op.isOverdue).length,
            shouldBeInProgress: active.filter((op) => op.shouldBeInProgress).length,
            inStock: active.filter((op) => op.status === 'registered' && op.operationType === 'pickup').length,
            toWashToday: active.filter((op) => op.status === 'registered' && op.operationType === 'pickup' && (op.daysAfterPickup || 0) >= 3).length,
            lateCount: active.filter((op) => op.isLate).length,
        };
    }, [allOperations, rawData?.operations]);

    // ── Search helper ──────────────────────────────────────
    const search = useCallback((ops: Operation[]): Operation[] => filterBySearch(ops, searchQuery), [searchQuery]);

    // ── Reset date range ───────────────────────────────────
    const resetToCurrentWeek = useCallback(() => {
        const now = new Date();
        const day = now.getDay();
        const diffStart = day === 0 ? -6 : 1 - day;
        const diffEnd = day === 0 ? 0 : 7 - day;
        const start = new Date(now);
        start.setDate(now.getDate() + diffStart);
        const end = new Date(now);
        end.setDate(now.getDate() + diffEnd);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        periodHook.setCustomDates(startStr, endStr);
    }, [periodHook]);

    // ── Filtered operation sets ────────────────────────────
    // Active = non-terminal
    const activeOperations = useMemo(() => allOperations.filter((op) => !op.isTerminal), [allOperations]);

    // Daily view buckets
    const dailyOperations: DailyOperations = useMemo(() => {
        // À laver: ONLY status === 'registered' AND 3+ days since effective pickup (daysAfterPickup >= 3)
        // Only pickup operations (we have the items in shop)
        const toWash = activeOperations
            .filter((op) => op.status === 'registered' && op.operationType === 'pickup' && (op.daysAfterPickup || 0) >= 3)
            .sort((a, b) => (b.daysAfterPickup || 0) - (a.daysAfterPickup || 0));

        // Today's pickups (pending/registered/processing pickup ops scheduled for today)
        const toPickup = activeOperations.filter((op) => op.operationType === 'pickup' && isToday(op.date) && !TERMINAL_STATUSES.has(op.status));

        // Today's deliveries
        const toDeliver = activeOperations.filter((op) => op.operationType === 'delivery' && isToday(op.date) && !TERMINAL_STATUSES.has(op.status));

        // En traitement: ONLY status === 'processing'
        const inProgress = activeOperations.filter((op) => op.status === 'processing');

        return {
            urgentOps: [], // Kept for type compatibility but not used (use Priorités tab instead)
            toWashToday: toWash,
            toPickupToday: toPickup,
            toDeliverToday: toDeliver,
            inProgress,
        };
    }, [activeOperations]);

    // Priority: operations that need attention
    // Logic: show the right operation type based on the current phase
    // - not_delivered, out_for_delivery, ready_for_delivery → delivery phase (show delivery ops only)
    // - pending, registered, processing → pickup/processing phase (show pickup ops only)
    const priorityOperations: Operation[] = useMemo(() => {
        return activeOperations.filter((op) => {
            // Delivery-phase statuses: only show delivery operations
            const deliveryPhaseStatuses = ['not_delivered', 'out_for_delivery', 'ready_for_delivery'];
            if (deliveryPhaseStatuses.includes(op.status)) {
                return op.operationType === 'delivery';
            }
            // For pickup phase (pending with overdue), only show pickup operations
            if (op.status === 'pending' && op.isOverdue) {
                return op.operationType === 'pickup';
            }
            // Other priority conditions (isLate, shouldBeInProgress)
            if (op.isLate || op.shouldBeInProgress || op.isReadyForDelivery) {
                // isLate and shouldBeInProgress are typically on delivery ops
                return true;
            }
            return false;
        });
    }, [activeOperations]);

    // Pickup operations: only statuses relevant to pickup phase
    const pickupOperations: Operation[] = useMemo(() => {
        const pickupStatuses = new Set(['pending', 'registered', 'processing']);
        return activeOperations.filter((op) => op.operationType === 'pickup' && pickupStatuses.has(op.status));
    }, [activeOperations]);

    // All delivery operations (for tab badge)
    const allDeliveryOps: Operation[] = useMemo(() => allOperations.filter((op) => op.operationType === 'delivery'), [allOperations]);

    // Delivery operations filtered by sub-view
    const deliveryOperations: Operation[] = useMemo(() => {
        if (deliverySubView === 'completed') {
            return allDeliveryOps.filter((op) => TERMINAL_STATUSES.has(op.status));
        }
        return allDeliveryOps.filter((op) => !TERMINAL_STATUSES.has(op.status));
    }, [allDeliveryOps, deliverySubView]);

    // Stock: items physically in the shop = pickup operations with status 'registered'
    // For ALC: both pickup+delivery share alcStatus, so we must filter operationType === 'pickup'
    // For subscriptions: each operation has its own status, same rule applies
    const stockOperations: Operation[] = useMemo(() => activeOperations.filter((op) => op.status === 'registered' && op.operationType === 'pickup'), [activeOperations]);

    // ── Calendar events ────────────────────────────────────
    const calendarEvents: CalendarEvent[] = useMemo(() => {
        let filtered = allOperations;

        if (calendarOrderType === 'subscription') {
            filtered = filtered.filter((op) => op.isSubscription);
        } else if (calendarOrderType === 'a-la-carte') {
            filtered = filtered.filter((op) => !op.isSubscription);
        }

        if (calendarOperationType === 'pickup') {
            filtered = filtered.filter((op) => op.operationType === 'pickup');
        } else if (calendarOperationType === 'delivery') {
            filtered = filtered.filter((op) => op.operationType === 'delivery');
        }

        return filtered.map((op) => ({
            id: `${op.orderMongoId}-${op.operationType}-${op.operationIndex}`,
            title: `${op.isLead ? '⭐' : op.operationType === 'pickup' ? '📦' : '🚚'} ${op.customer.name}`,
            start: op.scheduledTime ? `${op.date.split('T')[0]}T${op.scheduledTime}` : op.date.split('T')[0],
            allDay: !op.scheduledTime,
            classNames: [getEventColorClass(op)],
            editable: !op.isLead, // leads can't be rescheduled via drag
            extendedProps: op,
        }));
    }, [allOperations, calendarOrderType, calendarOperationType]);

    // ── Reschedule mutation ────────────────────────────────
    const rescheduleMutation = useMutation({
        mutationFn: (data: { orderId: string; operationType: 'pickup' | 'delivery'; operationIndex: number; newDate: string; scheduledTime?: string }) =>
            rescheduleOperation(data.orderId, data.operationType, data.operationIndex, data.newDate, data.scheduledTime),
        onSuccess: () => {
            Swal.fire('Succès', 'Opération reprogrammée', 'success');
            queryClient.invalidateQueries({ queryKey: ['operations'] });
        },
        onError: (err: any) => {
            Swal.fire('Erreur', err?.response?.data?.message || 'Échec de la reprogrammation', 'error');
        },
    });

    // ── Navigation ─────────────────────────────────────────
    const handleViewOrder = useCallback(
        (orderId: string) => {
            // Save current state before navigating
            if (typeof window !== 'undefined') {
                try {
                    sessionStorage.setItem(
                        'operations_view_state',
                        JSON.stringify({
                            activeView,
                            scrollY: window.scrollY,
                            dateFrom,
                            dateTo,
                        })
                    );
                } catch (_) {
                    // ignore storage errors
                }
            }
            router.push(`/apps/orders/view?id=${orderId}&from=operations`);
        },
        [router, activeView, dateFrom, dateTo]
    );

    return {
        // View state
        activeView,
        setActiveView,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        searchQuery,
        setSearchQuery,
        calendarOrderType,
        setCalendarOrderType,
        calendarOperationType,
        setCalendarOperationType,
        deliverySubView,
        setDeliverySubView,
        resetToCurrentWeek,

        // Operational period
        periodHook,

        // Data
        stats,
        isLoading,
        dailyOperations,
        priorityOperations,
        pickupOperations,
        deliveryOperations,
        stockOperations,
        allDeliveryOps,
        calendarEvents,

        // Actions
        rescheduleMutation,
        handleViewOrder,
        search,
        refetch,
    };
};
