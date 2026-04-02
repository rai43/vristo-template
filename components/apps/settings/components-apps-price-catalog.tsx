'use client';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import IconPencil from '@/components/icon/icon-pencil';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconPlus from '@/components/icon/icon-plus';
import IconX from '@/components/icon/icon-x';
import {
    createPriceCatalogItem,
    CreatePriceCatalogItemDto,
    deletePriceCatalogItem,
    PriceCatalogItem,
    searchPriceCatalog,
    updatePriceCatalogItem,
    UpdatePriceCatalogItemDto,
} from '@/lib/api/price-catalog';

const ComponentsAppsPriceCatalog = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'label',
        direction: 'asc',
    });
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceCatalogItem | null>(null);
    const [formData, setFormData] = useState({
        label: '',
        priceCFA: 0,
        category: 'custom' as 'ordinary' | 'special' | 'custom',
        description: '',
    });

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // Server-side search + pagination query
    const {
        data: searchResult,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['priceCatalog', 'search', debouncedSearch, page, pageSize, sortStatus.columnAccessor, sortStatus.direction],
        queryFn: async () => {
            const response = await searchPriceCatalog({
                q: debouncedSearch || undefined,
                page,
                limit: pageSize,
                sortBy: sortStatus.columnAccessor,
                sortDir: sortStatus.direction,
            });
            return response.data;
        },
        placeholderData: keepPreviousData,
    });

    const records = searchResult?.data ?? [];
    const totalRecords = searchResult?.total ?? 0;

    // Mutations
    const createMutation = useMutation({
        mutationFn: createPriceCatalogItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['priceCatalog'] });
            Swal.fire({ title: 'Créé!', text: "L'article a été créé avec succès.", icon: 'success', timer: 1500 });
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue.', 'error');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdatePriceCatalogItemDto }) => updatePriceCatalogItem(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['priceCatalog'] });
            Swal.fire({ title: 'Modifié!', text: "L'article a été modifié.", icon: 'success', timer: 1500 });
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue.', 'error');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePriceCatalogItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['priceCatalog'] });
            Swal.fire({ title: 'Désactivé!', text: "L'article a été désactivé.", icon: 'success', timer: 1500 });
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue.', 'error');
        },
    });

    // Open modal for add/edit
    const handleAddEdit = useCallback((item?: PriceCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                label: item.label,
                priceCFA: item.priceCFA,
                category: item.category as 'ordinary' | 'special' | 'custom',
                description: item.description || '',
            });
        } else {
            setEditingItem(null);
            setFormData({ label: '', priceCFA: 0, category: 'custom', description: '' });
        }
        setShowModal(true);
    }, []);

    const handleSubmit = async () => {
        if (!formData.label.trim()) {
            Swal.fire('Erreur!', 'Le libellé est obligatoire', 'error');
            return;
        }
        if (!formData.priceCFA || formData.priceCFA <= 0) {
            Swal.fire('Erreur!', 'Le prix doit être supérieur à 0', 'error');
            return;
        }

        try {
            if (editingItem) {
                await updateMutation.mutateAsync({ id: editingItem._id, data: { ...formData, isActive: true } });
            } else {
                await createMutation.mutateAsync({ ...formData, isActive: true } as CreatePriceCatalogItemDto);
            }
            setShowModal(false);
        } catch {
            // Handled by mutation
        }
    };

    const handleDelete = async (item: PriceCatalogItem) => {
        const result = await Swal.fire({
            title: 'Désactiver cet article?',
            text: `"${item.label}" sera désactivé du catalogue.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e7515a',
            cancelButtonColor: '#888',
            confirmButtonText: 'Désactiver',
            cancelButtonText: 'Annuler',
        });
        if (result.isConfirmed) {
            await deleteMutation.mutateAsync(item._id);
        }
    };

    const getCategoryBadge = (category: string) => {
        const styles: Record<string, string> = {
            ordinary: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            special: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            custom: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        };
        const labels: Record<string, string> = { ordinary: 'Ordinaire', special: 'Spécial', custom: 'Personnalisé' };
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[category] || styles.custom}`}>{labels[category] || category}</span>;
    };

    return (
        <>
            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="m-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                        <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{editingItem ? "Modifier l'article" : 'Ajouter un article'}</h3>
                                <p className="mt-0.5 text-xs text-slate-400">{editingItem ? `Code: ${editingItem.itemCode}` : 'Le code sera généré automatiquement'}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                            >
                                <IconX />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            <div>
                                <label htmlFor="label" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Libellé <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="label"
                                    type="text"
                                    placeholder="Ex: Chemises, Robes..."
                                    className="form-input w-full rounded-lg"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="priceCFA" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Prix (FCFA) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="priceCFA"
                                        type="number"
                                        placeholder="400"
                                        className="form-input w-full rounded-lg"
                                        value={formData.priceCFA || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                priceCFA: Number(e.target.value),
                                            })
                                        }
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catégorie <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="category"
                                        className="form-select w-full rounded-lg"
                                        value={formData.category}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                category: e.target.value as any,
                                            })
                                        }
                                    >
                                        <option value="ordinary">Ordinaire</option>
                                        <option value="special">Spécial</option>
                                        <option value="custom">Personnalisé</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Description <span className="text-xs text-slate-400">(optionnel)</span>
                                </label>
                                <textarea
                                    id="description"
                                    rows={2}
                                    placeholder="Description de l'article..."
                                    className="form-textarea w-full rounded-lg"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            {!editingItem && formData.label && formData.priceCFA > 0 && (
                                <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                                    <p className="text-xs text-slate-400">Code auto-généré (aperçu)</p>
                                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-600 dark:text-slate-300">
                                        {formData.category === 'ordinary' ? 'ORD' : formData.category === 'special' ? 'SPE' : 'CUS'}_
                                        {formData.label
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9]/g, '_')
                                            .replace(/_+/g, '_')
                                            .replace(/^_|_$/g, '')
                                            .substring(0, 20)}
                                        _{formData.priceCFA}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                onClick={() => setShowModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleSubmit}
                                disabled={!formData.label.trim() || formData.priceCFA <= 0}
                            >
                                {editingItem ? 'Enregistrer' : "Créer l'article"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="space-y-6">
                <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Catalogue de Prix</h2>
                            <p className="mt-1 text-sm text-slate-400">Gérez les articles et tarifs du pressing</p>
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 hover:shadow-md"
                            onClick={() => handleAddEdit()}
                        >
                            <IconPlus className="h-4 w-4" />
                            Nouvel Article
                        </button>
                    </div>
                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-xs">
                            <input
                                type="text"
                                className="form-input w-full rounded-lg pl-10 text-sm"
                                placeholder="Rechercher un article..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {totalRecords} article{totalRecords !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                    {isLoading && (
                        <div className="flex items-center justify-center p-12">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-l-transparent" />
                        </div>
                    )}
                    {error && <div className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">Erreur: {error.message}</div>}
                    {!isLoading && !error && (
                        <div className="datatables">
                            <DataTable
                                highlightOnHover
                                className="table-hover whitespace-nowrap"
                                records={records}
                                columns={[
                                    {
                                        accessor: 'itemCode',
                                        title: 'Code',
                                        sortable: true,
                                        width: 180,
                                        render: (row: PriceCatalogItem) => (
                                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">{row.itemCode}</span>
                                        ),
                                    },
                                    {
                                        accessor: 'label',
                                        title: 'Libellé',
                                        sortable: true,
                                        render: (row: PriceCatalogItem) => <span className="font-medium text-slate-800 dark:text-white">{row.label}</span>,
                                    },
                                    {
                                        accessor: 'priceCFA',
                                        title: 'Prix',
                                        sortable: true,
                                        width: 130,
                                        render: (row: PriceCatalogItem) => (
                                            <span className="font-semibold text-primary">
                                                {row.priceCFA.toLocaleString()} <span className="text-xs font-normal text-primary/60">FCFA</span>
                                            </span>
                                        ),
                                    },
                                    {
                                        accessor: 'category',
                                        title: 'Catégorie',
                                        sortable: true,
                                        width: 140,
                                        render: (row: PriceCatalogItem) => getCategoryBadge(row.category),
                                    },
                                    {
                                        accessor: 'description',
                                        title: 'Description',
                                        render: (row: PriceCatalogItem) => <span className="text-sm text-slate-400">{row.description || '—'}</span>,
                                    },
                                    {
                                        accessor: 'actions',
                                        title: '',
                                        width: 100,
                                        render: (row: PriceCatalogItem) => (
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => handleAddEdit(row)}
                                                    title="Modifier"
                                                >
                                                    <IconPencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                    onClick={() => handleDelete(row)}
                                                    title="Désactiver"
                                                >
                                                    <IconTrashLines className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ),
                                    },
                                ]}
                                totalRecords={totalRecords}
                                recordsPerPage={pageSize}
                                page={page}
                                onPageChange={setPage}
                                recordsPerPageOptions={PAGE_SIZES}
                                onRecordsPerPageChange={(size) => {
                                    setPageSize(size);
                                    setPage(1);
                                }}
                                sortStatus={sortStatus}
                                onSortStatusChange={setSortStatus}
                                minHeight={200}
                                paginationText={({ from, to, totalRecords: total }) => `${from}–${to} sur ${total}`}
                                noRecordsText="Aucun article trouvé"
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ComponentsAppsPriceCatalog;
