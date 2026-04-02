'use client';

import IconPencil from '@/components/icon/icon-pencil';
import IconSearch from '@/components/icon/icon-search';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconUser from '@/components/icon/icon-user';
import IconUserPlus from '@/components/icon/icon-user-plus';
import IconX from '@/components/icon/icon-x';
import { createCustomer, type Customer, deleteCustomer, generateCustomerId, getCustomers, updateCustomer } from '@/lib/api/clients';
import { getActiveZones, type Zone } from '@/lib/api/zones';
import { Dialog, Transition } from '@headlessui/react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataTableColumn } from 'mantine-datatable';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import Link from 'next/link';
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import WhatsAppDialog from './whatsapp-dialog';

/* ────────────────────────────────────────────────────────── */
/*  Types                                                     */

/* ────────────────────────────────────────────────────────── */

interface PhoneEntry {
    number: string;
    type: 'whatsapp' | 'call' | 'both';
}

interface CustomerFormState {
    _id: string;
    customerId?: string;
    name: string;
    location: string;
    zone: string;
    phones: PhoneEntry[];
    personCount: number;
    isBusiness: boolean;
    isProspect: boolean;
    marketingSource: string;
    notes: string;
}

/* ────────────────────────────────────────────────────────── */
/*  Constants                                                 */
/* ────────────────────────────────────────────────────────── */

const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

const EMPTY_FORM: CustomerFormState = {
    _id: '',
    name: '',
    location: '',
    zone: '',
    phones: [{ number: '+225 ', type: 'both' }],
    personCount: 1,
    isBusiness: false,
    isProspect: false,
    marketingSource: '',
    notes: '',
};

const MARKETING_SOURCES = [
    { value: '', label: 'Sélectionner une source' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'TikTok', label: 'TikTok' },
    { value: 'Local Advertisment', label: 'Publicité locale' },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Flyers', label: 'Flyers' },
    { value: 'Other', label: 'Autre' },
];

/* ────────────────────────────────────────────────────────── */
/*  Helpers                                                   */
/* ────────────────────────────────────────────────────────── */

const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        customClass: { container: 'toast' },
    }).fire({ icon: type, title: msg, padding: '10px 20px' });
};

/* ────────────────────────────────────────────────────────── */
/*  Badge                                                     */
/* ────────────────────────────────────────────────────────── */

type BadgeVariant = 'blue' | 'green' | 'amber' | 'slate' | 'purple';

const BADGE_CLASSES: Record<BadgeVariant, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
    slate: 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20',
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20',
};

