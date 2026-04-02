'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { Lead, leadsApi, PACK_LABELS, STATUS_LABELS } from '@/lib/api/leads';
import { getActiveZones, Zone } from '@/lib/api/zones';
import IconPhone from '@/components/icon/icon-phone';
import IconMapPin from '@/components/icon/icon-map-pin';
import IconArrowBackward from '@/components/icon/icon-arrow-backward';
import IconEdit from '@/components/icon/icon-edit';
import IconUser from '@/components/icon/icon-user';
import IconShoppingBag from '@/components/icon/icon-shopping-bag';
import IconNotesEdit from '@/components/icon/icon-notes-edit';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconPhoneCall from '@/components/icon/icon-phone-call';
import IconSquareCheck from '@/components/icon/icon-square-check';
import IconUserPlus from '@/components/icon/icon-user-plus';
import IconX from '@/components/icon/icon-x';
import IconInfoCircle from '@/components/icon/icon-info-circle';

/* ── Constants ────────────────────────────────────────────── */

const ADD_ONS = [
    { pickups: 0, price: 0, extraItems: 0 },
    { pickups: 1, price: 5000, extraItems: 20 },
    { pickups: 2, price: 10000, extraItems: 40 },
    { pickups: 3, price: 15000, extraItems: 60 },
    { pickups: 4, price: 20000, extraItems: 80 },
];

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

