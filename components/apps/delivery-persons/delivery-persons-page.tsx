'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { createDeliveryPerson, CreateDeliveryPersonDto, deleteDeliveryPerson, DeliveryPerson, getDeliveryPersons, updateDeliveryPerson } from '@/lib/api/delivery-persons';
import { getActiveZones, Zone } from '@/lib/api/zones';

const emptyForm: CreateDeliveryPersonDto = { name: '', phone: '', zone: '', isActive: true };

const DeliveryPersonsPage = () => {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<DeliveryPerson | null>(null);
    const [form, setForm] = useState<CreateDeliveryPersonDto>(emptyForm);

    const { data: persons = [], isLoading } = useQuery({
        queryKey: ['delivery-persons'],
        queryFn: async () => {
            const res = await getDeliveryPersons(true);
            return res.data;
        },
    });

    const { data: zones = [] } = useQuery<Zone[]>({
        queryKey: ['zones', 'active'],
        queryFn: async () => {
            const res = await getActiveZones();
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: (dto: CreateDeliveryPersonDto) => createDeliveryPerson(dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-persons'] });
            closeModal();
            Swal.fire('Succès', 'Livreur ajouté', 'success');
        },
        onError: () => Swal.fire('Erreur', "Échec de l'ajout", 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateDeliveryPersonDto> }) => updateDeliveryPerson(id, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-persons'] });
            closeModal();
            Swal.fire('Succès', 'Livreur mis à jour', 'success');
        },
        onError: () => Swal.fire('Erreur', 'Échec de la mise à jour', 'error'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteDeliveryPerson(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-persons'] });
            Swal.fire('Succès', 'Livreur supprimé', 'success');
        },
        onError: () => Swal.fire('Erreur', 'Échec de la suppression', 'error'),
    });

    const closeModal = () => {
        setShowModal(false);
        setEditing(null);
        setForm(emptyForm);
    };

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (p: DeliveryPerson) => {
        setEditing(p);
        setForm({ name: p.name, phone: p.phone, zone: p.zone || '', isActive: p.isActive });
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim()) {
            Swal.fire('Erreur', 'Le nom et le téléphone sont requis', 'error');
            return;
        }
        if (editing) {
            updateMutation.mutate({ id: editing._id, dto: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const handleDelete = async (p: DeliveryPerson) => {
        const result = await Swal.fire({
            title: 'Supprimer ce livreur ?',
            text: p.name,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e74c3c',
        });
        if (result.isConfirmed) deleteMutation.mutate(p._id);
    };

    const active = persons.filter((p) => p.isActive && !p.isDeleted);
    const inactive = persons.filter((p) => !p.isActive || p.isDeleted);

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Livreurs</h1>
                    <p className="mt-0.5 text-xs text-slate-400">Gérer les agents de livraison et récupération</p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter un livreur
                </button>
            </div>

            {/* Active agents */}
            <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
                    <div className="h-5 w-1 rounded-full bg-emerald-500" />
                    <h3 className="flex-1 text-sm font-bold text-slate-700 dark:text-white">Actifs</h3>
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        {active.length}
                    </span>
                </div>
                {active.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-slate-400">Aucun livreur actif</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {active.map((p) => (
                            <PersonRow key={p._id} person={p} zones={zones} onEdit={() => openEdit(p)} onDelete={() => handleDelete(p)} />
                        ))}
                    </div>
                )}
            </div>

            {/* Inactive agents */}
            {inactive.length > 0 && (
                <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
                        <div className="h-5 w-1 rounded-full bg-slate-400" />
                        <h3 className="flex-1 text-sm font-bold text-slate-700 dark:text-white">Inactifs</h3>
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            {inactive.length}
                        </span>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {inactive.map((p) => (
                            <PersonRow key={p._id} person={p} zones={zones} onEdit={() => openEdit(p)} onDelete={() => handleDelete(p)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={closeModal} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">{editing ? 'Modifier le livreur' : 'Nouveau livreur'}</h3>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4 p-6">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nom *</label>
                                    <input
                                        type="text"
                                        className="form-input w-full rounded-lg"
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="Nom complet"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Téléphone *</label>
                                    <input
                                        type="tel"
                                        className="form-input w-full rounded-lg"
                                        value={form.phone}
                                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                        placeholder="+225 XX XX XX XX XX"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Zone</label>
                                    <select className="form-select w-full rounded-lg" value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}>
                                        <option value="">— Aucune zone —</option>
                                        {zones.map((z) => (
                                            <option key={z._id} value={z.name}>
                                                {z.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="isActiveCheck"
                                        type="checkbox"
                                        className="form-checkbox rounded text-primary"
                                        checked={form.isActive}
                                        onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                                    />
                                    <label htmlFor="isActiveCheck" className="text-sm text-slate-700 dark:text-slate-300">
                                        Actif
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                                        disabled={createMutation.isPending || updateMutation.isPending}
                                    >
                                        {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : editing ? 'Modifier' : 'Ajouter'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Row component ─────────────────────────────────────────
const PersonRow = ({ person, zones, onEdit, onDelete }: { person: DeliveryPerson; zones: Zone[]; onEdit: () => void; onDelete: () => void }) => {
    const zone = zones.find((z) => z.name === person.zone);
    return (
        <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            {/* Avatar */}
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${person.isActive ? 'bg-primary' : 'bg-slate-400'}`}>
                {person.name.charAt(0).toUpperCase()}
            </div>
            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-700 dark:text-white">{person.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{person.phone}</span>
                    {zone && (
                        <>
                            <span>·</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">{zone.displayName}</span>
                        </>
                    )}
                </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1">
                <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700" title="Modifier">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                    </svg>
                </button>
                <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" title="Supprimer">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default DeliveryPersonsPage;
