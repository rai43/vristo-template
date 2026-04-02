'use client';
import React, { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Customer, generateCustomerId, getCustomer, getCustomerHistory, updateCustomer } from '@/lib/api/clients';
import { getActiveZones, type Zone } from '@/lib/api/zones';
import { getCustomerOrders } from '@/lib/api/orders';
import { Dialog, Transition } from '@headlessui/react';
import IconMapPin from '@/components/icon/icon-map-pin';
import IconCalendar from '@/components/icon/icon-calendar';
import IconUsers from '@/components/icon/icon-users';
import IconShoppingBag from '@/components/icon/icon-shopping-bag';
import IconCreditCard from '@/components/icon/icon-credit-card';
import IconPencilPaper from '@/components/icon/icon-pencil-paper';
import IconX from '@/components/icon/icon-x';
import Swal from 'sweetalert2';
import WhatsAppDialog from '@/components/apps/customers/whatsapp-dialog';

/* ── Constants ─────────────────────────────────────────── */
const MARKETING_SOURCES = [
    { value: '', label: 'Sélectionner une source' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'TikTok', label: 'TikTok' },
    { value: 'Local Advertisement', label: 'Publicité locale' },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Flyers', label: 'Flyers' },
    { value: 'Other', label: 'Autre' },
];

interface PhoneEntry {
    number: string;
    type: 'whatsapp' | 'call' | 'both';
}

interface EditForm {
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

const toast = (msg: string, type: 'success' | 'error' = 'success') =>
    Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
    }).fire({ icon: type, title: msg });

/* ── Status helpers ────────────────────────────────────── */
const ORDER_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'En attente', bg: 'bg-warning/10', text: 'text-warning' },
    registered: { label: 'Enregistré', bg: 'bg-info/10', text: 'text-info' },
    processing: { label: 'En traitement', bg: 'bg-primary/10', text: 'text-primary' },
    ready_for_delivery: { label: 'Prêt livraison', bg: 'bg-success/10', text: 'text-success' },
    out_for_delivery: { label: 'En livraison', bg: 'bg-warning/10', text: 'text-warning' },
    not_delivered: { label: 'Pas livré', bg: 'bg-danger/10', text: 'text-danger' },
    delivered: { label: 'Livré', bg: 'bg-success/10', text: 'text-success' },
    returned: { label: 'Retourné', bg: 'bg-danger/10', text: 'text-danger' },
    cancelled: { label: 'Annulé', bg: 'bg-slate-100', text: 'text-slate-500' },
};
const PAYMENT_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    unpaid: { label: 'Impayé', bg: 'bg-danger/10', text: 'text-danger' },
    partial: { label: 'Partiel', bg: 'bg-warning/10', text: 'text-warning' },
    paid: { label: 'Payé', bg: 'bg-success/10', text: 'text-success' },
    overpaid: { label: 'Surplus', bg: 'bg-info/10', text: 'text-info' },
};

const StatusBadge = ({ status, map }: { status: string; map: Record<string, { label: string; bg: string; text: string }> }) => {
    const c = map[status] || { label: status, bg: 'bg-slate-100', text: 'text-slate-600' };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>{c.label}</span>;
};

