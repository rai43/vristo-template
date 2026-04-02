'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OperationalPeriod, operationalPeriodsApi } from '@/lib/api/operational-periods';
import Swal from 'sweetalert2';
import IconPlus from '@/components/icon/icon-plus';
import IconPencil from '@/components/icon/icon-pencil';
import IconTrashLines from '@/components/icon/icon-trash-lines';

/* ── helpers ── */
const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000, customClass: { container: 'toast' } }).fire({
        icon: type,
        title: msg,
        padding: '10px 20px',
    });
};

const fmtDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return iso;
    }
};

/* ── empty form state ── */
const emptyForm = { name: '', startDate: '', endDate: '', description: '', isCurrent: false };

/* ── Component ── */
const ComponentsAppsOperationalPeriods = () => {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    /* ── Queries ── */
    const { data: periods = [], isLoading } = useQuery<OperationalPeriod[]>({
        queryKey: ['operational-periods'],
        queryFn: () => operationalPeriodsApi.getAll(),
    });

    /* ── Mutations ── */
    const createMutation = useMutation({
        mutationFn: operationalPeriodsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operational-periods'] });
            toast('Période créée avec succès');
            resetForm();
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la création', 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof operationalPeriodsApi.update>[1] }) => operationalPeriodsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operational-periods'] });
            toast('Période mise à jour');
            resetForm();
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la mise à jour', 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: operationalPeriodsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operational-periods'] });
            toast('Période supprimée');
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur lors de la suppression', 'error'),
    });

    const setCurrentMutation = useMutation({
        mutationFn: (id: string) => operationalPeriodsApi.update(id, { isCurrent: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operational-periods'] });
            toast('Période courante mise à jour');
        },
        onError: (err: any) => toast(err?.response?.data?.message || 'Erreur', 'error'),
    });

    /* ── Handlers ── */
    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (p: OperationalPeriod) => {
        setForm({
            name: p.name,
            startDate: p.startDate.split('T')[0],
            endDate: p.endDate.split('T')[0],
            description: p.description || '',
            isCurrent: p.isCurrent,
        });
        setEditingId(p._id);
        setShowForm(true);
    };

    const handleDelete = (p: OperationalPeriod) => {
        Swal.fire({
            title: 'Supprimer cette période ?',
            text: `"${p.name}" sera supprimée.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        }).then((r) => {
            if (r.isConfirmed) deleteMutation.mutate(p._id);
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.startDate || !form.endDate) {
            toast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        if (editingId) {
            updateMutation.mutate({ id: editingId, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    /* ── Render ── */
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Périodes Opérationnelles</h1>
                        <p className="mt-0.5 text-sm text-slate-400">Définissez les périodes de filtrage pour les commandes, opérations et tableaux de bord</p>
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                    >
                        <IconPlus className="h-4 w-4" />
                        Nouvelle période
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm dark:border-primary/30 dark:bg-primary/5">
                    <h3 className="mb-4 text-sm font-bold text-slate-800 dark:text-white">{editingId ? 'Modifier la période' : 'Nouvelle période'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                                    Nom <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-input w-full rounded-lg text-sm"
                                    placeholder="ex: Période 1 — 2026"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                                    Date début <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="form-input w-full rounded-lg text-sm"
                                    value={form.startDate}
                                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                                    Date fin <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="form-input w-full rounded-lg text-sm"
                                    value={form.endDate}
                                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                    min={form.startDate}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
                                <input
                                    type="text"
                                    className="form-input w-full rounded-lg text-sm"
                                    placeholder="Optionnel"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="form-checkbox rounded text-primary"
                                checked={form.isCurrent}
                                onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Définir comme période courante ★</span>
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                {editingId ? 'Mettre à jour' : 'Créer'}
                            </button>
                            <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                                Annuler
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
            ) : periods.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-600 dark:bg-slate-800/50">
                    <p className="text-4xl">📅</p>
                    <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Aucune période opérationnelle</p>
                    <p className="mt-1 text-xs text-slate-400">Créez votre première période pour organiser vos données par cycle.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {periods.map((p) => (
                        <div
                            key={p._id}
                            className={`group rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-[#1a2234] ${
                                p.isCurrent ? 'border-primary/40 ring-1 ring-primary/20' : 'border-slate-200/60 dark:border-slate-700/50'
                            }`}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${
                                            p.isCurrent ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                        }`}
                                    >
                                        {p.isCurrent ? '★' : '📅'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">{p.name}</h3>
                                            {p.isCurrent && (
                                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Période courante</span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-400">
                                            {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
                                        </p>
                                        {p.description && <p className="mt-0.5 text-xs text-slate-400 italic">{p.description}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!p.isCurrent && (
                                        <button
                                            type="button"
                                            className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                                            onClick={() => setCurrentMutation.mutate(p._id)}
                                            disabled={setCurrentMutation.isPending}
                                        >
                                            Définir comme courante
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700"
                                        onClick={() => handleEdit(p)}
                                        title="Modifier"
                                    >
                                        <IconPencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                        onClick={() => handleDelete(p)}
                                        title="Supprimer"
                                        disabled={deleteMutation.isPending}
                                    >
                                        <IconTrashLines className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ComponentsAppsOperationalPeriods;

