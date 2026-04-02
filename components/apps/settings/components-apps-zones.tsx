'use client';
import React, { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import Swal from 'sweetalert2';
import { createZone, deleteZone, getZones, updateZone, type Zone } from '@/lib/api/zones';
import IconPencil from '@/components/icon/icon-pencil';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconPlus from '@/components/icon/icon-plus';
import IconX from '@/components/icon/icon-x';

const toast = (msg: string, type: 'success' | 'error' = 'success') => Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000 }).fire({ icon: type, title: msg });

const EMPTY: Omit<Zone, '_id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    displayName: '',
    subscriptionFee: 0,
    aLaCarteFee: 0,
    isActive: true,
    description: '',
};

/* ── Modal ── */
const ZoneModal = ({ open, onClose, zone }: { open: boolean; onClose: () => void; zone: Zone | null }) => {
    const qc = useQueryClient();
    const [form, setForm] = useState<Omit<Zone, '_id' | 'createdAt' | 'updatedAt'>>(
        zone
            ? {
                  name: zone.name,
                  displayName: zone.displayName,
                  subscriptionFee: zone.subscriptionFee,
                  aLaCarteFee: zone.aLaCarteFee,
                  isActive: zone.isActive,
                  description: zone.description || '',
              }
            : { ...EMPTY },
    );

    React.useEffect(() => {
        setForm(
            zone
                ? {
                      name: zone.name,
                      displayName: zone.displayName,
                      subscriptionFee: zone.subscriptionFee,
                      aLaCarteFee: zone.aLaCarteFee,
                      isActive: zone.isActive,
                      description: zone.description || '',
                  }
                : { ...EMPTY },
        );
    }, [zone, open]);

    const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

    const saveMut = useMutation({
        mutationFn: () => (zone ? updateZone(zone._id, form) : createZone(form)),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['zones'] });
            toast(zone ? 'Zone mise à jour.' : 'Zone créée.');
            onClose();
        },
        onError: (e: any) => toast(e.response?.data?.message || 'Erreur', 'error'),
    });

    const save = () => {
        if (!form.name.trim()) return toast('Nom (slug) requis.', 'error');
        if (!form.displayName.trim()) return toast('Nom affiché requis.', 'error');
        saveMut.mutate();
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" onClose={onClose} className="relative z-50">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                                <Dialog.Title className="text-base font-bold text-slate-800 dark:text-white">{zone ? 'Modifier la zone' : 'Nouvelle zone'}</Dialog.Title>
                                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <IconX className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="space-y-4 px-6 py-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Slug (ex: cocody) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            className="form-input w-full rounded-lg font-mono text-sm"
                                            placeholder="cocody"
                                            value={form.name}
                                            onChange={(e) => set('name', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Nom affiché <span className="text-red-500">*</span>
                                        </label>
                                        <input className="form-input w-full rounded-lg" placeholder="Cocody" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Frais abonnement (F)</label>
                                        <input
                                            type="number"
                                            className="form-input w-full rounded-lg"
                                            placeholder="0"
                                            value={form.subscriptionFee}
                                            onChange={(e) => set('subscriptionFee', Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Frais à la carte (F)</label>
                                        <input
                                            type="number"
                                            className="form-input w-full rounded-lg"
                                            placeholder="0"
                                            value={form.aLaCarteFee}
                                            onChange={(e) => set('aLaCarteFee', Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                                    <input
                                        className="form-input w-full rounded-lg"
                                        placeholder="Quartiers couverts…"
                                        value={form.description || ''}
                                        onChange={(e) => set('description', e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input type="checkbox" className="peer sr-only" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                                        <div className="peer h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4 dark:bg-slate-700" />
                                    </label>
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Zone active</span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    onClick={save}
                                    disabled={saveMut.isPending}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {saveMut.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                    {saveMut.isPending ? 'Enregistrement…' : zone ? 'Mettre à jour' : 'Créer'}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};

/* ── Main Component ── */
const ComponentsAppsZones = () => {
    const qc = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editZone, setEditZone] = useState<Zone | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['zones'],
        queryFn: async () => (await getZones()).data,
    });
    const zones: Zone[] = data || [];

    const deleteMut = useMutation({
        mutationFn: deleteZone,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['zones'] });
            toast('Zone supprimée.');
        },
        onError: (e: any) => toast(e.response?.data?.message || 'Erreur', 'error'),
    });

    const confirmDelete = (z: Zone) =>
        Swal.fire({
            title: 'Supprimer ?',
            text: `Supprimer la zone "${z.displayName}" ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        }).then((r) => {
            if (r.isConfirmed) deleteMut.mutate(z._id);
        });

    const active = zones.filter((z) => z.isActive);
    const inactive = zones.filter((z) => !z.isActive);

    return (
        <div className="space-y-5">
            <ul className="flex space-x-2 text-sm rtl:space-x-reverse">
                <li>
                    <span className="text-primary">Paramètres</span>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span className="text-slate-500">Zones</span>
                </li>
            </ul>

            {/* Header */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">Zones de livraison</h1>
                    <p className="mt-0.5 text-sm text-slate-400">
                        {active.length} active{active.length !== 1 ? 's' : ''} · {inactive.length} inactive{inactive.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setEditZone(null);
                        setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                    <IconPlus className="h-4 w-4" />
                    Nouvelle zone
                </button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                {isLoading ? (
                    <div className="flex h-40 items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    </div>
                ) : zones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <div className="mb-3 text-5xl">📍</div>
                        <p className="font-medium">Aucune zone configurée</p>
                        <button
                            type="button"
                            onClick={() => {
                                setEditZone(null);
                                setModalOpen(true);
                            }}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
                        >
                            <IconPlus className="h-4 w-4" /> Ajouter une zone
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700">
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Zone</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Frais Abonnement</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Frais À la Carte</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {zones.map((z) => (
                                <tr key={z._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="px-5 py-3">
                                        <div className="font-semibold text-slate-800 dark:text-white">{z.displayName}</div>
                                        <div className="font-mono text-xs text-slate-400">{z.name}</div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">{z.subscriptionFee.toLocaleString()} F</td>
                                    <td className="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-200">{z.aLaCarteFee.toLocaleString()} F</td>
                                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{z.description || <span className="text-slate-300">—</span>}</td>
                                    <td className="px-5 py-3 text-center">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                z.isActive ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                            }`}
                                        >
                                            {z.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditZone(z);
                                                    setModalOpen(true);
                                                }}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"
                                                title="Modifier"
                                            >
                                                <IconPencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => confirmDelete(z)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                                title="Supprimer"
                                            >
                                                <IconTrashLines className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ZoneModal open={modalOpen} onClose={() => setModalOpen(false)} zone={editZone} />
        </div>
    );
};

export default ComponentsAppsZones;