/* ── All Orders Modal ──────────────────────────────────── */
const AllOrdersModal = ({ clientId, clientName, open, onClose }: { clientId: string; clientName: string; open: boolean; onClose: () => void }) => {
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const { data, isLoading } = useQuery({
        queryKey: ['client-all-orders', clientId, page],
        queryFn: async () => {
            const res = await getCustomerOrders(clientId, page, PAGE_SIZE);
            return res.data;
        },
        enabled: open && !!clientId,
    });

    const orders = data?.data || [];
    const total = data?.meta?.total || 0;
    const totalPages = data?.meta?.totalPages || 1;

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" onClose={onClose} className="relative z-50">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                        <Dialog.Panel className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                            {/* Header */}
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <div>
                                    <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">Toutes les commandes</Dialog.Title>
                                    <p className="mt-0.5 text-sm text-slate-400">
                                        {clientName} · {total} commande{total !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <IconX className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex h-40 items-center justify-center">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                                    </div>
                                ) : orders.length === 0 ? (
                                    <div className="flex h-40 flex-col items-center justify-center text-slate-400">
                                        <div className="mb-2 text-4xl">📭</div>
                                        <p>Aucune commande</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">N° Commande</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Pack / Articles</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Date</th>
                                                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Montant</th>
                                                <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Payé</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Paiement</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                                                <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                            {orders.map((order) => (
                                                <tr key={order._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                    <td className="px-4 py-3">
                                                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{order.orderId?.slice(-14) || order._id.slice(-8)}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`rounded px-2 py-0.5 text-xs font-bold ${
                                                                order.type === 'subscription' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                                                            }`}
                                                        >
                                                            {order.type === 'subscription' ? 'Abonnement' : 'À la carte'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{order.packName || (order.items?.length ? `${order.items.length} art.` : '—')}</td>
                                                    <td className="px-4 py-3 text-slate-500">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{(order.totalPrice || 0).toLocaleString()} F</td>
                                                    <td className="px-4 py-3 text-right font-medium text-success">{(order.totalPaid || 0).toLocaleString()} F</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={order.paymentStatus || 'unpaid'} map={PAYMENT_STATUS_MAP} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={order.status} map={ORDER_STATUS_MAP} />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Link
                                                            href={`/apps/orders/view?id=${order.orderId || order._id}`}
                                                            onClick={onClose}
                                                            className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                                                        >
                                                            Voir
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-3 dark:border-slate-700">
                                    <span className="text-xs text-slate-400">
                                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40 dark:border-slate-600"
                                        >
                                            Précédent
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40 dark:border-slate-600"
                                        >
                                            Suivant
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};

/* ── Edit Modal ────────────────────────────────────────── */
const EditClientModal = ({ client, open, onClose, onSaved }: { client: Customer; open: boolean; onClose: () => void; onSaved: () => void }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<EditForm>({
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
    });
    const [originalIsBusiness, setOriginalIsBusiness] = useState<boolean>(false);

    // Populate form when client changes
    useEffect(() => {
        if (client) {
            setForm({
                _id: client._id,
                customerId: client.customerId,
                name: client.name,
                location: client.location,
                zone: client.zone || '',
                phones: client.phones?.length ? client.phones : [{ number: '+225 ', type: 'both' }],
                personCount: client.personCount || 1,
                isBusiness: client.isBusiness,
                isProspect: client.isProspect,
                marketingSource: client.marketingSource || '',
                notes: client.notes || '',
            });
            setOriginalIsBusiness(client.isBusiness);
        }
    }, [client]);

    // Regenerate customerId on type toggle
    useEffect(() => {
        if (form._id && form.isBusiness !== originalIsBusiness) {
            generateCustomerId(form.isBusiness)
                .then((res) => setForm((prev) => ({ ...prev, customerId: res.data.customerId })))
                .catch(console.error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.isBusiness]);

    const { data: zonesRes } = useQuery({ queryKey: ['zones', 'active'], queryFn: getActiveZones, staleTime: 5 * 60_000 });
    const zones: Zone[] = zonesRes?.data ?? [];

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) => updateCustomer(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client', client._id] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast('Client mis à jour avec succès.');
            onSaved();
            onClose();
        },
        onError: (err: any) => toast(err.response?.data?.message || 'Échec de la mise à jour', 'error'),
    });

    const updateField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
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

    const save = () => {
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
        updateMutation.mutate({ id: form._id, data: payload });
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
                        <Dialog.Panel className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                            {/* Header */}
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/50">
                                <div>
                                    <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">Modifier le client</Dialog.Title>
                                    {form.customerId && <p className="mt-0.5 font-mono text-xs text-slate-400">{form.customerId}</p>}
                                </div>
                                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                    <IconX className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                <div className="space-y-6">
                                    {/* Informations */}
                                    <fieldset>
                                        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Informations</legend>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="sm:col-span-2">
                                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Nom <span className="text-red-500">*</span>
                                                </label>
                                                <input type="text" className="form-input w-full rounded-lg" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Localisation <span className="text-red-500">*</span>
                                                </label>
                                                <input type="text" className="form-input w-full rounded-lg" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
                                            </div>
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
                                            <div>
                                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de personnes</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    className="form-input w-full rounded-lg"
                                                    value={form.personCount}
                                                    onChange={(e) => updateField('personCount', parseInt(e.target.value) || 1)}
                                                />
                                            </div>
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

                                    {/* Téléphones */}
                                    <fieldset>
                                        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            Téléphones <span className="text-red-500">*</span>
                                        </legend>
                                        <div className="space-y-2">
                                            {form.phones.map((phone, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="text" className="form-input flex-1 rounded-lg" value={phone.number} onChange={(e) => changePhone(idx, 'number', e.target.value)} />
                                                    <select className="form-select w-28 rounded-lg" value={phone.type} onChange={(e) => changePhone(idx, 'type', e.target.value)}>
                                                        <option value="both">Les deux</option>
                                                        <option value="whatsapp">WhatsApp</option>
                                                        <option value="call">Appel</option>
                                                    </select>
                                                    {form.phones.length > 1 && (
                                                        <button
                                                            type="button"
                                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                            onClick={() => removePhone(idx)}
                                                        >
                                                            <IconX className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5" onClick={addPhone}>
                                            + Ajouter un numéro
                                        </button>
                                    </fieldset>

                                    {/* Marketing & Statut */}
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

                                    {/* Notes */}
                                    <fieldset>
                                        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</legend>
                                        <textarea rows={3} className="form-textarea w-full resize-none rounded-lg" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
                                    </fieldset>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
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
                                    disabled={updateMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {updateMutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                    {updateMutation.isPending ? 'Enregistrement…' : 'Mettre à jour'}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};

/* ── Main Component ────────────────────────────────────── */
const ClientProfile = () => {
    const searchParams = useSearchParams();
    const clientId = searchParams.get('id');
    const queryClient = useQueryClient();

    const [editOpen, setEditOpen] = useState(false);
    const [allOrdersOpen, setAllOrdersOpen] = useState(false);
    const [waTarget, setWaTarget] = useState<{
        name: string;
        phone: string;
        phones: { number: string; type: 'whatsapp' | 'call' | 'both' }[];
    } | null>(null);

    const { data: client, isLoading: clientLoading } = useQuery({
        queryKey: ['client', clientId],
        queryFn: async () => {
            const res = await getCustomer(clientId!);
            return res.data;
        },
        enabled: !!clientId,
    });

    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['client-orders', clientId],
        queryFn: async () => {
            const res = await getCustomerOrders(clientId!, 1, 10);
            return res.data;
        },
        enabled: !!clientId,
    });

    const { data: historyData } = useQuery({
        queryKey: ['client-history', clientId],
        queryFn: async () => {
            const res = await getCustomerHistory(clientId!, { limit: 5 });
            return res.data;
        },
        enabled: !!clientId,
    });

    if (!clientId) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 text-6xl">👤</div>
                    <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-white">Aucun client sélectionné</h2>
                    <p className="mb-4 text-sm text-slate-500">Veuillez sélectionner un client depuis la liste des clients</p>
                    <Link href="/apps/customers" className="btn btn-primary">
                        Voir les clients
                    </Link>
                </div>
            </div>
        );
    }

    if (clientLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    <p className="mt-4 text-sm text-slate-500">Chargement du profil...</p>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 text-6xl">❌</div>
                    <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-white">Client non trouvé</h2>
                    <p className="mb-4 text-sm text-slate-500">Le client demandé n&apos;existe pas ou a été supprimé</p>
                    <Link href="/apps/customers" className="btn btn-primary">
                        Retour à la liste
                    </Link>
                </div>
            </div>
        );
    }

    const orders = ordersData?.data || [];
    const totalOrders = ordersData?.meta?.total || 0;
    const history = historyData?.data || [];

    const subscriptionOrders = orders.filter((o) => o.type === 'subscription');
    const aLaCarteOrders = orders.filter((o) => o.type === 'a-la-carte');
    const totalSpent = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const paidAmount = orders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
    const unpaidAmount = totalSpent - paidAmount;

    const getPhoneTypeIcon = (type: string) => (type === 'whatsapp' ? '📱' : type === 'call' ? '📞' : '📲');

    return (
        <div>
            {/* Breadcrumb */}
            <ul className="mb-5 flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/apps/customers" className="text-primary hover:underline">
                        Clients
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Profil</span>
                </li>
            </ul>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {/* ── Profile Card ─────────────────────── */}
                <div className="panel">
                    <div className="mb-5 flex items-center justify-between">
                        <h5 className="text-lg font-semibold dark:text-white-light">Profil Client</h5>
                        <button type="button" onClick={() => setEditOpen(true)} className="btn btn-primary rounded-full p-2" title="Modifier">
                            <IconPencilPaper />
                        </button>
                    </div>
                    <div className="mb-5">
                        <div className="flex flex-col items-center justify-center">
                            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-3xl font-bold text-white shadow-lg">
                                {client.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                            </div>
                            <h4 className="text-xl font-semibold text-primary">{client.name}</h4>
                            <p className="mt-1 text-sm text-slate-500">ID: {client.customerId}</p>
                            <div className="mt-3 flex flex-wrap justify-center gap-2">
                                {client.isBusiness && <span className="rounded-full bg-info/10 px-3 py-1 text-xs font-semibold text-info">Entreprise</span>}
                                {client.isProspect && <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">Prospect</span>}
                                {!client.isProspect && !client.isBusiness && <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">Client</span>}
                            </div>
                        </div>

                        <ul className="m-auto mt-6 flex max-w-[280px] flex-col space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <li className="flex items-center gap-3">
                                <IconMapPin className="h-5 w-5 shrink-0 text-slate-400" />
                                <span>{client.location || 'Non renseigné'}</span>
                            </li>
                            {client.zone && (
                                <li className="flex items-center gap-3">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">🏘️</span>
                                    <span>Zone: {client.zone}</span>
                                </li>
                            )}
                            {client.phones?.map((phone, idx) => (
                                <li key={idx} className="flex items-center gap-3">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">{getPhoneTypeIcon(phone.type)}</span>
                                    <span dir="ltr">{phone.number}</span>
                                    <span className="text-xs text-slate-400">({phone.type === 'whatsapp' ? 'WhatsApp' : phone.type === 'call' ? 'Appel' : 'Les deux'})</span>
                                    {(phone.type === 'whatsapp' || phone.type === 'both') && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setWaTarget({
                                                    name: client.name,
                                                    phone: phone.number,
                                                    phones: client.phones || [],
                                                })
                                            }
                                            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-500/10"
                                            title="Envoyer un WhatsApp"
                                        >
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.215l-.297-.178-2.871.853.853-2.871-.178-.297A8 8 0 1112 20z" />
                                            </svg>
                                        </button>
                                    )}
                                </li>
                            ))}
                            {client.birthday && (
                                <li className="flex items-center gap-3">
                                    <IconCalendar className="h-5 w-5 shrink-0 text-slate-400" />
                                    <span>Anniversaire: {new Date(client.birthday).toLocaleDateString('fr-FR')}</span>
                                </li>
                            )}
                            {client.personCount > 1 && (
                                <li className="flex items-center gap-3">
                                    <IconUsers className="h-5 w-5 shrink-0 text-slate-400" />
                                    <span>{client.personCount} personnes</span>
                                </li>
                            )}
                        </ul>

                        {client.marketingSource && (
                            <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                                <p className="text-xs font-semibold uppercase text-slate-400">Source Marketing</p>
                                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{client.marketingSource}</p>
                            </div>
                        )}
                        {client.notes && (
                            <div className="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                                <p className="text-xs font-semibold uppercase text-amber-600">Notes</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{client.notes}</p>
                            </div>
                        )}
                        {client.dateToContact && (
                            <div className="mt-4 rounded-lg bg-primary/10 p-3">
                                <p className="text-xs font-semibold uppercase text-primary">À contacter le</p>
                                <p className="mt-1 text-sm font-medium text-primary">{new Date(client.dateToContact).toLocaleDateString('fr-FR')}</p>
                            </div>
                        )}
                        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400 dark:border-slate-700">
                            Client depuis le {new Date(client.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                    </div>
                </div>

                {/* ── Main Content ──────────────────────── */}
                <div className="space-y-5 lg:col-span-2 xl:col-span-3">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            {
                                icon: <IconShoppingBag className="h-5 w-5 text-primary" />,
                                value: totalOrders,
                                label: 'Commandes',
                                from: 'from-primary/10',
                                to: 'to-primary/5',
                                bg: 'bg-primary/20',
                                color: 'text-primary',
                            },
                            {
                                icon: <IconCreditCard className="h-5 w-5 text-success" />,
                                value: totalSpent.toLocaleString(),
                                label: 'Total (FCFA)',
                                from: 'from-success/10',
                                to: 'to-success/5',
                                bg: 'bg-success/20',
                                color: 'text-success',
                            },
                            {
                                icon: <span className="text-lg">📦</span>,
                                value: subscriptionOrders.length,
                                label: 'Abonnements',
                                from: 'from-info/10',
                                to: 'to-info/5',
                                bg: 'bg-info/20',
                                color: 'text-info',
                            },
                            {
                                icon: <span className="text-lg">🛒</span>,
                                value: aLaCarteOrders.length,
                                label: 'À la carte',
                                from: 'from-warning/10',
                                to: 'to-warning/5',
                                bg: 'bg-warning/20',
                                color: 'text-warning',
                            },
                        ].map((s, i) => (
                            <div key={i} className={`panel rounded-xl bg-gradient-to-br ${s.from} ${s.to} p-4`}>
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>{s.icon}</div>
                                    <div>
                                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                        <p className="text-xs text-slate-500">{s.label}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Payment Summary */}
                    <div className="panel">
                        <h5 className="mb-4 text-lg font-semibold dark:text-white-light">Résumé des Paiements</h5>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800">
                                <p className="text-xs font-semibold uppercase text-slate-400">Total dû</p>
                                <p className="mt-1 text-xl font-bold text-slate-700 dark:text-white">{totalSpent.toLocaleString()} F</p>
                            </div>
                            <div className="rounded-lg bg-success/10 p-4 text-center">
                                <p className="text-xs font-semibold uppercase text-success">Payé</p>
                                <p className="mt-1 text-xl font-bold text-success">{paidAmount.toLocaleString()} F</p>
                            </div>
                            <div className="rounded-lg bg-danger/10 p-4 text-center">
                                <p className="text-xs font-semibold uppercase text-danger">Impayé</p>
                                <p className="mt-1 text-xl font-bold text-danger">{unpaidAmount.toLocaleString()} F</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="mb-2 flex justify-between text-xs text-slate-500">
                                <span>Progression des paiements</span>
                                <span>{totalSpent > 0 ? Math.round((paidAmount / totalSpent) * 100) : 0}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-all duration-500"
                                    style={{ width: `${totalSpent > 0 ? (paidAmount / totalSpent) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recent Orders (last 10) */}
                    <div className="panel">
                        <div className="mb-4 flex items-center justify-between">
                            <h5 className="text-lg font-semibold dark:text-white-light">
                                Commandes Récentes
                                {totalOrders > 0 && (
                                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">{totalOrders}</span>
                                )}
                            </h5>
                            {totalOrders > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setAllOrdersOpen(true)}
                                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                                >
                                    Voir tout →
                                </button>
                            )}
                        </div>
                        {ordersLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="py-10 text-center text-slate-400">
                                <div className="mb-2 text-4xl">📭</div>
                                <p>Aucune commande pour ce client</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-700">
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">N° Commande</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Date</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Montant</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Paiement</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                                            <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order) => (
                                            <tr key={order._id} className="border-b border-slate-50 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                                                <td className="px-3 py-3">
                                                    <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{order.orderId?.slice(-14) || order._id.slice(-8)}</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span
                                                        className={`rounded px-2 py-0.5 text-xs font-bold ${
                                                            order.type === 'subscription' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                                                        }`}
                                                    >
                                                        {order.type === 'subscription' ? 'ABO' : 'ALC'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-slate-500">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                                                <td className="px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{(order.totalPrice || 0).toLocaleString()} F</td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge status={order.paymentStatus || 'unpaid'} map={PAYMENT_STATUS_MAP} />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge status={order.status} map={ORDER_STATUS_MAP} />
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <Link
                                                        href={`/apps/orders/view?id=${order.orderId || order._id}`}
                                                        className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                                                    >
                                                        Voir
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Activity History */}
                    <div className="panel">
                        <h5 className="mb-4 text-lg font-semibold dark:text-white-light">Historique d&apos;Activité</h5>
                        {history.length === 0 ? (
                            <div className="py-6 text-center text-slate-400">
                                <div className="mb-2 text-3xl">📋</div>
                                <p>Aucune activité enregistrée</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((item, idx) => (
                                    <div key={item._id || idx} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                                                item.action === 'created'
                                                    ? 'bg-success/20 text-success'
                                                    : item.action === 'updated'
                                                      ? 'bg-info/20 text-info'
                                                      : item.action === 'deleted'
                                                        ? 'bg-danger/20 text-danger'
                                                        : 'bg-warning/20 text-warning'
                                            }`}
                                        >
                                            {item.action === 'created' ? '➕' : item.action === 'updated' ? '✏️' : item.action === 'deleted' ? '🗑️' : '♻️'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {item.action === 'created'
                                                    ? 'Client créé'
                                                    : item.action === 'updated'
                                                      ? 'Profil mis à jour'
                                                      : item.action === 'deleted'
                                                        ? 'Client supprimé'
                                                        : 'Client restauré'}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {new Date(item.timestamp).toLocaleDateString('fr-FR')} à{' '}
                                                {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                                {item.performedBy && ` • par ${item.performedBy}`}
                                            </p>
                                            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {client && <EditClientModal client={client} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['client', clientId] })} />}

            {/* All Orders Modal */}
            {clientId && <AllOrdersModal clientId={clientId} clientName={client.name} open={allOrdersOpen} onClose={() => setAllOrdersOpen(false)} />}

            {/* WhatsApp Dialog */}
            {waTarget && <WhatsAppDialog open={!!waTarget} onClose={() => setWaTarget(null)} clientName={waTarget.name} phoneNumber={waTarget.phone} phones={waTarget.phones} />}
        </div>
    );
};

export default ClientProfile;
