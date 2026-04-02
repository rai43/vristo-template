'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import IconPencil from '@/components/icon/icon-pencil';
import IconPlus from '@/components/icon/icon-plus';
import IconSearch from '@/components/icon/icon-search';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconX from '@/components/icon/icon-x';
import { createPack, CreatePackDto, deletePack, generatePackCode, Pack, searchPacks, updatePack, UpdatePackDto } from '@/lib/api/packs';

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

type BadgeVariant = 'blue' | 'green' | 'amber' | 'slate' | 'purple' | 'indigo';
const BADGE: Record<BadgeVariant, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
    slate: 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-500/10 dark:text-slate-400',
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400',
};
const Badge = ({ children, variant }: { children: React.ReactNode; variant: BadgeVariant }) => (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[variant]}`}>{children}</span>
);

/* ── Constants ───────────────────────────────────────────── */

const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

const EMPTY_FORM = {
    code: '',
    name: '',
    price: 0,
    vetements: 0,
    couettes: 0,
    vestes: 0,
    draps_serviettes: 0,
    total: 0,
    validityDays: 30,
    defaultPickups: 2,
    defaultDeliveries: 2,
    displayOrder: 0,
    description: '',
};

/* ── Component ───────────────────────────────────────────── */

const ComponentsAppsPacks = () => {
    const queryClient = useQueryClient();

    /* ── UI state ─────────────────────────────────────────── */
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'displayOrder',
        direction: 'asc',
    });
    const [showModal, setShowModal] = useState(false);
    const [editingPack, setEditingPack] = useState<Pack | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    /* ── Debounce search ──────────────────────────────────── */
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(id);
    }, [search]);

    /* ── Auto-generate code when creating ─────────────────── */
    useEffect(() => {
        if (editingPack) return; // don't regenerate when editing
        if (!formData.name.trim() || !formData.price) {
            if (formData.code) setFormData((prev) => ({ ...prev, code: '' }));
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await generatePackCode(formData.name, formData.price);
                setFormData((prev) => ({ ...prev, code: res.data.code }));
            } catch {
                // fallback client-side generation
                const slug = formData.name
                    .toUpperCase()
                    .replace(/^PACK\s+/i, '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 10);
                const priceK = formData.price >= 1000 ? `${Math.round(formData.price / 1000)}K` : `${formData.price}`;
                setFormData((prev) => ({ ...prev, code: `MR-${slug}${priceK}` }));
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.name, formData.price, editingPack]);

    /* ── Queries ──────────────────────────────────────────── */

    const {
        data: searchResult,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['packs', 'search', debouncedSearch, page, pageSize, sortStatus.columnAccessor, sortStatus.direction],
        queryFn: async () => {
            const response = await searchPacks({
                q: debouncedSearch || undefined,
                page,
                limit: pageSize,
                sortBy: sortStatus.columnAccessor === 'limits' ? 'total' : sortStatus.columnAccessor === 'defaults' ? 'defaultPickups' : sortStatus.columnAccessor,
                sortDir: sortStatus.direction,
            });
            return response.data;
        },
        placeholderData: keepPreviousData,
    });

    const records = useMemo(() => searchResult?.data ?? [], [searchResult]);
    const totalRecords = searchResult?.total ?? 0;

    /* ── Mutations ────────────────────────────────────────── */

    const createMutation = useMutation({
        mutationFn: createPack,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['packs'] });
            toast('Pack créé avec succès.');
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la création.', 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdatePackDto }) => updatePack(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['packs'] });
            toast('Pack modifié avec succès.');
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la modification.', 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: deletePack,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['packs'] });
            toast('Pack désactivé avec succès.');
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la désactivation.', 'error'),
    });

    const isSaving = createMutation.isPending || updateMutation.isPending;

    /* ── Modal helpers ────────────────────────────────────── */

    const openModal = useCallback((pack?: Pack) => {
        if (pack) {
            setEditingPack(pack);
            setFormData({
                code: pack.code,
                name: pack.name,
                price: pack.price,
                vetements: pack.vetements,
                couettes: pack.couettes,
                vestes: pack.vestes,
                draps_serviettes: pack.draps_serviettes,
                total: pack.total,
                validityDays: pack.validityDays,
                defaultPickups: pack.defaultPickups,
                defaultDeliveries: pack.defaultDeliveries,
                displayOrder: pack.displayOrder,
                description: pack.description || '',
            });
        } else {
            setEditingPack(null);
            setFormData({ ...EMPTY_FORM });
        }
        setShowModal(true);
    }, []);

    const closeModal = useCallback(() => {
        setShowModal(false);
        setEditingPack(null);
        setFormData({ ...EMPTY_FORM });
    }, []);

    const handleSubmit = async () => {
        if (!formData.code.trim()) return toast('Le code est obligatoire.', 'error');
        if (!formData.name.trim()) return toast('Le nom est obligatoire.', 'error');
        if (!formData.price || formData.price <= 0) return toast('Le prix doit être supérieur à 0.', 'error');
        if (!formData.total || formData.total <= 0) return toast("Le total d'articles doit être supérieur à 0.", 'error');

        try {
            if (editingPack) {
                await updateMutation.mutateAsync({ id: editingPack._id, data: { ...formData, isActive: true } });
            } else {
                await createMutation.mutateAsync({ ...formData, isActive: true } as CreatePackDto);
            }
            closeModal();
        } catch {
            // handled in mutation
        }
    };

    const confirmDelete = (pack: Pack) => {
        Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: `Désactiver le pack « ${pack.name} » ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, désactiver',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
        }).then((result) => {
            if (result.isConfirmed) deleteMutation.mutate(pack._id);
        });
    };

    /* ── Loading / error ──────────────────────────────────── */

    if (isLoading && !searchResult) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-slate-400">Chargement des packs…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-500/10 dark:bg-red-500/5">
                <p className="text-lg font-medium text-danger">Impossible de charger les packs</p>
                <p className="mt-1 text-sm text-slate-500">Vérifiez votre connexion et réessayez.</p>
                <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['packs'] })}
                    className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    /* ── Render ────────────────────────────────────────────── */

    return (
        <div className="space-y-6">
            {/* ── Header card ──────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Gestion des Packs</h1>
                        <p className="mt-0.5 text-sm text-slate-400">
                            {totalRecords} pack{totalRecords !== 1 ? 's' : ''} au total
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Rechercher un pack…"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:focus:bg-slate-700 sm:w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                            onClick={() => openModal()}
                        >
                            <IconPlus className="h-4 w-4" />
                            Ajouter un pack
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
                        columns={[
                            {
                                accessor: 'name',
                                title: 'Pack',
                                sortable: true,
                                render: (row: Pack) => (
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-100/60 text-sm font-bold text-primary dark:from-primary/20 dark:to-indigo-900/20">
                                            {row.code?.charAt(0) || 'P'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 dark:text-white">{row.name}</p>
                                            <p className="font-mono text-xs text-slate-400">{row.code}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'price',
                                title: 'Prix',
                                sortable: true,
                                render: (row: Pack) => <span className="font-semibold text-slate-700 dark:text-slate-200">{row.price.toLocaleString()} FCFA</span>,
                            },
                            {
                                accessor: 'limits',
                                title: 'Articles inclus',
                                render: (row: Pack) => (
                                    <div className="flex flex-wrap gap-1">
                                        <Badge variant="blue">{row.vetements} vêt.</Badge>
                                        {row.couettes > 0 && (
                                            <Badge variant="purple">
                                                {row.couettes} couette{row.couettes > 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                        {row.vestes > 0 && (
                                            <Badge variant="indigo">
                                                {row.vestes} veste{row.vestes > 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                        {row.draps_serviettes > 0 && <Badge variant="amber">{row.draps_serviettes} draps/serv.</Badge>}
                                        <Badge variant="green">{row.total} total</Badge>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'defaults',
                                title: 'Logistique',
                                render: (row: Pack) => (
                                    <div className="space-y-0.5 text-xs text-slate-500">
                                        <div>
                                            <span className="text-slate-400">Récup:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{row.defaultPickups}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Livr:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{row.defaultDeliveries}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Validité:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{row.validityDays}j</span>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'displayOrder',
                                title: 'Ordre',
                                sortable: true,
                                width: 70,
                                textAlignment: 'center' as const,
                                render: (row: Pack) => <span className="text-sm font-medium text-slate-500">{row.displayOrder}</span>,
                            },
                            {
                                accessor: 'actions',
                                title: '',
                                textAlignment: 'right' as const,
                                width: 80,
                                render: (row: Pack) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                                            onClick={() => openModal(row)}
                                            title="Modifier"
                                        >
                                            <IconPencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                            onClick={() => confirmDelete(row)}
                                            title="Désactiver"
                                        >
                                            <IconTrashLines className="h-4 w-4" />
                                        </button>
                                    </div>
                                ),
                            },
                        ]}
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
                        noRecordsText="Aucun pack trouvé"
                        minHeight={300}
                    />
                </div>
            </div>

            {/* ── Modal ────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="m-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                        {/* Header */}
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{editingPack ? 'Modifier le pack' : 'Nouveau pack'}</h3>
                                {editingPack && <p className="mt-0.5 font-mono text-xs text-slate-400">{editingPack.code}</p>}
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="space-y-6">
                                {/* Section: Identification */}
                                <fieldset>
                                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Identification</legend>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Code <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Auto-généré…"
                                                className="form-input w-full rounded-lg bg-slate-50 font-mono text-sm dark:bg-slate-700/50"
                                                value={formData.code}
                                                readOnly
                                                disabled={!!editingPack}
                                            />
                                            {!editingPack && <p className="mt-1 text-[11px] text-slate-400">Généré automatiquement à partir du nom et du prix</p>}
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Nom <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Pack DOUCEUR"
                                                className="form-input w-full rounded-lg"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Prix (FCFA) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                placeholder="15000"
                                                className="form-input w-full rounded-lg"
                                                value={formData.price}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        price: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ordre d&apos;affichage</label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                className="form-input w-full rounded-lg"
                                                value={formData.displayOrder}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        displayOrder: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Section: Articles */}
                                <fieldset>
                                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Articles inclus</legend>
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Vêtements</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.vetements}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        vetements: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Couettes</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.couettes}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        couettes: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Vestes</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.vestes}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        vestes: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Draps &amp; Serv.</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.draps_serviettes}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        draps_serviettes: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Total <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.total}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        total: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Section: Logistique */}
                                <fieldset>
                                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Logistique</legend>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Récupérations</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.defaultPickups}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        defaultPickups: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Livraisons</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.defaultDeliveries}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        defaultDeliveries: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Validité (jours)</label>
                                            <input
                                                type="number"
                                                className="form-input w-full rounded-lg"
                                                value={formData.validityDays}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        validityDays: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Section: Description */}
                                <fieldset>
                                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Description</legend>
                                    <textarea
                                        rows={3}
                                        placeholder="Description du pack…"
                                        className="form-textarea w-full resize-none rounded-lg"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </fieldset>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                onClick={closeModal}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleSubmit}
                                disabled={isSaving}
                            >
                                {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                {isSaving ? 'Enregistrement…' : editingPack ? 'Modifier' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComponentsAppsPacks;
