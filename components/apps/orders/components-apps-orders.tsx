'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import Swal from 'sweetalert2';
import IconPlus from '@/components/icon/icon-plus';
import IconSearch from '@/components/icon/icon-search';
import IconPencil from '@/components/icon/icon-pencil';
import IconEye from '@/components/icon/icon-eye';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconClock from '@/components/icon/icon-clock';
import IconX from '@/components/icon/icon-x';
import { bulkDeleteOrders, deleteOrder, getOrders, getStatusConfig, type Order, type OrderStatus, type OrderType } from '@/lib/api/orders';
import { getPacks, Pack } from '@/lib/api/packs';
import OrderHistoryDrawer from './order-history-drawer';
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod';
import PeriodSelector from '@/components/common/PeriodSelector';

/* ── Helpers ─────────────────────────────────────────────── */

const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        customClass: { container: 'toast' },
    }).fire({
        icon: type,
        title: msg,
        padding: '10px 20px',
    });
};

const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

type BadgeVariant = 'blue' | 'green' | 'amber' | 'slate' | 'red' | 'purple' | 'indigo' | 'cyan' | 'emerald';
const BADGE: Record<BadgeVariant, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
    slate: 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-500/10 dark:text-slate-400',
    red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400',
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/10 dark:text-cyan-400',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
};
const Badge = ({ children, variant }: { children: React.ReactNode; variant: BadgeVariant }) => (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[variant]}`}>{children}</span>
);

const statusBadgeMap: Record<string, BadgeVariant> = {
    pending: 'amber',
    registered: 'blue',
    processing: 'indigo',
    ready_for_delivery: 'green',
    out_for_delivery: 'cyan',
    not_delivered: 'red',
    delivered: 'emerald',
    returned: 'red',
    cancelled: 'slate',
};

const subscriptionStatusMap: Record<string, { variant: BadgeVariant; label: string }> = {
    active: { variant: 'green', label: 'Actif' },
    completed: { variant: 'blue', label: 'Terminé' },
    stopped: { variant: 'slate', label: 'Arrêté' },
};

const paymentBadge = (status: string, pct: number): { variant: BadgeVariant; label: string } => {
    if (status === 'paid') return { variant: 'green', label: 'Payé' };
    if (status === 'partial') return { variant: 'amber', label: `${pct}% Partiel` };
    return { variant: 'red', label: 'Impayé' };
};

/* ── Component ───────────────────────────────────────────── */

const ComponentsAppsOrders = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Operational period hook for date defaults
    const periodHook = useOperationalPeriod();

    /* ── Persisted filters ────────────────────────────────── */
    const getMonthStart = () => periodHook.dateFrom;
    const getMonthEnd = () => periodHook.dateTo;

    const loadPersistedFilters = () => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = JSON.parse(localStorage.getItem('ordersFilters') || '{}');
            // Reset date filters if they are from a different month
            const currentMonthStart = getMonthStart();
            const currentMonthEnd = getMonthEnd();
            if (saved.startDate && saved.startDate.slice(0, 7) !== currentMonthStart.slice(0, 7)) {
                saved.startDate = currentMonthStart;
                saved.endDate = currentMonthEnd;
            }
            return saved;
        } catch {
            return {};
        }
    };

    const persisted = loadPersistedFilters();

    /* ── State ────────────────────────────────────────────── */
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]); // 20
    const [search, setSearch] = useState(persisted.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(persisted.search || '');
    const [typeFilter, setTypeFilter] = useState<OrderType | ''>(persisted.typeFilter || '');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>(persisted.statusFilter || '');
    const [packFilter, setPackFilter] = useState(persisted.packFilter || '');
    const [startDate, setStartDate] = useState(persisted.startDate || getMonthStart());
    const [endDate, setEndDate] = useState(persisted.endDate || getMonthEnd());
    const [showFilters, setShowFilters] = useState(false);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({ columnAccessor: 'createdAt', direction: 'desc' });
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState<Order[]>([]);

    const hasActiveFilters = !!(typeFilter || statusFilter || packFilter || (startDate && startDate !== getMonthStart()) || (endDate && endDate !== getMonthEnd()));

    /* ── Sync dates when period selection resolves (initial auto-select or change) ── */
    useEffect(() => {
        if (periodHook.isCustom) return;
        const newFrom = periodHook.dateFrom;
        const newTo = periodHook.dateTo;
        if (newFrom && newTo && (startDate !== newFrom || endDate !== newTo)) {
            setStartDate(newFrom);
            setEndDate(newTo);
            setPage(1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodHook.dateFrom, periodHook.dateTo, periodHook.isCustom]);

    /* ── Persist filters ──────────────────────────────────── */
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(
                'ordersFilters',
                JSON.stringify({
                    search,
                    typeFilter,
                    statusFilter,
                    packFilter,
                    startDate,
                    endDate,
                }),
            );
        }
    }, [search, typeFilter, statusFilter, packFilter, startDate, endDate]);

    /* ── Debounce search ──────────────────────────────────── */
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(id);
    }, [search]);

    /* ── Queries ──────────────────────────────────────────── */

    const sortByField = useMemo(() => {
        const col = sortStatus.columnAccessor;
        if (col === 'customerId') return 'customerId';
        if (col === 'pickup') return 'pickup.date';
        return col;
    }, [sortStatus.columnAccessor]);

    const {
        data: ordersRes,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['orders', page, pageSize, debouncedSearch, typeFilter, statusFilter, packFilter, startDate, endDate, sortByField, sortStatus.direction],
        queryFn: () =>
            getOrders({
                page,
                limit: pageSize,
                search: debouncedSearch || undefined,
                type: typeFilter || undefined,
                status: statusFilter || undefined,
                packName: packFilter || undefined,
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
                sortBy: sortByField,
                sortOrder: sortStatus.direction,
            }),
        placeholderData: keepPreviousData,
        retry: 3,
        refetchOnMount: 'always',
    });

    const orders = useMemo(() => ordersRes?.data?.data ?? [], [ordersRes]);
    const totalRecords = ordersRes?.data?.meta?.total ?? 0;

    // Fetch packs for filter dropdown
    const { data: packsRes } = useQuery({
        queryKey: ['packs', 'active'],
        queryFn: async () => {
            try {
                return await getPacks(false);
            } catch (e) {
                console.error('[orders-list] Failed to fetch packs:', e);
                return { data: [] };
            }
        },
        staleTime: 5 * 60_000,
        retry: 3,
    });
    const packs: Pack[] = useMemo(() => {
        const d = packsRes?.data;
        return Array.isArray(d) ? d : [];
    }, [packsRes]);

    /* ── Mutations ────────────────────────────────────────── */

    const deleteMutation = useMutation({
        mutationFn: deleteOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            toast('Commande supprimée.');
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la suppression.', 'error'),
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: bulkDeleteOrders,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedRecords([]);
            toast('Commandes supprimées.');
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la suppression.', 'error'),
    });

    /* ── Handlers ─────────────────────────────────────────── */

    const handleDelete = useCallback(
        (order: Order) => {
            Swal.fire({
                title: 'Êtes-vous sûr ?',
                text: `Supprimer la commande ${order.orderId} ?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, supprimer',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#d33',
            }).then((r) => {
                if (r.isConfirmed) deleteMutation.mutate(order._id);
            });
        },
        [deleteMutation],
    );

    const handleBulkDelete = useCallback(() => {
        if (selectedRecords.length === 0) return;
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: `Supprimer ${selectedRecords.length} commande(s) ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        }).then((r) => {
            if (r.isConfirmed) bulkDeleteMutation.mutate(selectedRecords.map((o) => o._id));
        });
    }, [selectedRecords, bulkDeleteMutation]);

    const resetFilters = () => {
        setSearch('');
        setTypeFilter('');
        setStatusFilter('');
        setPackFilter('');
        setStartDate(getMonthStart());
        setEndDate(getMonthEnd());
        if (typeof window !== 'undefined') localStorage.removeItem('ordersFilters');
    };

    /* ── Loading / error ──────────────────────────────────── */

    if (isLoading && !ordersRes) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-slate-400">Chargement des commandes…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-500/10 dark:bg-red-500/5">
                <p className="text-lg font-medium text-danger">Impossible de charger les commandes</p>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white">
                    Réessayer
                </button>
            </div>
        );
    }

    /* ── Render ────────────────────────────────────────────── */

    return (
        <div className="space-y-6">
            {/* ── Header ───────────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Commandes</h1>
                        <p className="mt-0.5 text-sm text-slate-400">
                            {totalRecords} commande{totalRecords !== 1 ? 's' : ''} au total
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Rechercher…"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:focus:bg-slate-700 sm:w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        {/* Filter toggle */}
                        <button
                            type="button"
                            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                                showFilters || hasActiveFilters
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                />
                            </svg>
                            Filtres
                            {hasActiveFilters && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">!</span>}
                        </button>

                        {/* Bulk delete */}
                        {selectedRecords.length > 0 && (
                            <button
                                type="button"
                                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleteMutation.isPending}
                            >
                                <IconTrashLines className="h-4 w-4" />
                                Supprimer ({selectedRecords.length})
                            </button>
                        )}

                        {/* New order */}
                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                            onClick={() => router.push('/apps/orders/add')}
                        >
                            <IconPlus className="h-4 w-4" />
                            Nouvelle commande
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Period Selector ─────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <PeriodSelector
                    periods={periodHook.periods}
                    selectedPeriodId={periodHook.selectedPeriodId}
                    onSelectPeriod={(id) => {
                        periodHook.selectPeriod(id);
                        const p = periodHook.periods.find((pp) => pp._id === id);
                        if (p) {
                            setStartDate(p.startDate.split('T')[0]);
                            setEndDate(p.endDate.split('T')[0]);
                            setPage(1);
                        }
                    }}
                    dateFrom={startDate}
                    dateTo={endDate}
                    onDateFromChange={(v) => {
                        setStartDate(v);
                        periodHook.setCustomDates(v, endDate);
                        setPage(1);
                    }}
                    onDateToChange={(v) => {
                        setEndDate(v);
                        periodHook.setCustomDates(startDate, v);
                        setPage(1);
                    }}
                    isCustom={periodHook.isCustom}
                    onClearCustom={() => {
                        periodHook.clearCustomRange();
                        setStartDate(periodHook.dateFrom);
                        setEndDate(periodHook.dateTo);
                        setPage(1);
                    }}
                    isLoading={periodHook.isLoading}
                    isAllPeriods={periodHook.isAllPeriods}
                    compact
                />
            </div>

            {/* ── Filters panel ────────────────────────────── */}
            {showFilters && (
                <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filtres avancés</h3>
                        {hasActiveFilters && (
                            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700">
                                <IconX className="h-3 w-3" />
                                Réinitialiser
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">Type</label>
                            <select
                                className="form-select w-full rounded-lg text-sm"
                                value={typeFilter}
                                onChange={(e) => {
                                    setTypeFilter(e.target.value as any);
                                    setPage(1);
                                }}
                            >
                                <option value="">Tous</option>
                                <option value="subscription">Abonnement</option>
                                <option value="a-la-carte">À la carte</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">Statut</label>
                            <select
                                className="form-select w-full rounded-lg text-sm"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as any);
                                    setPage(1);
                                }}
                            >
                                <option value="">Tous</option>
                                <option value="pending">En attente</option>
                                <option value="registered">Enregistrement</option>
                                <option value="processing">En traitement</option>
                                <option value="ready_for_delivery">Prêt livraison</option>
                                <option value="out_for_delivery">En cours de livraison</option>
                                <option value="not_delivered">Pas livré</option>
                                <option value="delivered">Livré</option>
                                <option value="returned">Retourné</option>
                                <option value="cancelled">Annulé</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">Pack</label>
                            <select
                                className="form-select w-full rounded-lg text-sm"
                                value={packFilter}
                                onChange={(e) => {
                                    setPackFilter(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">Tous</option>
                                {packs.map((p) => (
                                    <option key={p._id} value={p.code}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Data table ───────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="datatables overflow-x-auto p-1">
                    <DataTable
                        idAccessor="_id"
                        className="table-hover whitespace-nowrap rounded-lg"
                        records={orders}
                        columns={[
                            {
                                accessor: 'orderId',
                                title: 'Commande',
                                sortable: true,
                                render: (order: Order) => (
                                    <button onClick={() => router.push(`/apps/orders/view?id=${order.orderId}`)} className="group text-left">
                                        <p className="font-mono text-xs font-semibold text-primary transition-colors group-hover:text-primary/70">#{order.orderId}</p>
                                        <p className="text-[10px] text-slate-400">{formatDate(order.createdAt)}</p>
                                    </button>
                                ),
                            },
                            {
                                accessor: 'customerId',
                                title: 'Client',
                                sortable: true,
                                render: (order: Order) => (
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                            {order.customerId?.name?.charAt(0)?.toUpperCase() || 'C'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{order.customerId?.name || '—'}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'type',
                                title: 'Type',
                                sortable: true,
                                render: (order: Order) => {
                                    if (order.type === 'subscription') {
                                        // Look up pack name from fetched packs
                                        const pack = packs.find((p) => p.code === order.packName);
                                        const displayName = pack?.name || order.packName || 'Abonnement';
                                        return (
                                            <div>
                                                <Badge variant="indigo">{displayName}</Badge>
                                                {order.packName && pack && <p className="mt-0.5 font-mono text-[10px] text-slate-400">{order.packName}</p>}
                                            </div>
                                        );
                                    }
                                    return <Badge variant="amber">À la carte</Badge>;
                                },
                            },
                            {
                                accessor: 'status',
                                title: 'Statut',
                                sortable: true,
                                render: (order: Order) => {
                                    if (order.type === 'subscription') {
                                        const s = subscriptionStatusMap[(order as any).subscriptionStatus || 'active'] || subscriptionStatusMap.active;
                                        return <Badge variant={s.variant}>{s.label}</Badge>;
                                    }
                                    const config = getStatusConfig(order.status);
                                    const variant = statusBadgeMap[order.status] || 'slate';
                                    return <Badge variant={variant}>{config.label}</Badge>;
                                },
                            },
                            {
                                accessor: 'totalPrice',
                                title: 'Montant',
                                sortable: true,
                                render: (order: Order) => (
                                    <div className="text-right">
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">{order.totalPrice.toLocaleString()} F</p>
                                        {(order as any).totalPaid > 0 && <p className="text-[10px] text-emerald-500">Payé: {((order as any).totalPaid || 0).toLocaleString()} F</p>}
                                    </div>
                                ),
                            },
                            {
                                accessor: 'paymentStatus',
                                title: 'Paiement',
                                sortable: true,
                                render: (order: Order) => {
                                    const totalPaid = (order as any).totalPaid || 0;
                                    const pStatus = (order as any).paymentStatus || 'unpaid';
                                    const pct = order.totalPrice > 0 ? Math.round((totalPaid / order.totalPrice) * 100) : 0;
                                    const { variant, label } = paymentBadge(pStatus, pct);
                                    const isDelivered = order.status === 'delivered' || (order.type === 'subscription' && (order as any).subscriptionStatus === 'completed');
                                    const needsFlag = isDelivered && pStatus !== 'paid';
                                    return (
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant={variant}>{label}</Badge>
                                            {needsFlag && <span title="Livré / paiement incomplet">🚩</span>}
                                        </div>
                                    );
                                },
                            },
                            {
                                accessor: 'pickup',
                                title: 'Récupération',
                                sortable: true,
                                render: (order: Order) => (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <IconClock className="h-3.5 w-3.5" />
                                        {formatDate(order.pickup.date)}
                                    </div>
                                ),
                            },
                            {
                                accessor: 'actions',
                                title: '',
                                textAlignment: 'center' as const,
                                width: 110,
                                render: (order: Order) => (
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            type="button"
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                                            onClick={() => router.push(`/apps/orders/view?id=${order.orderId}`)}
                                            title="Voir"
                                        >
                                            <IconEye className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
                                            onClick={() => router.push(`/apps/orders/edit/${order._id}`)}
                                            title="Modifier"
                                        >
                                            <IconPencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                            onClick={() => handleDelete(order)}
                                            title="Supprimer"
                                        >
                                            <IconTrashLines className="h-4 w-4" />
                                        </button>
                                    </div>
                                ),
                            },
                        ]}
                        highlightOnHover
                        selectedRecords={selectedRecords}
                        onSelectedRecordsChange={setSelectedRecords}
                        totalRecords={totalRecords}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={setPage}
                        recordsPerPageOptions={PAGE_SIZES as unknown as number[]}
                        onRecordsPerPageChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                        }}
                        sortStatus={sortStatus}
                        onSortStatusChange={(status) => {
                            setSortStatus(status);
                            setPage(1);
                        }}
                        paginationText={({ from, to, totalRecords }) => `${from}–${to} sur ${totalRecords}`}
                        noRecordsText="Aucune commande trouvée"
                        minHeight={300}
                    />
                </div>
            </div>

            {/* ── History drawer ────────────────────────────── */}
            {selectedOrder && showHistoryDrawer && (
                <OrderHistoryDrawer
                    order={selectedOrder}
                    isOpen={showHistoryDrawer}
                    onClose={() => {
                        setShowHistoryDrawer(false);
                        setSelectedOrder(null);
                    }}
                />
            )}
        </div>
    );
};

export default ComponentsAppsOrders;
