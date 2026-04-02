'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import Swal from 'sweetalert2';
import { Lead, leadsApi, PACK_LABELS, STATUS_LABELS } from '@/lib/api/leads';
import { getActiveZones, Zone } from '@/lib/api/zones';
import IconPlus from '@/components/icon/icon-plus';
import IconSearch from '@/components/icon/icon-search';
import IconPhone from '@/components/icon/icon-phone';
import IconMapPin from '@/components/icon/icon-map-pin';
import IconUser from '@/components/icon/icon-user';
import IconX from '@/components/icon/icon-x';
import IconTrashLines from '@/components/icon/icon-trash-lines';

const FRONTEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

const ADD_ONS = [
    { pickups: 0, price: 0, extraItems: 0, label: 'Aucun' },
    { pickups: 1, price: 5000, extraItems: 20, label: '+1 collecte (+5 000 F)' },
    { pickups: 2, price: 10000, extraItems: 40, label: '+2 collectes (+10 000 F)' },
    { pickups: 3, price: 15000, extraItems: 60, label: '+3 collectes (+15 000 F)' },
    { pickups: 4, price: 20000, extraItems: 80, label: '+4 collectes (+20 000 F)' },
];

/* ── Helpers ─────────────────────────────────────────────── */

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

const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

type BadgeVariant = 'blue' | 'green' | 'amber' | 'slate' | 'red' | 'purple' | 'indigo' | 'cyan' | 'emerald' | 'yellow';
const BADGE: Record<BadgeVariant, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
    yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-400',
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
    new: 'blue',
    contacted: 'yellow',
    confirmed: 'green',
    converted: 'indigo',
    cancelled: 'slate',
};

const packBadgeMap: Record<string, BadgeVariant> = {
    douceur: 'blue',
    eclat: 'green',
    prestige: 'purple',
    a_la_carte: 'amber',
};

const sourceBadgeMap: Record<string, { variant: BadgeVariant; label: string }> = {
    whatsapp: { variant: 'green', label: 'WhatsApp' },
    manual: { variant: 'blue', label: 'Manuel' },
    inscription_link: { variant: 'indigo', label: 'Lien inscription' },
    website: { variant: 'cyan', label: 'Site web' },
};

/* ── Form types ──────────────────────────────────────────── */

interface LeadFormData {
    name: string;
    phones: Array<{ number: string; type: string }>;
    address: string;
    zone: string;
    packChoice: string;
    additionalPickups: number;
    preferredPickupDate: string;
    birthday: string;
    notes: string;
}

const emptyFormData: LeadFormData = {
    name: '',
    phones: [{ number: '', type: 'whatsapp' }],
    address: '',
    zone: '',
    packChoice: 'eclat',
    additionalPickups: 0,
    preferredPickupDate: '',
    birthday: '',
    notes: '',
};

/* ── Component ───────────────────────────────────────────── */