const Badge = ({ children, variant, className = '' }: { children: React.ReactNode; variant: BadgeVariant; className?: string }) => (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${BADGE[variant]} ${className}`}>{children}</span>
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

const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
const formatShortDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        customClass: { container: 'toast' },
    }).fire({ icon: type, title: msg, padding: '10px 20px' });
};

/* ── InfoRow helper ───────────────────────────────────────── */
const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-700/50">
        <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-200">{children}</span>
    </div>
);

/* ── Component ────────────────────────────────────────────── */

const LeadDetail = ({ leadId }: { leadId: string }) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState('');
    const [editingInfo, setEditingInfo] = useState(false);
    const [editForm, setEditForm] = useState<{
        name: string;
        phones: Array<{ number: string; type: string }>;
        address: string;
        zone: string;
        packChoice: string;
        additionalPickups: number;
        preferredPickupDate: string;
        birthday: string;
    }>({
        name: '',
        phones: [{ number: '', type: 'whatsapp' }],
        address: '',
        zone: '',
        packChoice: '',
        additionalPickups: 0,
        preferredPickupDate: '',
        birthday: '',
    });

    /* ── Query ─────────────────── */
    const {
        data: lead,
        isLoading,
        error,
    } = useQuery<Lead>({
        queryKey: ['lead', leadId],
        queryFn: () => leadsApi.getOne(leadId),
    });

    const { data: zonesData } = useQuery({
        queryKey: ['zones-active'],
        queryFn: async () => {
            const res = await getActiveZones();
            return res.data;
        },
    });
    const zones: Zone[] = zonesData || [];

    /* populate edit form when lead loads */
    useEffect(() => {
        if (lead && !editingInfo) {
            setEditForm({
                name: lead.name,
                phones: lead.phones.length > 0 ? lead.phones : [{ number: '', type: 'whatsapp' }],
                address: lead.address,
                zone: lead.zone || '',
                packChoice: lead.packChoice,
                additionalPickups: lead.additionalPickups || 0,
                preferredPickupDate: lead.preferredPickupDate?.slice(0, 10) || '',
                birthday: lead.birthday || '',
            });
        }
    }, [lead, editingInfo]);

    /* ── Mutations ─────────────── */
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['leads-stats'] });
    };

    const markContactedMutation = useMutation({
        mutationFn: (id: string) => leadsApi.markContacted(id),
        onSuccess: () => {
            invalidate();
            toast('Prospect marqué comme contacté');
        },
        onError: () => toast('Erreur', 'error'),
    });

    const confirmPickupMutation = useMutation({
        mutationFn: ({ id, date }: { id: string; date: string }) => leadsApi.confirmPickup(id, date),
        onSuccess: () => {
            invalidate();
            toast('Collecte confirmée');
        },
        onError: () => toast('Erreur', 'error'),
    });

    const [isConverting, setIsConverting] = useState(false);
    const [convertStep, setConvertStep] = useState(0);

    const convertMutation = useMutation({
        mutationFn: (id: string) => leadsApi.convert(id),
        onSuccess: (data) => {
            invalidate();
            // Step 2: Client created
            setConvertStep(2);
            setTimeout(() => {
                // Step 3: Preparing order
                setConvertStep(3);
                setTimeout(() => {
                    // Step 4: Redirecting
                    setConvertStep(4);
                    setTimeout(() => {
                        setIsConverting(false);
                        const params = new URLSearchParams();
                        params.set('fromLead', leadId);
                        if (lead) {
                            params.set('clientId', data.clientId);
                            params.set('packChoice', lead.packChoice);
                            if (lead.zone) params.set('zone', lead.zone);
                            if (lead.additionalPickups) params.set('addOnPickups', String(lead.additionalPickups));
                            if (lead.preferredPickupDate) params.set('pickupDate', lead.preferredPickupDate.slice(0, 10));
                        }
                        router.push(`/apps/orders/add?${params.toString()}`);
                    }, 800);
                }, 800);
            }, 800);
        },
        onError: (err: any) => {
            setIsConverting(false);
            setConvertStep(0);
            toast(err?.response?.data?.message || 'Erreur lors de la conversion', 'error');
        },
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => leadsApi.cancel(id, reason),
        onSuccess: () => {
            invalidate();
            toast('Prospect annulé');
        },
        onError: () => toast('Erreur', 'error'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => leadsApi.update(id, data),
        onSuccess: () => {
            invalidate();
            setEditingNotes(false);
            setEditingInfo(false);
            toast('Mis à jour avec succès');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message;
            toast(Array.isArray(msg) ? msg.join(', ') : msg || 'Erreur lors de la mise à jour', 'error');
        },
    });

    const handleSaveInfo = () => {
        if (!lead) return;
        const validPhones = editForm.phones
            .filter((p) => p.number.trim())
            .map((p) => ({
                number: p.number.trim(),
                type: p.type || 'whatsapp',
            }));

        const data: Partial<Lead> = {
            name: editForm.name,
            address: editForm.address,
        };
        if (validPhones.length > 0) data.phones = validPhones;
        if (editForm.zone) data.zone = editForm.zone;
        if (editForm.packChoice) data.packChoice = editForm.packChoice as Lead['packChoice'];
        if (editForm.packChoice !== 'a_la_carte' && editForm.additionalPickups != null) {
            data.additionalPickups = Number(editForm.additionalPickups);
        }
        if (editForm.preferredPickupDate) data.preferredPickupDate = editForm.preferredPickupDate;
        if (editForm.birthday) data.birthday = editForm.birthday;

        updateMutation.mutate({ id: lead._id, data });
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!lead) return;
        if (newStatus === 'contacted') {
            markContactedMutation.mutate(lead._id);
        } else if (newStatus === 'confirmed') {
            await handleConfirmPickup();
        } else if (newStatus === 'converted') {
            setIsConverting(true);
            setConvertStep(1);
            convertMutation.mutate(lead._id);
        } else if (newStatus === 'cancelled') {
            await handleCancel();
        }
    };

    const deleteMutation = useMutation({
        mutationFn: (id: string) => leadsApi.delete(id),
        onSuccess: () => {
            toast('Prospect supprimé');
            router.push('/apps/leads');
        },
        onError: () => toast('Erreur', 'error'),
    });

    /* ── Action handlers ───────── */
    const handleConfirmPickup = async () => {
        if (!lead) return;
        const { value: date } = await Swal.fire({
            title: 'Confirmer la collecte',
            input: 'date',
            inputLabel: 'Date de collecte',
            inputValue: lead.preferredPickupDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            showCancelButton: true,
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
        });
        if (date) confirmPickupMutation.mutate({ id: lead._id, date });
    };

    const handleCancel = async () => {
        if (!lead) return;
        const { value: reason } = await Swal.fire({
            title: 'Annuler ce prospect',
            input: 'text',
            inputLabel: 'Raison (optionnel)',
            showCancelButton: true,
            confirmButtonText: 'Annuler le prospect',
            confirmButtonColor: '#dc3545',
            cancelButtonText: 'Retour',
        });
        if (reason !== undefined) cancelMutation.mutate({ id: lead._id, reason });
    };

    const handleDelete = async () => {
        if (!lead) return;
        const r = await Swal.fire({
            title: 'Supprimer ce prospect ?',
            text: 'Cette action est irréversible.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        });
        if (r.isConfirmed) deleteMutation.mutate(lead._id);
    };

    /* ── Loading / Error ───────── */
    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-slate-400">Chargement…</p>
                </div>
            </div>
        );
    }

    if (error || !lead) {
        return (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-red-100 bg-red-50/50 p-8 text-center">
                <p className="text-lg font-medium text-red-600">Prospect introuvable</p>
                <button onClick={() => router.push('/apps/leads')} className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white">
                    Retour aux prospects
                </button>
            </div>
        );
    }

    /* ── Computed ───────────────── */
    const pack = PACK_LABELS[lead.packChoice];
    const status = STATUS_LABELS[lead.status];
    const source = sourceBadgeMap[lead.source] || { variant: 'slate' as BadgeVariant, label: lead.source };
    const addOn = lead.additionalPickups && lead.additionalPickups > 0 ? ADD_ONS[lead.additionalPickups] : null;
    const isTerminal = lead.status === 'converted' || lead.status === 'cancelled';

    /* ── Status steps ──────────── */
    const steps = [
        { key: 'new', label: 'Nouveau', date: lead.createdAt, icon: 'new' as const },
        { key: 'contacted', label: 'Contacté', date: lead.contactedAt, icon: 'contacted' as const },
        { key: 'confirmed', label: 'Confirmé', date: lead.confirmedAt, icon: 'confirmed' as const },
        { key: 'converted', label: 'Converti', date: lead.convertedAt, icon: 'converted' as const },
    ];
    const currentStepIdx = steps.findIndex((s) => s.key === lead.status);

    /* ── Render ─────────────────── */
    return (
        <div className="space-y-6">
            {/* ── Conversion Progress Overlay ── */}
            {isConverting && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-[#0e1726]/80">
                    <div className="w-full max-w-md px-6">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-2xl dark:border-slate-700 dark:bg-[#1a2234]">
                            {/* Animated icon */}
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                <div className={`transition-transform duration-500 ${convertStep >= 2 ? 'scale-110' : 'scale-100'}`}>
                                    {convertStep < 4 ? (
                                        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                                    ) : (
                                        <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            <h3 className="mb-2 text-center text-lg font-bold text-slate-800 dark:text-white">{convertStep >= 4 ? 'Conversion terminée !' : 'Conversion en cours...'}</h3>
                            <p className="mb-6 text-center text-sm text-slate-500">{convertStep >= 4 ? 'Redirection vers la création de commande' : 'Veuillez patienter...'}</p>

                            {/* Steps */}
                            <div className="space-y-3">
                                {[
                                    { step: 1, label: 'Validation du prospect' },
                                    { step: 2, label: 'Création du client' },
                                    { step: 3, label: 'Préparation de la commande' },
                                    { step: 4, label: 'Redirection...' },
                                ].map((s) => (
                                    <div key={s.step} className="flex items-center gap-3">
                                        <div
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                                                convertStep > s.step
                                                    ? 'bg-primary text-white'
                                                    : convertStep === s.step
                                                    ? 'border-2 border-primary bg-primary/10 text-primary'
                                                    : 'border border-slate-200 text-slate-300 dark:border-slate-600'
                                            }`}
                                        >
                                            {convertStep > s.step ? (
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <span className="text-xs font-bold">{s.step}</span>
                                            )}
                                        </div>
                                        <span className={`text-sm font-medium transition-colors duration-300 ${convertStep >= s.step ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                            {s.label}
                                        </span>
                                        {convertStep === s.step && s.step < 4 && <div className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                                    </div>
                                ))}
                            </div>

                            {/* Progress bar */}
                            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                <div className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700 ease-out" style={{ width: `${(convertStep / 4) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Header ─────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/apps/leads')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                            <IconArrowBackward className="h-4 w-4" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-800 dark:text-white">{lead.name}</h1>
                                <Badge variant={statusBadgeMap[lead.status] || 'slate'}>{status?.label || lead.status}</Badge>
                            </div>
                            <p className="mt-0.5 text-sm text-slate-400">
                                <span className="font-mono">{lead.leadId}</span> · Créé le {formatDate(lead.createdAt)}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {lead.status === 'new' && (
                            <button
                                onClick={() => markContactedMutation.mutate(lead._id)}
                                disabled={markContactedMutation.isPending}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 text-sm font-medium text-yellow-700 transition hover:bg-yellow-100 disabled:opacity-50"
                            >
                                <IconPhoneCall className="h-4 w-4" />
                                Marquer contacté
                            </button>
                        )}
                        {lead.status === 'contacted' && (
                            <button
                                onClick={handleConfirmPickup}
                                disabled={confirmPickupMutation.isPending}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                            >
                                <IconSquareCheck className="h-4 w-4" />
                                Confirmer collecte
                            </button>
                        )}
                        {lead.status === 'confirmed' && (
                            <button
                                onClick={() => {
                                    setIsConverting(true);
                                    setConvertStep(1);
                                    convertMutation.mutate(lead._id);
                                }}
                                disabled={convertMutation.isPending || isConverting}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                            >
                                <IconUserPlus className="h-4 w-4" />
                                Convertir en client
                            </button>
                        )}
                        {!isTerminal && (
                            <button
                                onClick={handleCancel}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 transition hover:bg-red-100"
                            >
                                <IconX className="h-4 w-4" />
                                Annuler
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-500 dark:border-slate-600"
                        >
                            <IconTrashLines className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Status Timeline ────── */}
            {lead.status !== 'cancelled' && (
                <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                    <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Progression</h3>
                    <div className="flex items-center">
                        {steps.map((step, idx) => {
                            const done = idx <= currentStepIdx;
                            const isCurrent = idx === currentStepIdx;
                            return (
                                <React.Fragment key={step.key}>
                                    <div className="flex flex-col items-center gap-1">
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                                done
                                                    ? isCurrent
                                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                                        : 'bg-primary/10 text-primary'
                                                    : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
                                            }`}
                                        >
                                            {step.icon === 'new' && (
                                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                </svg>
                                            )}
                                            {step.icon === 'contacted' && <IconPhoneCall className="h-4.5 w-4.5" />}
                                            {step.icon === 'confirmed' && <IconSquareCheck className="h-4.5 w-4.5" />}
                                            {step.icon === 'converted' && <IconUserPlus className="h-4.5 w-4.5" />}
                                        </div>
                                        <p className={`text-xs font-medium ${done ? 'text-primary' : 'text-slate-400'}`}>{step.label}</p>
                                        {step.date && <p className="text-[10px] text-slate-400">{formatShortDate(step.date)}</p>}
                                    </div>
                                    {idx < steps.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${idx < currentStepIdx ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Content Grid ─────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* ── Left: Details ─── */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Contact Info */}
                    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                <IconUser className="h-4 w-4 text-slate-400" />
                                Informations contact
                            </h3>
                            {!editingInfo && !isTerminal && (
                                <button onClick={() => setEditingInfo(true)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                                    <IconEdit className="h-3.5 w-3.5" />
                                    Modifier
                                </button>
                            )}
                        </div>
                        {editingInfo ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500">Nom complet</label>
                                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="form-input w-full rounded-lg" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500">Téléphone(s)</label>
                                    {editForm.phones.map((phone, i) => (
                                        <div key={i} className="mb-1.5 flex gap-2">
                                            <input
                                                type="tel"
                                                value={phone.number}
                                                onChange={(e) => {
                                                    const p = [...editForm.phones];
                                                    p[i] = { ...p[i], number: e.target.value };
                                                    setEditForm({ ...editForm, phones: p });
                                                }}
                                                className="form-input flex-1 rounded-lg"
                                                placeholder="+225 XX XX XX XX"
                                            />
                                            <select
                                                value={phone.type}
                                                onChange={(e) => {
                                                    const p = [...editForm.phones];
                                                    p[i] = { ...p[i], type: e.target.value };
                                                    setEditForm({ ...editForm, phones: p });
                                                }}
                                                className="form-select w-[130px] rounded-lg"
                                            >
                                                <option value="whatsapp">WhatsApp</option>
                                                <option value="call">Appel</option>
                                                <option value="both">Les deux</option>
                                            </select>
                                            {editForm.phones.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditForm({
                                                            ...editForm,
                                                            phones: editForm.phones.filter((_, j) => j !== i),
                                                        })
                                                    }
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <IconX className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setEditForm({
                                                ...editForm,
                                                phones: [...editForm.phones, { number: '', type: 'whatsapp' }],
                                            })
                                        }
                                        className="text-xs font-medium text-primary"
                                    >
                                        + Ajouter
                                    </button>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500">Adresse</label>
                                    <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="form-input w-full rounded-lg" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Zone</label>
                                        <select value={editForm.zone} onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })} className="form-select w-full rounded-lg">
                                            <option value="">— Aucune —</option>
                                            {zones.map((z) => (
                                                <option key={z._id} value={z.name}>
                                                    {z.displayName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Anniversaire</label>
                                        <input
                                            type="text"
                                            value={editForm.birthday}
                                            onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                                            className="form-input w-full rounded-lg"
                                            placeholder="dd/mm"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSaveInfo}
                                        disabled={updateMutation.isPending}
                                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        Enregistrer
                                    </button>
                                    <button onClick={() => setEditingInfo(false)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <InfoRow label="Nom">{lead.name}</InfoRow>
                                <InfoRow label="Téléphone(s)">
                                    <div className="space-y-1">
                                        {lead.phones.map((p, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <IconPhone className="h-3 w-3 text-slate-400" />
                                                <span>{p.number}</span>
                                                <Badge variant={p.type === 'whatsapp' ? 'green' : p.type === 'both' ? 'indigo' : 'slate'} className="text-[10px]">
                                                    {p.type === 'whatsapp' ? 'WA' : p.type === 'both' ? 'WA+Appel' : 'Appel'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </InfoRow>
                                <InfoRow label="Adresse">
                                    <div className="flex items-center gap-1.5">
                                        <IconMapPin className="h-3 w-3 text-slate-400" />
                                        {lead.address}
                                    </div>
                                </InfoRow>
                                {lead.zone && <InfoRow label="Zone">{lead.zone}</InfoRow>}
                                {lead.birthday && <InfoRow label="Anniversaire">{lead.birthday}</InfoRow>}
                            </>
                        )}
                    </div>

                    {/* Pack & Subscription */}
                    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                <IconShoppingBag className="h-4 w-4 text-slate-400" />
                                Pack & Abonnement
                            </h3>
                            {!editingInfo && !isTerminal && (
                                <button onClick={() => setEditingInfo(true)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                                    <IconEdit className="h-3.5 w-3.5" />
                                    Modifier
                                </button>
                            )}
                        </div>
                        {editingInfo ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Pack</label>
                                        <select
                                            value={editForm.packChoice}
                                            onChange={(e) =>
                                                setEditForm({
                                                    ...editForm,
                                                    packChoice: e.target.value,
                                                    additionalPickups: 0,
                                                })
                                            }
                                            className="form-select w-full rounded-lg"
                                        >
                                            <option value="douceur">Pack Douceur – 15 000 F</option>
                                            <option value="eclat">Pack Éclat – 20 000 F</option>
                                            <option value="prestige">Pack Prestige – 38 000 F</option>
                                            <option value="a_la_carte">À la carte</option>
                                        </select>
                                    </div>
                                    {editForm.packChoice !== 'a_la_carte' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-500">Collectes supp.</label>
                                            <select
                                                value={editForm.additionalPickups}
                                                onChange={(e) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        additionalPickups: Number(e.target.value),
                                                    })
                                                }
                                                className="form-select w-full rounded-lg"
                                            >
                                                {ADD_ONS.map((opt, idx) => (
                                                    <option key={idx} value={idx}>
                                                        {idx === 0 ? 'Aucune' : `+${opt.pickups} (+${opt.price.toLocaleString()} F)`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-500">Date collecte souhaitée</label>
                                    <input
                                        type="date"
                                        value={editForm.preferredPickupDate}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                preferredPickupDate: e.target.value,
                                            })
                                        }
                                        className="form-input w-full rounded-lg"
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <InfoRow label="Pack choisi">
                                    <Badge variant={packBadgeMap[lead.packChoice] || 'slate'}>{pack?.label || lead.packChoice}</Badge>
                                </InfoRow>
                                {pack && <InfoRow label="Prix pack">{pack.price}</InfoRow>}
                                {addOn && (
                                    <>
                                        <InfoRow label="Collectes supplémentaires">
                                            <span className="text-indigo-600">
                                                +{addOn.pickups} collecte{addOn.pickups > 1 ? 's' : ''}
                                            </span>
                                        </InfoRow>
                                        <InfoRow label="Articles supplémentaires">
                                            <span className="text-indigo-600">+{addOn.extraItems} articles</span>
                                        </InfoRow>
                                        <InfoRow label="Add-on">
                                            <span className="font-bold text-indigo-600">+{addOn.price.toLocaleString()} FCFA</span>
                                        </InfoRow>
                                    </>
                                )}
                                {lead.preferredPickupDate && <InfoRow label="Date collecte souhaitée">{formatShortDate(lead.preferredPickupDate)}</InfoRow>}
                            </>
                        )}
                    </div>

                    {/* Expected Operations */}
                    {lead.preferredPickupDate && lead.status !== 'cancelled' && (
                        <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Planning prévisionnel
                            </h3>
                            {(() => {
                                const startDate = new Date(lead.preferredPickupDate!);
                                const packInfo = PACK_LABELS[lead.packChoice];
                                const pickups = packInfo ? packInfo.pickups + (lead.additionalPickups || 0) : lead.packChoice === 'a_la_carte' ? 1 : 2;
                                const validity = packInfo?.validity || 30;
                                const intervalDays = Math.floor(validity / pickups);
                                const deliveryDays = 7; // ~7 days processing time for delivery
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const operations = Array.from({ length: pickups }, (_, i) => {
                                    const pickupDate = new Date(startDate);
                                    pickupDate.setDate(startDate.getDate() + i * intervalDays);
                                    const deliveryDate = new Date(pickupDate);
                                    deliveryDate.setDate(pickupDate.getDate() + deliveryDays);
                                    const isPast = pickupDate < today;
                                    const isUpcoming = !isPast && pickupDate.getTime() - today.getTime() <= 3 * 24 * 60 * 60 * 1000;
                                    return { index: i + 1, pickupDate, deliveryDate, isPast, isUpcoming };
                                });

                                return (
                                    <div className="space-y-2">
                                        {operations.map((op) => (
                                            <div
                                                key={op.index}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                                                    op.isUpcoming
                                                        ? 'border-primary/30 bg-primary/5'
                                                        : op.isPast
                                                        ? 'border-slate-100 bg-slate-50/50 opacity-60 dark:border-slate-700/30 dark:bg-slate-800/20'
                                                        : 'border-slate-100 dark:border-slate-700/30'
                                                }`}
                                            >
                                                <div
                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                                        op.isUpcoming
                                                            ? 'bg-primary text-white'
                                                            : op.isPast
                                                            ? 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                                                    }`}
                                                >
                                                    {op.index}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className={`font-semibold ${op.isUpcoming ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {formatShortDate(op.pickupDate.toISOString())}
                                                        </span>
                                                        <span className="text-slate-300 dark:text-slate-600">→</span>
                                                        <span className="text-slate-500 dark:text-slate-400">{formatShortDate(op.deliveryDate.toISOString())}</span>
                                                    </div>
                                                </div>
                                                {op.isUpcoming && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Prochaine</span>}
                                                {op.isPast && <span className="shrink-0 text-[10px] text-slate-400">Passée</span>}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                            <p className="mt-3 text-[10px] text-slate-400">
                                * Planning estimé basé sur la date de collecte souhaitée. Les dates réelles seront définies lors de la création de la commande.
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                <IconNotesEdit className="h-4 w-4 text-slate-400" />
                                Notes
                            </h3>
                            {!editingNotes && (
                                <button
                                    onClick={() => {
                                        setNotesText(lead.notes || '');
                                        setEditingNotes(true);
                                    }}
                                    className="text-xs font-medium text-primary hover:text-primary/80"
                                >
                                    Modifier
                                </button>
                            )}
                        </div>
                        {editingNotes ? (
                            <div>
                                <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} className="form-textarea w-full rounded-lg" rows={4} placeholder="Ajoutez des notes…" />
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() => updateMutation.mutate({ id: lead._id, data: { notes: notesText } })}
                                        disabled={updateMutation.isPending}
                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        Enregistrer
                                    </button>
                                    <button
                                        onClick={() => setEditingNotes(false)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{lead.notes || <span className="italic text-slate-400">Aucune note</span>}</p>
                        )}
                    </div>
                </div>

                {/* ── Right: Sidebar ── */}
                <div className="space-y-6">
                    {/* Quick Info */}
                    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <IconInfoCircle className="h-4 w-4 text-slate-400" />
                            Informations rapides
                        </h3>
                        <InfoRow label="Statut">
                            {!isTerminal ? (
                                <select
                                    value={lead.status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    className="form-select rounded-lg py-1 text-xs font-medium"
                                    disabled={markContactedMutation.isPending || confirmPickupMutation.isPending || convertMutation.isPending || cancelMutation.isPending}
                                >
                                    <option value="new">Nouveau</option>
                                    <option value="contacted">Contacté</option>
                                    <option value="confirmed">Confirmé</option>
                                    <option value="converted">Convertir en client</option>
                                    <option value="cancelled">Annulé</option>
                                </select>
                            ) : (
                                <Badge variant={statusBadgeMap[lead.status] || 'slate'}>{status?.label || lead.status}</Badge>
                            )}
                        </InfoRow>
                        <InfoRow label="Source">
                            <Badge variant={source.variant}>{source.label}</Badge>
                        </InfoRow>
                        {lead.sharedBy && (
                            <InfoRow label="Partagé par">
                                <div className="flex items-center gap-1.5">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                                        {lead.sharedBy.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    {lead.sharedBy.name}
                                </div>
                            </InfoRow>
                        )}
                        <InfoRow label="Créé le">{formatDate(lead.createdAt)}</InfoRow>
                        <InfoRow label="Modifié le">{formatDate(lead.updatedAt)}</InfoRow>
                    </div>

                    {/* Dates Timeline */}
                    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Historique
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Créé</p>
                                    <p className="text-xs text-slate-400">{formatDate(lead.createdAt)}</p>
                                </div>
                            </div>
                            {lead.contactedAt && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                                        <IconPhoneCall className="h-3 w-3" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Contacté</p>
                                        <p className="text-xs text-slate-400">{formatDate(lead.contactedAt)}</p>
                                    </div>
                                </div>
                            )}
                            {lead.confirmedAt && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                        <IconSquareCheck className="h-3 w-3" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Collecte confirmée</p>
                                        <p className="text-xs text-slate-400">{formatDate(lead.confirmedAt)}</p>
                                    </div>
                                </div>
                            )}
                            {lead.convertedAt && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                                        <IconUserPlus className="h-3 w-3" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Converti en client</p>
                                        <p className="text-xs text-slate-400">{formatDate(lead.convertedAt)}</p>
                                        {lead.convertedClientId && (
                                            <p className="mt-0.5 text-xs font-medium text-primary">
                                                Client: {typeof lead.convertedClientId === 'string' ? lead.convertedClientId : (lead.convertedClientId as any)?.customerId || lead.convertedClientId}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Converted info */}
                    {lead.status === 'converted' && lead.convertedClientId && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                                <IconUserPlus className="h-4 w-4" />
                                Client créé
                            </h3>
                            <p className="text-sm text-indigo-600 dark:text-indigo-300">Ce prospect a été converti en client.</p>
                            <button
                                onClick={() => router.push('/management/clients')}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
                            >
                                Voir les clients →
                            </button>
                        </div>
                    )}

                    {/* Cancelled info */}
                    {lead.status === 'cancelled' && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 dark:border-red-500/20 dark:bg-red-500/5">
                            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                                <IconX className="h-4 w-4" />
                                Prospect annulé
                            </h3>
                            <p className="text-xs text-red-500">Ce prospect a été annulé et ne peut plus être modifié.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadDetail;