const Badge = ({ children, variant }: { children: React.ReactNode; variant: BadgeVariant }) => (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_CLASSES[variant]}`}>{children}</span>
);

/* ────────────────────────────────────────────────────────── */
/*  Component                                                 */
/* ────────────────────────────────────────────────────────── */

const ComponentsAppsCustomers = () => {
    const queryClient = useQueryClient();
    const searchRef = useRef<HTMLInputElement>(null);

    /* ── UI state ─────────────────────────────────────────── */
    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [waTarget, setWaTarget] = useState<{ name: string; phone: string; phones: PhoneEntry[] } | null>(null);
    /* ── Form state ───────────────────────────────────────── */
    const [form, setForm] = useState<CustomerFormState>({ ...EMPTY_FORM });
    const [originalIsBusiness, setOriginalIsBusiness] = useState<boolean | null>(null);

    /* ── Table state ──────────────────────────────────────── */
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({ columnAccessor: 'name', direction: 'asc' });

    /* ── Debounce search ──────────────────────────────────── */
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(id);
    }, [search]);

    /* ── Regenerate customerId on type toggle (edit only) ── */
    useEffect(() => {
        if (form._id && originalIsBusiness !== null && form.isBusiness !== originalIsBusiness) {
            generateCustomerId(form.isBusiness)
                .then((res) => setForm((prev) => ({ ...prev, customerId: res.data.customerId })))
                .catch(console.error);
        }
    }, [form.isBusiness, form._id, originalIsBusiness]);

    /* ─────────────────────────────────────────────────────── */
    /*  Queries                                                */
    /* ─────────────────────────────────────────────────────── */

    const {
        data: customersRes,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['customers', debouncedSearch, page, pageSize, sortStatus.columnAccessor, sortStatus.direction],
        queryFn: () => {
            const sortByField =
                sortStatus.columnAccessor === 'primaryPhone'
                    ? 'phones'
                    : sortStatus.columnAccessor === 'zoneDisplay'
                      ? 'zone'
                      : sortStatus.columnAccessor === 'customerType'
                        ? 'isBusiness'
                        : sortStatus.columnAccessor === 'statusLabel'
                          ? 'isProspect'
                          : sortStatus.columnAccessor;
            return getCustomers({
                q: debouncedSearch || undefined,
                page,
                limit: pageSize,
                sortBy: sortByField,
                sortOrder: sortStatus.direction,
            });
        },
        placeholderData: keepPreviousData,
    });

    const { data: zonesRes } = useQuery({
        queryKey: ['zones', 'active'],
        queryFn: getActiveZones,
        staleTime: 5 * 60_000,
    });

    const customers: Customer[] = useMemo(() => customersRes?.data.data ?? [], [customersRes]);
    const totalRecords = customersRes?.data.meta?.total ?? 0;
    const zones: Zone[] = useMemo(() => zonesRes?.data ?? [], [zonesRes]);

    /** zone name → displayName lookup */
    const zoneMap = useMemo(() => {
        const m: Record<string, string> = {};
        zones.forEach((z) => (m[z.name] = z.displayName));
        return m;
    }, [zones]);

    /* ── Enriched records (no client-side sort/pagination) ── */
    const records = useMemo(
        () =>
            customers.map((c) => ({
                ...c,
                primaryPhone: c.phones?.[0]?.number || '',
                customerType: c.isBusiness ? 'business' : 'individual',
                statusLabel: c.isProspect ? 'prospect' : 'active',
                zoneDisplay: c.zone ? zoneMap[c.zone] || c.zone : '—',
            })),
        [customers, zoneMap],
    );

    /* ─────────────────────────────────────────────────────── */
    /*  Mutations                                              */
    /* ─────────────────────────────────────────────────────── */

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setForm({ ...EMPTY_FORM });
        setOriginalIsBusiness(null);
    }, []);

    const createMutation = useMutation({
        mutationFn: createCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast('Client ajouté avec succès.');
            closeModal();
        },
        onError: (err: any) => toast(err.response?.data?.message || "Échec de l'ajout du client", 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) => updateCustomer(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast('Client mis à jour avec succès.');
            closeModal();
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la mise à jour', 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast('Client supprimé avec succès.');
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la suppression', 'error'),
    });

    const isSaving = createMutation.isPending || updateMutation.isPending;

    /* ─────────────────────────────────────────────────────── */
    /*  Form helpers                                           */
    /* ─────────────────────────────────────────────────────── */

    const updateField = <K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) =>
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));

    const changePhone = (idx: number, field: keyof PhoneEntry, value: string) => {
        const phones = [...form.phones];
        phones[idx] = { ...phones[idx], [field]: value } as PhoneEntry;
        updateField('phones', phones);
    };

    const addPhone = () => updateField('phones', [...form.phones, { number: '+225 ', type: 'both' }]);

    const removePhone = (idx: number) => {
        if (form.phones.length > 1)
            updateField(
                'phones',
                form.phones.filter((_, i) => i !== idx),
            );
    };

    /* ─────────────────────────────────────────────────────── */
    /*  Modal actions                                          */
    /* ─────────────────────────────────────────────────────── */

    const openCreate = () => {
        setForm({ ...EMPTY_FORM });
        setOriginalIsBusiness(null);
        setModalOpen(true);
    };

    const openEdit = (c: Customer) => {
        setForm({
            _id: c._id,
            customerId: c.customerId,
            name: c.name,
            location: c.location,
            zone: c.zone || '',
            phones: c.phones,
            personCount: c.personCount,
            isBusiness: c.isBusiness,
            isProspect: c.isProspect,
            marketingSource: c.marketingSource || '',
            notes: c.notes || '',
        });
        setOriginalIsBusiness(c.isBusiness);
        setModalOpen(true);
    };

    const confirmDelete = (c: Customer) => {
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: `Supprimer le client « ${c.name} » ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
        }).then((result) => {
            if (result.isConfirmed) deleteMutation.mutate(c._id);
        });
    };

    const saveCustomer = () => {
        if (!form.name.trim()) return toast('Le nom est requis.', 'error');
        if (!form.location.trim()) return toast('La localisation est requise.', 'error');
        if (!form.phones[0]?.number) return toast('Au moins un numéro est requis.', 'error');

        const payload: Partial<Customer> & Record<string, any> = {
            name: form.name.trim(),
            location: form.location.trim(),
            zone: form.zone || undefined,
            phones: form.phones.filter((p) => p.number).map((p) => ({ number: p.number, type: p.type })),
            personCount: form.personCount,
            isBusiness: form.isBusiness,
            isProspect: form.isProspect,
            marketingSource: form.marketingSource || undefined,
            notes: form.notes || undefined,
        };

        if (form.customerId) payload.customerId = form.customerId;

        if (form._id) {
            updateMutation.mutate({ id: form._id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    /* ─────────────────────────────────────────────────────── */
    /*  Table columns                                          */
    /* ─────────────────────────────────────────────────────── */

    const columns: DataTableColumn<any>[] = useMemo(
        () => [
            {
                accessor: 'name',
                title: 'Client',
                sortable: true,
                render: (row: any) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{row.name?.charAt(0)?.toUpperCase() || 'C'}</div>
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{row.name}</p>
                            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.customerId || '—'}</p>
                            <p className="truncate text-xs text-slate-400">{row.location}</p>
                        </div>
                    </div>
                ),
            },
            {
                accessor: 'zoneDisplay',
                title: 'Zone',
                sortable: true,
                render: (row: any) => (row.zone ? <Badge variant="purple">{row.zoneDisplay}</Badge> : <span className="text-xs text-slate-300">—</span>),
            },
            {
                accessor: 'primaryPhone',
                title: 'Téléphone',
                sortable: true,
                render: (row: any) => {
                    const phones: PhoneEntry[] = row.phones || [];
                    if (phones.length === 0) return <span className="text-xs text-slate-300">—</span>;

                    const typeLabel = (t: string) => (t === 'whatsapp' ? 'WhatsApp' : t === 'call' ? 'Appel' : 'Les deux');
                    const typeColor = (t: string) =>
                        t === 'whatsapp'
                            ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                            : t === 'call'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300';

                    return (
                        <div className="group relative">
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{phones[0].number || '—'}</span>
                                <span className={`inline-flex rounded px-1 py-0.5 text-[10px] font-medium ${typeColor(phones[0].type)}`}>{typeLabel(phones[0].type)}</span>
                                {phones.length > 1 && <span className="cursor-default rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">+{phones.length - 1}</span>}
                            </div>
                            {phones.length > 1 && (
                                <div className="invisible absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg transition-all group-hover:visible dark:border-slate-600 dark:bg-slate-800">
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tous les numéros</p>
                                    <div className="space-y-1">
                                        {phones.map((p: PhoneEntry, i: number) => (
                                            <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <span className="font-medium text-slate-700 dark:text-slate-200">{p.number}</span>
                                                <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColor(p.type)}`}>{typeLabel(p.type)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                },
            },
            {
                accessor: 'customerType',
                title: 'Type',
                sortable: true,
                render: (row: any) => <Badge variant={row.isBusiness ? 'blue' : 'green'}>{row.isBusiness ? 'Entreprise' : 'Particulier'}</Badge>,
            },
            {
                accessor: 'statusLabel',
                title: 'Statut',
                sortable: true,
                render: (row: any) => <Badge variant={row.isProspect ? 'amber' : 'green'}>{row.isProspect ? 'Prospect' : 'Actif'}</Badge>,
            },
            // {
            //     accessor: 'personCount',
            //     title: 'Pers.',
            //     sortable: true,
            //     textAlignment: 'center' as const,
            //     width: 60,
            //     render: (row: any) => <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{row.personCount}</span>,
            // },
            {
                accessor: 'actions',
                title: '',
                textAlignment: 'right' as const,
                width: 160,
                render: (row: any) => {
                    const phones: PhoneEntry[] = row.phones || [];
                    const waPhone = phones.find((p) => p.type === 'whatsapp' || p.type === 'both')?.number || phones[0]?.number;
                    return (
                        <div className="flex items-center justify-end gap-1">
                            {waPhone && (
                                <button
                                    type="button"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-500/10"
                                    onClick={() => setWaTarget({ name: row.name, phone: waPhone, phones })}
                                    title="Envoyer un WhatsApp"
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.215l-.297-.178-2.871.853.853-2.871-.178-.297A8 8 0 1112 20z" />
                                    </svg>
                                </button>
                            )}
                            <Link
                                href={`/users/profile?id=${row._id}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-info/10 hover:text-info"
                                title="Voir le profil"
                            >
                                <IconUser className="h-4 w-4" />
                            </Link>
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                                onClick={() => openEdit(row)}
                                title="Modifier"
                            >
                                <IconPencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                onClick={() => confirmDelete(row)}
                                title="Supprimer"
                            >
                                <IconTrashLines className="h-4 w-4" />
                            </button>
                        </div>
                    );
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [zoneMap],
    );

    /* ─────────────────────────────────────────────────────── */
    /*  Render: loading / error                                */
    /* ─────────────────────────────────────────────────────── */

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-slate-400">Chargement des clients…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-500/10 dark:bg-red-500/5">
                <p className="text-lg font-medium text-danger">Impossible de charger les clients</p>
                <p className="mt-1 text-sm text-slate-500">Vérifiez votre connexion et réessayez.</p>
                <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
                    className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    /* ─────────────────────────────────────────────────────── */
    /*  Render: main                                           */
    /* ─────────────────────────────────────────────────────── */

    return (
        <div className="space-y-6">
            {/* ── Header card ──────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Clients</h1>
                        <p className="mt-0.5 text-sm text-slate-400">
                            {totalRecords} client{totalRecords !== 1 ? 's' : ''} au total
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {/* Search */}
                        <div className="relative">
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Rechercher un client…"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:focus:bg-slate-700 sm:w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>

                        {/* Add button */}
                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                            onClick={openCreate}
                        >
                            <IconUserPlus className="h-4 w-4" />
                            Nouveau client
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Data‑table card ──────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="datatables p-1">
                    <DataTable
                        idAccessor="_id"
                        className="table-hover whitespace-nowrap rounded-lg"
                        records={records}
                        columns={columns}
                        highlightOnHover
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
                        noRecordsText="Aucun client trouvé"
                        minHeight={300}
                    />
                </div>
            </div>

            {/* ── Modal ────────────────────────────────────── */}
            <Transition appear show={modalOpen} as={Fragment}>
                <Dialog as="div" open={modalOpen} onClose={closeModal} className="relative z-50">
                    {/* Backdrop */}
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                                    {/* ── Header (sticky) ────────── */}
                                    <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/50">
                                        <div>
                                            <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">{form._id ? 'Modifier le client' : 'Nouveau client'}</Dialog.Title>
                                            {form._id && form.customerId && <p className="mt-0.5 font-mono text-xs text-slate-400">{form.customerId}</p>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                        >
                                            <IconX className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* ── Body (scrollable) ──────── */}
                                    <div className="flex-1 overflow-y-auto px-6 py-5">
                                        <div className="space-y-6">
                                            {/* Section: Informations ─── */}
                                            <fieldset>
                                                <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Informations</legend>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    {/* Name */}
                                                    <div className="sm:col-span-2">
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            Nom <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="Nom du client"
                                                            className="form-input w-full rounded-lg"
                                                            value={form.name}
                                                            onChange={(e) => updateField('name', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Location */}
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            Localisation <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="Adresse / Quartier"
                                                            className="form-input w-full rounded-lg"
                                                            value={form.location}
                                                            onChange={(e) => updateField('location', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Zone */}
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Zone de livraison</label>
                                                        <select className="form-select w-full rounded-lg" value={form.zone} onChange={(e) => updateField('zone', e.target.value)}>
                                                            <option value="">— Aucune zone —</option>
                                                            {zones.map((z) => (
                                                                <option key={z._id} value={z.name}>
                                                                    {z.displayName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Person count */}
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            Nombre de personnes <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={50}
                                                            className="form-input w-full rounded-lg"
                                                            value={form.personCount}
                                                            onChange={(e) => updateField('personCount', parseInt(e.target.value) || 1)}
                                                        />
                                                    </div>

                                                    {/* Customer type */}
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Type de client</label>
                                                        <select
                                                            className="form-select w-full rounded-lg"
                                                            value={form.isBusiness.toString()}
                                                            onChange={(e) => updateField('isBusiness', e.target.value === 'true')}
                                                        >
                                                            <option value="false">Particulier</option>
                                                            <option value="true">Entreprise</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </fieldset>

                                            {/* Section: Téléphones ──── */}
                                            <fieldset>
                                                <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                                    Téléphones <span className="text-red-500">*</span>
                                                </legend>
                                                <div className="space-y-2">
                                                    {form.phones.map((phone, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="+225 XX XX XX XX XX"
                                                                className="form-input flex-1 rounded-lg"
                                                                value={phone.number}
                                                                onChange={(e) => changePhone(idx, 'number', e.target.value)}
                                                            />
                                                            <select className="form-select w-28 rounded-lg" value={phone.type} onChange={(e) => changePhone(idx, 'type', e.target.value)}>
                                                                <option value="both">Les deux</option>
                                                                <option value="whatsapp">WhatsApp</option>
                                                                <option value="call">Appel</option>
                                                            </select>
                                                            {form.phones.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                                                    onClick={() => removePhone(idx)}
                                                                >
                                                                    <IconX className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button type="button" className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5" onClick={addPhone}>
                                                    + Ajouter un numéro
                                                </button>
                                            </fieldset>

                                            {/* Section: Marketing ───── */}
                                            <fieldset>
                                                <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Marketing &amp; Statut</legend>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Statut</label>
                                                        <select
                                                            className="form-select w-full rounded-lg"
                                                            value={form.isProspect.toString()}
                                                            onChange={(e) => updateField('isProspect', e.target.value === 'true')}
                                                        >
                                                            <option value="false">Client actif</option>
                                                            <option value="true">Prospect</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Source marketing</label>
                                                        <select className="form-select w-full rounded-lg" value={form.marketingSource} onChange={(e) => updateField('marketingSource', e.target.value)}>
                                                            {MARKETING_SOURCES.map((s) => (
                                                                <option key={s.value} value={s.value}>
                                                                    {s.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </fieldset>

                                            {/* Section: Notes ────────── */}
                                            <fieldset>
                                                <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</legend>
                                                <textarea
                                                    rows={3}
                                                    placeholder="Notes supplémentaires…"
                                                    className="form-textarea w-full resize-none rounded-lg"
                                                    value={form.notes}
                                                    onChange={(e) => updateField('notes', e.target.value)}
                                                />
                                            </fieldset>
                                        </div>
                                    </div>

                                    {/* ── Footer (sticky) ────────── */}
                                    <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                        <button
                                            type="button"
                                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                            onClick={closeModal}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={saveCustomer}
                                            disabled={isSaving}
                                        >
                                            {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                            {isSaving ? 'Enregistrement…' : form._id ? 'Mettre à jour' : 'Créer le client'}
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* ── WhatsApp Dialog ──────────────────────────── */}
            {waTarget && <WhatsAppDialog open={!!waTarget} onClose={() => setWaTarget(null)} clientName={waTarget.name} phoneNumber={waTarget.phone} phones={waTarget.phones} />}
        </div>
    );
};

export default ComponentsAppsCustomers;