const ComponentsAppsLeads = () => {
    const queryClient = useQueryClient();
    const router = useRouter();

    /* ── State ────────────────────────────────────────────── */
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [packFilter, setPackFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'createdAt',
        direction: 'desc',
    });
    const [selectedRecords, setSelectedRecords] = useState<Lead[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [formData, setFormData] = useState<LeadFormData>(emptyFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const hasActiveFilters = !!(statusFilter || packFilter || sourceFilter);

    /* ── Debounce search ──────────────────────────────────── */
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(id);
    }, [search]);

    /* ── Close dropdown on outside click ──────────────────── */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown-nouveau')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    /* ── Queries ──────────────────────────────────────────── */
    const {
        data: leadsData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['leads', page, pageSize, debouncedSearch, statusFilter, packFilter, sourceFilter, sortStatus],
        queryFn: () =>
            leadsApi.getAll({
                page,
                limit: pageSize,
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                packChoice: packFilter || undefined,
                sortBy: sortStatus.columnAccessor,
                sortOrder: sortStatus.direction,
            }),
        placeholderData: keepPreviousData,
        retry: 3,
        refetchOnMount: 'always',
    });

    const leads = useMemo(() => leadsData?.data ?? [], [leadsData]);
    const totalRecords = leadsData?.meta?.total ?? 0;

    const { data: stats } = useQuery({
        queryKey: ['leads-stats'],
        queryFn: () => leadsApi.getStats(),
    });

    const { data: zonesData } = useQuery({
        queryKey: ['zones-active'],
        queryFn: async () => {
            const res = await getActiveZones();
            return res.data;
        },
    });
    const zones: Zone[] = zonesData || [];

    /* ── Mutations ────────────────────────────────────────── */
    const markContactedMutation = useMutation({
        mutationFn: (id: string) => leadsApi.markContacted(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
            toast('Lead marqué comme contacté');
        },
    });

    const confirmPickupMutation = useMutation({
        mutationFn: ({ id, date }: { id: string; date: string }) => leadsApi.confirmPickup(id, date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
            toast('Collecte confirmée');
        },
    });

    const convertMutation = useMutation({
        mutationFn: (id: string) => leadsApi.convert(id),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
            Swal.fire({
                icon: 'success',
                title: 'Lead converti',
                html: `Le client a été créé avec succès.<br/>ID: ${data.clientId}`,
            });
        },
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => leadsApi.cancel(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: (ids: string[]) => leadsApi.bulkDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
            setSelectedRecords([]);
            toast('Prospects supprimés.');
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la suppression.', 'error'),
    });

    /* ── Handlers ─────────────────────────────────────────── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await leadsApi.create({
                name: formData.name,
                phones: formData.phones.filter((p) => p.number.trim()),
                address: formData.address,
                zone: formData.zone || undefined,
                packChoice: formData.packChoice,
                preferredPickupDate: formData.preferredPickupDate || undefined,
                additionalPickups: formData.additionalPickups > 0 ? formData.additionalPickups : undefined,
                birthday: formData.birthday || undefined,
                notes: formData.notes || undefined,
                source: 'manual',
            });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
            setShowModal(false);
            setFormData(emptyFormData);
            toast('Prospect créé avec succès');
        } catch (error: any) {
            Swal.fire('Erreur', error.response?.data?.message || 'Erreur lors de la création', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateLink = async () => {
        try {
            const response = await leadsApi.generateRegistrationLink();
            const link = response.link || `${FRONTEND_URL}/register/prospect/${response.token}`;

            await Swal.fire({
                title: "Lien d'inscription prospect",
                html: `
                    <p class="mb-3 text-sm text-gray-600">Partagez ce lien avec le prospect. Il pourra remplir le formulaire d'inscription.</p>
                    <input type="text" value="${link}" class="form-input w-full text-sm" readonly id="registration-link" />
                `,
                confirmButtonText: 'Copier le lien',
                showCancelButton: true,
                cancelButtonText: 'Fermer',
            }).then((result) => {
                if (result.isConfirmed) {
                    navigator.clipboard.writeText(link);
                    toast('Lien copié dans le presse-papier !');
                }
            });
        } catch (error: any) {
            Swal.fire('Erreur', 'Impossible de générer le lien', 'error');
        }
    };

    const handleConfirmPickup = async (lead: Lead) => {
        const { value: date } = await Swal.fire({
            title: 'Confirmer la collecte',
            input: 'date',
            inputLabel: 'Date de collecte',
            inputValue: lead.preferredPickupDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            showCancelButton: true,
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
        });
        if (date) {
            confirmPickupMutation.mutate({ id: lead._id, date });
        }
    };

    const handleCancel = async (lead: Lead) => {
        const { value: reason } = await Swal.fire({
            title: 'Annuler ce lead',
            input: 'text',
            inputLabel: 'Raison (optionnel)',
            showCancelButton: true,
            confirmButtonText: 'Annuler le lead',
            confirmButtonColor: '#dc3545',
            cancelButtonText: 'Retour',
        });
        if (reason !== undefined) {
            cancelMutation.mutate({ id: lead._id, reason });
        }
    };

    const handleBulkDelete = useCallback(() => {
        if (selectedRecords.length === 0) return;
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: `Supprimer ${selectedRecords.length} prospect(s) ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        }).then((r) => {
            if (r.isConfirmed) bulkDeleteMutation.mutate(selectedRecords.map((l) => l._id));
        });
    }, [selectedRecords, bulkDeleteMutation]);

    const handlePhoneChange = (index: number, field: 'number' | 'type', value: string) => {
        const newPhones = [...formData.phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setFormData({ ...formData, phones: newPhones });
    };

    const addPhone = () => {
        setFormData({ ...formData, phones: [...formData.phones, { number: '', type: 'whatsapp' }] });
    };

    const removePhone = (index: number) => {
        if (formData.phones.length > 1) {
            setFormData({ ...formData, phones: formData.phones.filter((_, i) => i !== index) });
        }
    };

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('');
        setPackFilter('');
        setSourceFilter('');
    };

    /* ── Loading / error ──────────────────────────────────── */
    if (isLoading && !leadsData) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-slate-400">Chargement des prospects…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-500/10 dark:bg-red-500/5">
                <p className="text-lg font-medium text-danger">Impossible de charger les prospects</p>
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ['leads'] })} className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white">
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
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Prospects (Leads)</h1>
                        <p className="mt-0.5 text-sm text-slate-400">
                            {totalRecords} prospect{totalRecords !== 1 ? 's' : ''} au total
                            {stats && (
                                <span>
                                    {' · '}
                                    <span className="text-blue-500">{stats.byStatus?.new || 0} nouveaux</span>
                                    {' · '}
                                    <span className="text-yellow-500">{stats.byStatus?.contacted || 0} contactés</span>
                                    {' · '}
                                    <span className="text-green-500">{stats.byStatus?.confirmed || 0} confirmés</span>
                                    {' · '}
                                    <span className="text-indigo-500">{stats.weekConversions || 0} conversions (7j)</span>
                                </span>
                            )}
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

                        {/* ── Nouveau Prospect Dropdown ───────────── */}
                        <div className="dropdown-nouveau relative">
                            <button
                                type="button"
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <IconPlus className="h-4 w-4" />
                                Nouveau prospect
                                <svg className={`h-3 w-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showDropdown && (
                                <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-[#1a2234]">
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            setFormData(emptyFormData);
                                            setShowModal(true);
                                        }}
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                            <IconUser className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Nouveau prospect</p>
                                            <p className="text-xs text-slate-400">Saisie manuelle</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                                        onClick={() => {
                                            setShowDropdown(false);
                                            handleGenerateLink();
                                        }}
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                                            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-medium">Inscription Client</p>
                                            <p className="text-xs text-slate-400">Générer un lien à partager</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
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
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">Statut</label>
                            <select
                                className="form-select w-full rounded-lg text-sm"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">Tous</option>
                                <option value="new">Nouveaux</option>
                                <option value="contacted">Contactés</option>
                                <option value="confirmed">Confirmés</option>
                                <option value="converted">Convertis</option>
                                <option value="cancelled">Annulés</option>
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
                                <option value="douceur">Pack Douceur</option>
                                <option value="eclat">Pack Éclat</option>
                                <option value="prestige">Pack Prestige</option>
                                <option value="a_la_carte">À la carte</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-500">Source</label>
                            <select
                                className="form-select w-full rounded-lg text-sm"
                                value={sourceFilter}
                                onChange={(e) => {
                                    setSourceFilter(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">Toutes</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="manual">Manuel</option>
                                <option value="inscription_link">Lien inscription</option>
                                <option value="website">Site web</option>
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
                        records={leads}
                        columns={[
                            {
                                accessor: 'leadId',
                                title: 'ID',
                                width: 170,
                                sortable: true,
                                render: (lead: Lead) => (
                                    <div>
                                        <p className="font-mono text-xs font-semibold text-primary">{lead.leadId}</p>
                                        <p className="text-[10px] text-slate-400">{formatDate(lead.createdAt)}</p>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'name',
                                title: 'Client',
                                sortable: true,
                                render: (lead: Lead) => (
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                            {lead.name?.charAt(0)?.toUpperCase() || 'P'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{lead.name}</p>
                                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <IconPhone className="h-3 w-3" />
                                                {lead.phones[0]?.number}
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'address',
                                title: 'Adresse',
                                render: (lead: Lead) => (
                                    <div className="flex max-w-[180px] items-center gap-1.5">
                                        <IconMapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                        <span className="truncate text-sm text-slate-600 dark:text-slate-300">{lead.address}</span>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'packChoice',
                                title: 'Pack',
                                render: (lead: Lead) => {
                                    const pack = PACK_LABELS[lead.packChoice];
                                    const variant = packBadgeMap[lead.packChoice] || 'slate';
                                    return (
                                        <div>
                                            <Badge variant={variant}>{pack?.label || lead.packChoice}</Badge>
                                            <p className="mt-0.5 text-[10px] text-slate-400">{pack?.price}</p>
                                            {lead.additionalPickups && lead.additionalPickups > 0 ? (
                                                <p className="mt-0.5 text-[10px] font-medium text-indigo-600">
                                                    +{lead.additionalPickups} collecte{lead.additionalPickups > 1 ? 's' : ''} supp.
                                                </p>
                                            ) : null}
                                        </div>
                                    );
                                },
                            },
                            {
                                accessor: 'status',
                                title: 'Statut',
                                sortable: true,
                                render: (lead: Lead) => {
                                    const status = STATUS_LABELS[lead.status];
                                    const variant = statusBadgeMap[lead.status] || 'slate';
                                    return <Badge variant={variant}>{status?.label || lead.status}</Badge>;
                                },
                            },
                            {
                                accessor: 'source',
                                title: 'Source',
                                render: (lead: Lead) => {
                                    const src = sourceBadgeMap[lead.source] || {
                                        variant: 'slate' as BadgeVariant,
                                        label: lead.source,
                                    };
                                    return <Badge variant={src.variant}>{src.label}</Badge>;
                                },
                            },
                            {
                                accessor: 'sharedBy',
                                title: 'Partagé par',
                                render: (lead: Lead) => {
                                    if (!lead.sharedBy) return <span className="text-xs text-slate-400">—</span>;
                                    return (
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                                                {lead.sharedBy.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="text-xs text-slate-600 dark:text-slate-300">{lead.sharedBy.name}</span>
                                        </div>
                                    );
                                },
                            },
                            {
                                accessor: 'preferredPickupDate',
                                title: 'Collecte',
                                render: (lead: Lead) => <span className="text-xs text-slate-500">{formatDate(lead.preferredPickupDate)}</span>,
                            },
                            {
                                accessor: 'actions',
                                title: '',
                                textAlignment: 'center' as const,
                                width: 140,
                                render: (lead: Lead) => (
                                    <div className="flex items-center justify-center gap-1">
                                        {lead.status === 'new' && (
                                            <button
                                                type="button"
                                                className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-yellow-600 transition-colors hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-500/10"
                                                onClick={() => markContactedMutation.mutate(lead._id)}
                                                title="Marquer contacté"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    />
                                                </svg>
                                                Contacté
                                            </button>
                                        )}
                                        {lead.status === 'contacted' && (
                                            <button
                                                type="button"
                                                className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10"
                                                onClick={() => handleConfirmPickup(lead)}
                                                title="Confirmer collecte"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Confirmer
                                            </button>
                                        )}
                                        {lead.status === 'confirmed' && (
                                            <button
                                                type="button"
                                                className="flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                                onClick={() => convertMutation.mutate(lead._id)}
                                                title="Convertir en client"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                Convertir
                                            </button>
                                        )}
                                        {!['converted', 'cancelled'].includes(lead.status) && (
                                            <button
                                                type="button"
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                                onClick={() => handleCancel(lead)}
                                                title="Annuler"
                                            >
                                                <IconX className="h-4 w-4" />
                                            </button>
                                        )}
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
                        noRecordsText="Aucun prospect trouvé"
                        minHeight={300}
                        onRowClick={(lead: Lead) => router.push(`/apps/leads/preview/${lead._id}`)}
                        rowClassName="cursor-pointer"
                    />
                </div>
            </div>

            {/* ── Create Lead Modal ────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nouveau Prospect</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            >
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Name */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    Nom complet <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="form-input rounded-lg"
                                    placeholder="Nom et prénom"
                                />
                            </div>

                            {/* Phones */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    Téléphone(s) <span className="text-red-500">*</span>
                                </label>
                                {formData.phones.map((phone, index) => (
                                    <div key={index} className="mb-2 flex gap-2">
                                        <input
                                            type="tel"
                                            value={phone.number}
                                            onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                                            className="form-input flex-1 rounded-lg"
                                            placeholder="+225 XX XX XX XX XX"
                                            required={index === 0}
                                        />
                                        <select value={phone.type} onChange={(e) => handlePhoneChange(index, 'type', e.target.value)} className="form-select w-[150px] rounded-lg">
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="call">Appel</option>
                                            <option value="both">Les deux</option>
                                        </select>
                                        {formData.phones.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removePhone(index)}
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                            >
                                                <IconX className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={addPhone} className="mt-1 text-xs font-medium text-primary hover:text-primary/80">
                                    + Ajouter un numéro
                                </button>
                            </div>

                            {/* Address */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    Adresse complète <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="form-input rounded-lg"
                                    placeholder="Quartier + indications précises"
                                />
                            </div>

                            {/* Zone + Pack in grid */}
                            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Zone / Quartier <span className="text-red-500">*</span>
                                    </label>
                                    <select value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} className="form-select rounded-lg" required>
                                        <option value="">Sélectionner une zone</option>
                                        {zones.map((zone) => (
                                            <option key={zone._id} value={zone.name}>
                                                {zone.displayName} {zone.subscriptionFee > 0 ? `(${zone.subscriptionFee.toLocaleString()} F/livr.)` : '(Gratuite)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Choix du pack <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.packChoice}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                packChoice: e.target.value,
                                                additionalPickups: 0,
                                            })
                                        }
                                        className="form-select rounded-lg"
                                        required
                                    >
                                        <option value="douceur">Pack Douceur – 15 000 FCFA</option>
                                        <option value="eclat">Pack Éclat – 20 000 FCFA</option>
                                        <option value="prestige">Pack Prestige – 38 000 FCFA</option>
                                        <option value="a_la_carte">À la carte</option>
                                    </select>
                                </div>
                            </div>

                            {/* Add-on pickups */}
                            {formData.packChoice !== 'a_la_carte' && (
                                <div className="mb-4">
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">🚀 Collectes supplémentaires</label>
                                    <select
                                        value={formData.additionalPickups}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                additionalPickups: Number(e.target.value),
                                            })
                                        }
                                        className="form-select rounded-lg"
                                    >
                                        {ADD_ONS.map((opt, idx) => (
                                            <option key={idx} value={idx}>
                                                {opt.label} {idx > 0 ? `· +${opt.extraItems} articles` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {formData.additionalPickups > 0 && (
                                        <p className="mt-1 text-xs text-indigo-600">
                                            +{ADD_ONS[formData.additionalPickups].extraItems} articles · +{ADD_ONS[formData.additionalPickups].price.toLocaleString()} FCFA
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Dates in grid */}
                            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Date collecte souhaitée</label>
                                    <input
                                        type="date"
                                        value={formData.preferredPickupDate}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                preferredPickupDate: e.target.value,
                                            })
                                        }
                                        className="form-input rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Date de naissance</label>
                                    <input
                                        type="text"
                                        value={formData.birthday}
                                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                                        className="form-input rounded-lg"
                                        placeholder="Ex: 15 mars"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Notes / Remarques</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="form-textarea rounded-lg"
                                    rows={3}
                                    placeholder="Informations supplémentaires..."
                                />
                            </div>

                            {/* Buttons */}
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Création...
                                        </>
                                    ) : (
                                        'Créer le prospect'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComponentsAppsLeads;
