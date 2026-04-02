'use client';
import React, { Fragment, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import {
    AgentDailySummary,
    createDeliveryPerson,
    DailyOpEntry,
    DailyPaymentEntry,
    deleteDeliveryPerson,
    type DeliveryPerson,
    getDeliveryDailySummary,
    getDeliveryPersons,
    updateDeliveryPerson,
} from '@/lib/api/delivery-persons';
import { getAllOperations, updateOperation } from '@/lib/api/orders';
import IconX from '@/components/icon/icon-x';
import IconPencil from '@/components/icon/icon-pencil';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconUserPlus from '@/components/icon/icon-user-plus';
import Swal from 'sweetalert2';

/* ── Helpers ──────────────────────────────────────────────── */
const toast = (msg: string, type: 'success' | 'error' = 'success') =>
    Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
    }).fire({ icon: type, title: msg });

const todayStr = () => new Date().toISOString().split('T')[0];

const OP_STATUS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    pending: { label: 'En attente', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    confirmed: { label: 'Confirmé', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    registered: { label: 'Enregistré', bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
    processing: { label: 'En traitement', bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
    ready_for_delivery: { label: 'Prêt livr.', bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
    out_for_delivery: { label: 'En livraison', bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
    not_delivered: { label: 'Pas livré', bg: 'bg-danger/10', text: 'text-danger', dot: 'bg-danger' },
    delivered: { label: 'Livré', bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
    returned: { label: 'Retourné', bg: 'bg-danger/10', text: 'text-danger', dot: 'bg-danger' },
    cancelled: { label: 'Annulé', bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300' },
};

const PAYMENT_METHODS: Record<string, { label: string; color: string }> = {
    Cash: { label: 'Espèces', color: 'text-emerald-600 bg-emerald-50' },
    Wave: { label: 'Wave', color: 'text-blue-600 bg-blue-50' },
    OrangeMoney: { label: 'Orange', color: 'text-orange-600 bg-orange-50' },
    MTNMoney: { label: 'MTN', color: 'text-yellow-600 bg-yellow-50' },
    MoovMoney: { label: 'Moov', color: 'text-cyan-600 bg-cyan-50' },
    Other: { label: 'Autre', color: 'text-slate-600 bg-slate-100' },
};

const StatusBadge = ({ status }: { status: string }) => {
    const c = OP_STATUS[status] || OP_STATUS.pending;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
};

/* ── WhatsApp message builder ─────────────────────────────── */
const buildWhatsAppMessage = (agents: AgentDailySummary[], date: string) => {
    const d = new Date(date + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let msg = `🧺 *MIRAI Services — Planning du ${dateLabel}*\n\n`;

    agents.forEach((agent) => {
        msg += `👤 *${agent.agentName}* (${agent.totalOps} ops)\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;

        if (agent.pickups.length > 0) {
            msg += `📦 *Récupérations (${agent.pickups.length})*\n`;
            agent.pickups.forEach((op, i) => {
                const status = OP_STATUS[op.status]?.label || op.status;
                msg += `  ${i + 1}. ${op.customer.name}`;
                if (op.customer.phone) msg += ` — ${op.customer.phone}`;
                msg += `\n`;
                msg += `     📍 ${op.city || op.customer.zone || '—'}`;
                if (op.scheduledTime) msg += ` ⏰ ${op.scheduledTime}`;
                msg += ` [${status}]`;
                if (op.clothesCount > 0) msg += ` • ${op.clothesCount} art.`;
                msg += `\n`;
            });
        }

        if (agent.deliveries.length > 0) {
            msg += `🚚 *Livraisons (${agent.deliveries.length})*\n`;
            agent.deliveries.forEach((op, i) => {
                const status = OP_STATUS[op.status]?.label || op.status;
                msg += `  ${i + 1}. ${op.customer.name}`;
                if (op.customer.phone) msg += ` — ${op.customer.phone}`;
                msg += `\n`;
                msg += `     📍 ${op.city || op.customer.zone || '—'}`;
                if (op.scheduledTime) msg += ` ⏰ ${op.scheduledTime}`;
                msg += ` [${status}]`;
                if (op.clothesCount > 0) msg += ` • ${op.clothesCount} art.`;
                msg += `\n`;
            });
        }
        msg += `\n`;
    });

    return msg.trim();
};

const buildAgentWhatsAppMessage = (agent: AgentDailySummary, date: string) => {
    const d = new Date(date + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    let msg = `🧺 *Planning ${agent.agentName} — ${dateLabel}*\n\n`;

    if (agent.pickups.length > 0) {
        msg += `📦 *Récupérations (${agent.pickups.length})*\n`;
        agent.pickups.forEach((op, i) => {
            msg += `${i + 1}. *${op.customer.name}*`;
            if (op.customer.phone) msg += `\n   📞 ${op.customer.phone}`;
            msg += `\n   📍 ${op.city || op.customer.zone || '—'}`;
            if (op.scheduledTime) msg += `  ⏰ ${op.scheduledTime}`;
            if (op.clothesCount > 0) msg += `\n   👔 ${op.clothesCount} articles`;
            msg += `\n`;
        });
    }

    if (agent.deliveries.length > 0) {
        if (agent.pickups.length > 0) msg += `\n`;
        msg += `🚚 *Livraisons (${agent.deliveries.length})*\n`;
        agent.deliveries.forEach((op, i) => {
            msg += `${i + 1}. *${op.customer.name}*`;
            if (op.customer.phone) msg += `\n   📞 ${op.customer.phone}`;
            msg += `\n   📍 ${op.city || op.customer.zone || '—'}`;
            if (op.scheduledTime) msg += `  ⏰ ${op.scheduledTime}`;
            if (op.clothesCount > 0) msg += `\n   👔 ${op.clothesCount} articles`;
            msg += `\n`;
        });
    }

    return msg.trim();
};

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast('Message copié !');
    } catch {
        toast('Erreur de copie', 'error');
    }
};

/* ── Edit / Create Modal ──────────────────────────────────── */
interface PersonForm {
    _id: string;
    name: string;
    phone: string;
    zone: string;
    isActive: boolean;
}

const EMPTY_FORM: PersonForm = { _id: '', name: '', phone: '', zone: '', isActive: true };

const PersonModal = ({ open, onClose, person }: { open: boolean; onClose: () => void; person: DeliveryPerson | null }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<PersonForm>(
        person
            ? { _id: person._id, name: person.name, phone: person.phone, zone: person.zone || '', isActive: person.isActive }
            : { ...EMPTY_FORM },
    );

    React.useEffect(() => {
        setForm(
            person
                ? { _id: person._id, name: person.name, phone: person.phone, zone: person.zone || '', isActive: person.isActive }
                : { ...EMPTY_FORM },
        );
    }, [person, open]);

    const saveMutation = useMutation({
        mutationFn: () =>
            form._id
                ? updateDeliveryPerson(form._id, { name: form.name, phone: form.phone, zone: form.zone || undefined, isActive: form.isActive })
                : createDeliveryPerson({ name: form.name, phone: form.phone, zone: form.zone || undefined, isActive: form.isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-persons'] });
            toast(form._id ? 'Livreur mis à jour.' : 'Livreur créé.');
            onClose();
        },
        onError: (e: any) => toast(e.response?.data?.message || 'Erreur', 'error'),
    });

    const save = () => {
        if (!form.name.trim()) return toast('Nom requis.', 'error');
        if (!form.phone.trim()) return toast('Téléphone requis.', 'error');
        saveMutation.mutate();
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" onClose={onClose} className="relative z-50">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                        <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/50">
                                <Dialog.Title className="text-base font-bold text-slate-800 dark:text-white">{form._id ? 'Modifier le livreur' : 'Nouveau livreur'}</Dialog.Title>
                                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><IconX className="h-4 w-4" /></button>
                            </div>
                            <div className="space-y-4 px-6 py-5">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nom <span className="text-red-500">*</span></label>
                                    <input type="text" className="form-input w-full rounded-lg" placeholder="Prénom Nom" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Téléphone <span className="text-red-500">*</span></label>
                                    <input type="text" className="form-input w-full rounded-lg" placeholder="+225 XX XX XX XX XX" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Zone</label>
                                    <input type="text" className="form-input w-full rounded-lg" placeholder="Ex: cocody, yopougon…" value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input type="checkbox" className="peer sr-only" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                                        <div className="peer h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-[2px] after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-4 dark:bg-slate-700" />
                                    </label>
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Livreur actif</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">Annuler</button>
                                <button type="button" onClick={save} disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                                    {saveMutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                    {saveMutation.isPending ? 'Enregistrement…' : form._id ? 'Mettre à jour' : 'Créer'}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};

/* ── Assign Operation Modal ───────────────────────────────── */
interface UnassignedOp {
    orderMongoId: string;
    orderId: string;
    operationType: 'pickup' | 'delivery';
    operationIndex: number;
    status: string;
    date: string;
    customerName: string;
    city: string;
    clothesCount?: number;
}

const AssignOpsModal = ({ open, onClose, agentName, unassignedOps, date }: { open: boolean; onClose: () => void; agentName: string; unassignedOps: UnassignedOp[]; date: string }) => {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'pickup' | 'delivery'>('all');

    React.useEffect(() => { setSelected(new Set()); }, [open]);

    const filtered = useMemo(() => {
        let ops = unassignedOps.filter((op) => op.date.startsWith(date));
        // For pickups, only allow assigning pending or confirmed (client-requested) operations
        ops = ops.filter((op) => op.operationType === 'pickup' ? (op.status === 'pending' || op.status === 'confirmed') : true);
        if (filter !== 'all') ops = ops.filter((op) => op.operationType === filter);
        return ops;
    }, [unassignedOps, date, filter]);

    const toggle = (key: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

    const selectAll = () => { selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((op) => `${op.orderMongoId}-${op.operationType}-${op.operationIndex}`))); };

    const assignMutation = useMutation({
        mutationFn: async () => {
            const ops = filtered.filter((op) => selected.has(`${op.orderMongoId}-${op.operationType}-${op.operationIndex}`));
            await Promise.all(ops.map((op) => {
                // Assign as pickupAgent for pickups, deliveryAgent for deliveries
                const agentData = op.operationType === 'pickup'
                    ? { pickupAgent: agentName }
                    : { deliveryAgent: agentName };
                return updateOperation(op.orderMongoId, op.operationType, op.operationIndex, agentData);
            }));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operations'] });
            queryClient.invalidateQueries({ queryKey: ['delivery-daily-summary'] });
            toast(`${selected.size} opération${selected.size > 1 ? 's' : ''} assignée${selected.size > 1 ? 's' : ''} à ${agentName}`);
            onClose();
        },
        onError: (e: any) => toast(e?.response?.data?.message || 'Erreur', 'error'),
    });

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" onClose={onClose} className="relative z-50">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                        <Dialog.Panel className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]" style={{ maxHeight: '85vh' }}>
                            <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/50">
                                <div>
                                    <Dialog.Title className="text-base font-bold text-slate-800 dark:text-white">Assigner à {agentName}</Dialog.Title>
                                    <p className="mt-0.5 text-xs text-slate-400">Opérations non assignées du {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')}</p>
                                </div>
                                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><IconX className="h-4 w-4" /></button>
                            </div>
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3 dark:border-slate-700/50">
                                {(['all', 'pickup', 'delivery'] as const).map((f) => (
                                    <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                                        {f === 'all' ? 'Tout' : f === 'pickup' ? '📦 Récup.' : '🚚 Livr.'}
                                    </button>
                                ))}
                                <div className="flex-1" />
                                <button type="button" onClick={selectAll} className="text-xs font-medium text-primary hover:underline">{selected.size === filtered.length && filtered.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}</button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {filtered.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <div className="mb-2 text-3xl">✅</div>
                                        <p className="text-sm">Toutes les opérations sont assignées</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {filtered.map((op) => {
                                            const key = `${op.orderMongoId}-${op.operationType}-${op.operationIndex}`;
                                            const isChecked = selected.has(key);
                                            return (
                                                <button key={key} type="button" onClick={() => toggle(key)} className={`flex w-full items-center gap-3 px-6 py-3 text-left transition-colors ${isChecked ? 'bg-primary/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${isChecked ? 'border-primary bg-primary text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {isChecked && <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${op.operationType === 'pickup' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {op.operationType === 'pickup' ? '↓' : '↑'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{op.customerName}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                                            <span>{op.city || '—'}</span>
                                                            {op.clothesCount && op.clothesCount > 0 && <span>{op.clothesCount} art.</span>}
                                                        </div>
                                                    </div>
                                                    <StatusBadge status={op.status} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                <span className="text-xs text-slate-400">{selected.size} sélectionnée{selected.size !== 1 ? 's' : ''}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">Annuler</button>
                                    <button type="button" onClick={() => assignMutation.mutate()} disabled={selected.size === 0 || assignMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                                        {assignMutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                        {assignMutation.isPending ? 'Assignation…' : `Assigner (${selected.size})`}
                                    </button>
                                </div>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};

/* ── Agent Detail Drawer ──────────────────────────────────── */
const AgentDrawer = ({ agent, open, onClose, date }: { agent: AgentDailySummary | null; open: boolean; onClose: () => void; date: string }) => {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'ops' | 'payments'>('ops');
    if (!agent) return null;

    const completionRate = agent.totalOps > 0 ? Math.round((agent.completedOps / agent.totalOps) * 100) : 0;
    const points = agent.completedOps;
    const allOps: (DailyOpEntry & { _opType: string })[] = [
        ...agent.pickups.map((p) => ({ ...p, _opType: 'pickup' })),
        ...agent.deliveries.map((d) => ({ ...d, _opType: 'delivery' })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const handleUnassign = async (op: DailyOpEntry & { _opType: string }) => {
        const result = await Swal.fire({
            title: 'Désassigner cette opération ?',
            text: `${op.customer.name} — ${op._opType === 'pickup' ? 'Récupération' : 'Livraison'}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui, désassigner',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e7515a',
        });
        if (result.isConfirmed) {
            try {
                const agentField = op._opType === 'pickup' ? { pickupAgent: '' } : { deliveryAgent: '' };
                await updateOperation(op.orderMongoId, op._opType as 'pickup' | 'delivery', op.opIndex, agentField);
                queryClient.invalidateQueries({ queryKey: ['delivery-daily-summary'] });
                queryClient.invalidateQueries({ queryKey: ['operations'] });
                toast('Opération désassignée');
            } catch (err: any) {
                toast(err?.response?.data?.message || 'Erreur', 'error');
            }
        }
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" onClose={onClose} className="relative z-50">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
                </Transition.Child>
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="translate-x-full" enterTo="translate-x-0" leave="ease-in duration-150" leaveFrom="translate-x-0" leaveTo="translate-x-full">
                    <Dialog.Panel className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#1a2234]">
                        {/* Header */}
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-lg font-bold text-white shadow-lg shadow-primary/25">
                                        {agent.agentName.charAt(0).toUpperCase()}
                                    </div>
                                    {points > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white shadow">{points}</span>}
                                </div>
                                <div>
                                    <Dialog.Title className="font-bold text-slate-800 dark:text-white">{agent.agentName}</Dialog.Title>
                                    <p className="text-xs text-slate-400">{agent.totalOps} op{agent.totalOps !== 1 ? 's' : ''} · {points} pt{points !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => copyToClipboard(buildAgentWhatsAppMessage(agent, date))} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Copier message WhatsApp">
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.65 0-3.193-.494-4.48-1.34l-.32-.19-2.87.85.85-2.87-.19-.32A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" /></svg>
                                </button>
                                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><IconX className="h-4 w-4" /></button>
                            </div>
                        </div>

                        {/* Stats strip */}
                        <div className="grid shrink-0 grid-cols-5 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-700 dark:border-slate-700">
                            {[
                                { label: 'Récup.', value: agent.totalPickups, color: 'text-amber-600' },
                                { label: 'Livr.', value: agent.totalDeliveries, color: 'text-primary' },
                                { label: 'Terminés', value: agent.completedOps, color: 'text-success' },
                                { label: 'Points', value: points, color: 'text-amber-500' },
                                { label: 'Articles', value: agent.clothesCount, color: 'text-slate-700 dark:text-slate-200' },
                            ].map((s) => (
                                <div key={s.label} className="py-3 text-center">
                                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-slate-400">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Completion bar */}
                        <div className="shrink-0 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                <span>Progression</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{completionRate}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div className={`h-full rounded-full transition-all duration-500 ${completionRate === 100 ? 'bg-gradient-to-r from-success to-emerald-400' : 'bg-gradient-to-r from-primary to-primary/70'}`} style={{ width: `${completionRate}%` }} />
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-700">
                            {(['ops', 'payments'] as const).map((t) => (
                                <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    {t === 'ops' ? `Opérations (${agent.totalOps})` : `Paiements (${agent.payments.length})`}
                                </button>
                            ))}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto">
                            {tab === 'ops' ? (
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {allOps.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-400"><div className="mb-2 text-3xl">📋</div><p className="text-sm">Aucune opération</p></div>
                                    ) : (
                                        allOps.map((op, idx) => (
                                            <div key={idx} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${op._opType === 'pickup' ? 'bg-amber-50 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                                                    {op._opType === 'pickup' ? '↓' : '↑'}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{op.customer.name}</span>
                                                        <StatusBadge status={op.status} />
                                                    </div>
                                                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                                                        <span>{op.city}</span>
                                                        {op.clothesCount > 0 && <span>{op.clothesCount} art.</span>}
                                                        {op.packName && <span>{op.packName}</span>}
                                                        {op.orderType === 'subscription' && <span className="text-primary">ABO #{op.opIndex + 1}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <button type="button" onClick={() => handleUnassign(op)} className="rounded bg-red-50 p-1 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20" title="Désassigner">
                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                    </button>
                                                    <Link href={`/apps/orders/view?id=${op.orderId}`} className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-primary/10 hover:text-primary dark:bg-slate-700 dark:hover:bg-primary/20">Voir</Link>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
                                        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800"><p className="text-xs text-slate-400">Total</p><p className="mt-0.5 text-base font-bold text-slate-700 dark:text-white">{agent.totalCollected.toLocaleString()} F</p></div>
                                        <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/20"><p className="text-xs text-emerald-600">Espèces</p><p className="mt-0.5 text-base font-bold text-emerald-700">{agent.cashCollected.toLocaleString()} F</p></div>
                                        <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20"><p className="text-xs text-blue-600">Mobile</p><p className="mt-0.5 text-base font-bold text-blue-700">{agent.mobileCollected.toLocaleString()} F</p></div>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {agent.payments.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400"><div className="mb-2 text-3xl">💰</div><p className="text-sm">Aucun paiement</p></div>
                                        ) : (
                                            agent.payments.map((p: DailyPaymentEntry, idx) => {
                                                const m = PAYMENT_METHODS[p.method] || PAYMENT_METHODS.Other;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3 px-5 py-3">
                                                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${m.color}`}>{m.label}</span>
                                                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{p.customer}</p><p className="font-mono text-[10px] text-slate-400">{p.orderId?.slice(-12)}</p></div>
                                                        <span className="shrink-0 text-sm font-bold text-success">{p.amount.toLocaleString()} F</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Dialog.Panel>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
};

/* ── Agent Card (redesigned with progress ring) ───────────── */
const AgentCard = ({ agent, onClick }: { agent: AgentDailySummary; onClick: () => void }) => {
    const completion = agent.totalOps > 0 ? Math.round((agent.completedOps / agent.totalOps) * 100) : 0;
    const points = agent.completedOps;
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (completion / 100) * circumference;

    return (
        <button type="button" onClick={onClick} className="group w-full rounded-2xl border border-slate-200/60 bg-white p-5 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-lg dark:border-slate-700/50 dark:bg-[#1a2234] dark:hover:border-primary/40">
            {/* Top: Avatar + name + progress ring */}
            <div className="mb-4 flex items-center gap-4">
                <div className="relative">
                    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-700" />
                        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="3" strokeLinecap="round" className={completion === 100 ? 'text-success' : 'text-primary'} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm font-bold text-primary">{agent.agentName.charAt(0).toUpperCase()}</span></div>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-slate-800 dark:text-white">{agent.agentName}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10">⭐ {points} pt{points !== 1 ? 's' : ''}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${completion === 100 ? 'bg-success/10 text-success' : completion > 50 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>{completion}%</span>
                    </div>
                </div>
            </div>

            {/* Ops row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10"><p className="text-xl font-bold text-amber-600">{agent.totalPickups}</p><p className="text-[10px] font-medium text-amber-500">📦 Récup.</p></div>
                <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10"><p className="text-xl font-bold text-primary">{agent.totalDeliveries}</p><p className="text-[10px] font-medium text-primary/70">🚚 Livr.</p></div>
                <div className="rounded-xl bg-success/10 p-3 text-center"><p className="text-xl font-bold text-success">{agent.completedOps}</p><p className="text-[10px] font-medium text-success/70">✅ Faits</p></div>
            </div>

            {/* Money row */}
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-800/30">
                <div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Collecté</p><p className="text-sm font-bold text-slate-700 dark:text-white">{agent.totalCollected.toLocaleString()} F</p></div>
                <div className="flex gap-2">
                    {agent.cashCollected > 0 && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">💵 {agent.cashCollected.toLocaleString()}</span>}
                    {agent.mobileCollected > 0 && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">📱 {agent.mobileCollected.toLocaleString()}</span>}
                </div>
            </div>
        </button>
    );
};

/* ── Main Component ───────────────────────────────────────── */
const ComponentsAppsLivreurs = () => {
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(todayStr());
    const [activeTab, setActiveTab] = useState<'summary' | 'team'>('summary');
    const [modalOpen, setModalOpen] = useState(false);
    const [editPerson, setEditPerson] = useState<DeliveryPerson | null>(null);
    const [drawerAgent, setDrawerAgent] = useState<AgentDailySummary | null>(null);
    const [assignModalAgent, setAssignModalAgent] = useState<string | null>(null);

    const { data: personsData, isLoading: personsLoading } = useQuery({ queryKey: ['delivery-persons', true], queryFn: () => getDeliveryPersons(true) });

    const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
        queryKey: ['delivery-daily-summary', selectedDate],
        queryFn: () => getDeliveryDailySummary(selectedDate),
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const { data: opsData } = useQuery({
        queryKey: ['operations', 'livreurs', selectedDate],
        queryFn: () => getAllOperations({ startDate: selectedDate, endDate: selectedDate }),
        staleTime: 30_000,
    });

    const unassignedOps: UnassignedOp[] = useMemo(() => {
        const ops = (opsData as any)?.data?.operations || [];
        return ops
            .filter((op: any) => {
                if (op.isTerminal) return false;
                // For pickups: unassigned if no pickupAgent
                // For deliveries: unassigned if no deliveryAgent
                if (op.operationType === 'pickup') return !op.pickupAgent;
                return !op.deliveryAgent;
            })
            .map((op: any) => ({
                orderMongoId: op.orderMongoId,
                orderId: op.orderId,
                operationType: op.operationType,
                operationIndex: op.operationIndex,
                status: op.status,
                date: op.date?.split('T')[0] || selectedDate,
                customerName: op.customer?.name || '—',
                city: op.city || op.customer?.zone || '',
                clothesCount: op.clothesCount,
            }));
    }, [opsData, selectedDate]);

    const deleteMutation = useMutation({
        mutationFn: deleteDeliveryPerson,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['delivery-persons'] }); toast('Livreur supprimé.'); },
        onError: (e: any) => toast(e.response?.data?.message || 'Erreur', 'error'),
    });

    const confirmDelete = (p: DeliveryPerson) => {
        Swal.fire({ title: 'Confirmer ?', text: `Supprimer ${p.name} ?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler', confirmButtonColor: '#d33' }).then((r) => {
            if (r.isConfirmed) deleteMutation.mutate(p._id);
        });
    };

    const persons: DeliveryPerson[] = personsData?.data || [];
    const summary = summaryData?.data;
    const globalTotals = summary?.globalTotals;
    const agents = useMemo(() => summary?.agents || [], [summary?.agents]);
    const isToday = selectedDate === todayStr();
    const globalPoints = useMemo(() => agents.reduce((sum, a) => sum + a.completedOps, 0), [agents]);

    const handleCopyGlobalWhatsApp = useCallback(() => {
        if (agents.length === 0) { toast('Aucun agent assigné', 'error'); return; }
        copyToClipboard(buildWhatsAppMessage(agents, selectedDate));
    }, [agents, selectedDate]);

    return (
        <div className="space-y-5">
            <ul className="flex space-x-2 text-sm rtl:space-x-reverse">
                <li><span className="text-primary">Apps</span></li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2"><span className="text-slate-500">Livreurs</span></li>
            </ul>

            {/* Header */}
            <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/80 px-6 py-5 shadow-sm dark:border-slate-700/50 dark:from-[#1a2234] dark:to-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">🚚 Livreurs</h1>
                        <p className="mt-0.5 text-sm text-slate-400">
                            {persons.filter((p) => p.isActive).length} actif{persons.filter((p) => p.isActive).length !== 1 ? 's' : ''} sur {persons.length}
                            {unassignedOps.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{unassignedOps.length} non assignée{unassignedOps.length > 1 ? 's' : ''}</span>}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                            <span className="text-sm text-slate-400">📅</span>
                            <input type="date" className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                            {!isToday && <button type="button" onClick={() => setSelectedDate(todayStr())} className="ml-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Aujourd&apos;hui</button>}
                        </div>
                        <button type="button" onClick={handleCopyGlobalWhatsApp} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" title="Copier le planning WhatsApp">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.65 0-3.193-.494-4.48-1.34l-.32-.19-2.87.85.85-2.87-.19-.32A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" /></svg>
                        Copier planning
                        </button>
                        <button type="button" onClick={() => refetchSummary()} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300" title="Actualiser">↻</button>
                        <button type="button" onClick={() => { setEditPerson(null); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                            <IconUserPlus className="h-4 w-4" /> Nouveau livreur
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex gap-1 border-t border-slate-100 pt-4 dark:border-slate-700">
                    {([['summary', '📊 Résumé du jour'], ['team', '👥 Équipe']] as const).map(([t, label]) => (
                        <button key={t} type="button" onClick={() => setActiveTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{label}</button>
                    ))}
                </div>
            </div>

            {/* ── Tab: Daily Summary ──────────────────────── */}
            {activeTab === 'summary' && (
                <div className="space-y-5">
                    {summaryLoading ? (
                        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" /></div>
                    ) : !globalTotals ? (
                        <div className="rounded-xl border border-slate-200/60 bg-white p-10 text-center text-slate-400 dark:border-slate-700/50 dark:bg-[#1a2234]"><div className="mb-2 text-4xl">🚚</div><p>Aucune donnée pour cette date</p></div>
                    ) : (
                        <>
                            {/* Global stats */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                                {[
                                    { label: 'Total ops', value: globalTotals.totalOps, icon: '🔄', color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
                                    { label: 'Récupérations', value: globalTotals.totalPickups, icon: '📦', color: 'text-amber-600', bg: 'from-amber-50 to-amber-50/50' },
                                    { label: 'Livraisons', value: globalTotals.totalDeliveries, icon: '🚚', color: 'text-info', bg: 'from-info/10 to-info/5' },
                                    { label: 'Articles', value: globalTotals.clothesCount, icon: '👔', color: 'text-purple-600', bg: 'from-purple-50 to-purple-50/50' },
                                    { label: 'Points', value: globalPoints, icon: '⭐', color: 'text-amber-500', bg: 'from-amber-50 to-amber-50/50' },
                                    { label: 'Non assignées', value: unassignedOps.length, icon: '⚠️', color: unassignedOps.length > 0 ? 'text-red-500' : 'text-success', bg: unassignedOps.length > 0 ? 'from-red-50 to-red-50/50' : 'from-success/10 to-success/5' },
                                ].map((s, i) => (
                                    <div key={i} className={`rounded-xl border border-slate-200/60 bg-gradient-to-br ${s.bg} p-4 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]`}>
                                        <div className="flex items-center gap-2"><span className="text-lg">{s.icon}</span><div><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-[10px] text-slate-400">{s.label}</p></div></div>
                                    </div>
                                ))}
                            </div>

                            {/* Money KPIs */}
                            <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">💰 Encaissements du jour</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800"><p className="text-xs font-semibold uppercase text-slate-400">Total collecté</p><p className="mt-1 text-2xl font-bold text-slate-700 dark:text-white">{globalTotals.totalCollected.toLocaleString()}</p><p className="text-xs text-slate-400">FCFA</p></div>
                                    <div className="rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20"><p className="text-xs font-semibold uppercase text-emerald-600">Espèces</p><p className="mt-1 text-2xl font-bold text-emerald-700">{globalTotals.cashCollected.toLocaleString()}</p><p className="text-xs text-emerald-500">Cash</p></div>
                                    <div className="rounded-xl bg-blue-50 p-4 text-center dark:bg-blue-900/20"><p className="text-xs font-semibold uppercase text-blue-600">Mobile Money</p><p className="mt-1 text-2xl font-bold text-blue-700">{globalTotals.mobileCollected.toLocaleString()}</p><p className="text-xs text-blue-500">Wave / OM / MTN…</p></div>
                                </div>
                                {globalTotals.totalCollected > 0 && (
                                    <div className="mt-4">
                                        <div className="mb-1 flex justify-between text-xs text-slate-400">
                                            <span>Espèces {Math.round((globalTotals.cashCollected / globalTotals.totalCollected) * 100)}%</span>
                                            <span>Mobile {Math.round((globalTotals.mobileCollected / globalTotals.totalCollected) * 100)}%</span>
                                        </div>
                                        <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(globalTotals.cashCollected / globalTotals.totalCollected) * 100}%` }} />
                                            <div className="h-full bg-blue-400 transition-all" style={{ width: `${(globalTotals.mobileCollected / globalTotals.totalCollected) * 100}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Per-agent cards */}
                            {agents.length === 0 ? (
                                <div className="rounded-xl border border-slate-200/60 bg-white p-10 text-center text-slate-400 dark:border-slate-700/50 dark:bg-[#1a2234]"><div className="mb-2 text-3xl">👤</div><p className="text-sm">Aucun livreur assigné ce jour</p><p className="mt-1 text-xs text-slate-300">Assignez des livreurs aux opérations depuis la page Opérations</p></div>
                            ) : (
                                <div>
                                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Par livreur</h2>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {agents.map((agent) => (
                                            <div key={agent.agentName} className="relative">
                                                <AgentCard agent={agent} onClick={() => setDrawerAgent(agent)} />
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setAssignModalAgent(agent.agentName); }} className="absolute right-3 top-3 rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20" title="Assigner des opérations">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── Tab: Team ───────────────────────────────── */}
            {activeTab === 'team' && (
                <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                    {personsLoading ? (
                        <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" /></div>
                    ) : persons.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <div className="mb-3 text-5xl">🚚</div>
                            <p className="text-base font-medium">Aucun livreur enregistré</p>
                            <button type="button" onClick={() => { setEditPerson(null); setModalOpen(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"><IconUserPlus className="h-4 w-4" /> Ajouter un livreur</button>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-700">
                                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Livreur</th>
                                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Téléphone</th>
                                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Zone</th>
                                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                                    <th className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {persons.map((p) => (
                                    <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{p.name.charAt(0).toUpperCase()}</div><span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span></div></td>
                                        <td className="px-5 py-3 text-slate-500" dir="ltr">{p.phone}</td>
                                        <td className="px-5 py-3">{p.zone ? <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">{p.zone}</span> : <span className="text-slate-300">—</span>}</td>
                                        <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.isActive ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-500'}`}>{p.isActive ? 'Actif' : 'Inactif'}</span></td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => setAssignModalAgent(p.name)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary" title="Assigner des opérations">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                </button>
                                                <button type="button" onClick={() => { setEditPerson(p); setModalOpen(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary" title="Modifier"><IconPencil className="h-4 w-4" /></button>
                                                <button type="button" onClick={() => confirmDelete(p)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" title="Supprimer"><IconTrashLines className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Modals */}
            <PersonModal open={modalOpen} onClose={() => setModalOpen(false)} person={editPerson} />
            <AgentDrawer agent={drawerAgent} open={!!drawerAgent} onClose={() => setDrawerAgent(null)} date={selectedDate} />
            <AssignOpsModal open={!!assignModalAgent} onClose={() => setAssignModalAgent(null)} agentName={assignModalAgent || ''} unassignedOps={unassignedOps} date={selectedDate} />
        </div>
    );
};

export default ComponentsAppsLivreurs;
