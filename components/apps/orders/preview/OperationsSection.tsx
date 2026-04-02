'use client';
import React, { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import IconEdit from '@/components/icon/icon-edit';
import { Order, respondToOperation } from '@/lib/api/orders';
import { formatDate, getOperationStatusConfig, getPackLimits } from './utils';

interface PackUsageProps {
    order: Order;
    resolvePackName: (_code?: string) => string;
    packsData?: any[];
}

export const PackUsage = ({ order, resolvePackName, packsData }: PackUsageProps) => {
    if (order.type !== 'subscription' || !order.packName) return null;

    const limits = getPackLimits(order.packName, packsData);
    const totalUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesCount || 0), 0) || 0;
    const couettesUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0), 0) || 0;
    const vestesUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0), 0) || 0;
    // Support both old combined "Draps & Serviettes" and new separate "Draps" / "Serviettes"
    const drapsUsed =
        order.pickupSchedule?.reduce((sum, p) => {
            const combined = p.clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
            const drapsSep = p.clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
            const serviettesSep = p.clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
            return sum + combined + drapsSep + serviettesSep;
        }, 0) || 0;
    const ordinairesUsed = totalUsed - couettesUsed - vestesUsed - drapsUsed;

    const items = [
        { label: 'Total', used: totalUsed, limit: limits.total, color: 'bg-primary' },
        { label: 'Ordinaires', used: Math.max(0, ordinairesUsed), limit: limits.ordinaires, color: 'bg-slate-500' },
        { label: 'Couettes', used: couettesUsed, limit: limits.couettes, color: 'bg-indigo-500' },
        { label: 'Vestes', used: vestesUsed, limit: limits.vestes, color: 'bg-cyan-500' },
        { label: 'Draps & Serv.', used: drapsUsed, limit: limits.draps_serviettes, color: 'bg-amber-500' },
    ];

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="text-sm font-bold text-slate-800 dark:text-white">Utilisation du Pack — {resolvePackName(order.packName)}</h5>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {items.map((item) => {
                    const pct = item.limit > 0 ? Math.round((item.used / item.limit) * 100) : 0;
                    const remaining = item.limit - item.used;
                    return (
                        <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-700/30 dark:bg-slate-800/30">
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                                <span className={`text-[10px] font-bold ${remaining < 0 ? 'text-red-500' : remaining === 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                                    {remaining < 0 ? 'Dépassé' : remaining === 0 ? 'Complet' : `${pct}%`}
                                </span>
                            </div>
                            <p className="mb-2 text-xl font-bold text-slate-800 dark:text-white">
                                {item.used} <span className="text-sm font-normal text-slate-400">/ {item.limit}</span>
                            </p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : remaining < item.limit * 0.2 ? 'bg-amber-500' : item.color}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ─── Client Feedback Inline Component ──────────────────────────── */
interface ClientFeedbackInlineProps {
    orderId: string;
    operationType: 'pickup' | 'delivery';
    operationIndex: number;
    clientRating?: number;
    clientComment?: string;
    adminResponse?: string;
}

const ClientFeedbackInline = ({ orderId, operationType, operationIndex, clientRating, clientComment, adminResponse }: ClientFeedbackInlineProps) => {
    const queryClient = useQueryClient();
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState(adminResponse || '');

    const replyMutation = useMutation({
        mutationFn: () => respondToOperation(orderId, operationType, operationIndex, replyText),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['order'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setShowReplyInput(false);
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Réponse enregistrée' });
        },
        onError: () => {
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000 }).fire({ icon: 'error', title: 'Erreur lors de l\'enregistrement' });
        },
    });

    if (!clientRating && !clientComment) return null;

    return (
        <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 dark:border-amber-900/30 dark:bg-amber-900/10">
            {/* Client rating */}
            {clientRating && (
                <div className="flex items-center gap-2">
                    <span className="text-sm">{'⭐'.repeat(clientRating)}</span>
                    <span className="text-[10px] text-slate-400">({clientRating}/5)</span>
                </div>
            )}
            {/* Client comment */}
            {clientComment && (
                <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300">« {clientComment} »</p>
            )}
            {/* Admin response */}
            {adminResponse && !showReplyInput && (
                <div className="mt-2 rounded-md border-l-2 border-primary bg-primary/5 p-2">
                    <p className="text-[10px] font-semibold text-primary">Réponse MIRAI :</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{adminResponse}</p>
                    <button
                        type="button"
                        onClick={() => { setShowReplyInput(true); setReplyText(adminResponse); }}
                        className="mt-1 text-[10px] font-medium text-primary hover:underline"
                    >
                        Modifier
                    </button>
                </div>
            )}
            {/* Reply input */}
            {showReplyInput ? (
                <div className="mt-2 space-y-2">
                    <textarea
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                        rows={2}
                        placeholder="Répondre au client..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => replyMutation.mutate()}
                            disabled={!replyText.trim() || replyMutation.isPending}
                            className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {replyMutation.isPending ? '...' : 'Envoyer'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowReplyInput(false); setReplyText(adminResponse || ''); }}
                            className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-600"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            ) : !adminResponse && (
                <button
                    type="button"
                    onClick={() => setShowReplyInput(true)}
                    className="mt-2 text-[10px] font-medium text-primary hover:underline"
                >
                    💬 Répondre au client
                </button>
            )}
        </div>
    );
};

/* ─── Operations Table ──────────────────────────────────────────── */

interface OperationsTableProps {
    order: Order;
    editingOperation: { type: 'pickup' | 'delivery'; index: number } | null;
    editDate: string;
    setEditDate: (_val: string) => void;
    setEditingOperation: (_val: { type: 'pickup' | 'delivery'; index: number } | null) => void;
    handleEditOperationDate: (_type: 'pickup' | 'delivery', _index: number, _currentDate: string) => void;
    handleSaveOperationDate: () => void;
    handleOpenOperationStatusModal: (_type: 'pickup' | 'delivery', _index: number, _currentStatus?: string) => void;
    handleOpenClothesModal?: (_type: 'pickup' | 'delivery', _index: number) => void;
    onDeleteRegistration?: (_operationIndex: number) => void;
}

const STATUS_DOT: Record<string, string> = {
    secondary: 'bg-slate-400',
    info: 'bg-sky-500',
    primary: 'bg-indigo-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
};

/** Step labels for the unified flow progress bar */
const FLOW_STEPS = [
    { key: 'pending', label: 'Attente' },
    { key: 'registered', label: 'Enregistré' },
    { key: 'processing', label: 'Traitement' },
    { key: 'ready_for_delivery', label: 'Prêt' },
    { key: 'out_for_delivery', label: 'En livraison' },
    { key: 'delivered', label: 'Livré' },
];

export const OperationsTable = ({
    order,
    editingOperation,
    editDate,
    setEditDate,
    setEditingOperation,
    handleEditOperationDate,
    handleSaveOperationDate,
    handleOpenOperationStatusModal,
    handleOpenClothesModal: _handleOpenClothesModal,
    onDeleteRegistration,
}: OperationsTableProps) => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // Build full path including query params so returnTo navigates back correctly
    const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    if (order.type !== 'subscription' || !order.pickupSchedule || order.pickupSchedule.length === 0) return null;

    const isActive = order.subscriptionStatus === 'active';

    /* ── Inline date editor ── */
    const DateCell = ({ type, index, date }: { type: 'pickup' | 'delivery'; index: number; date: string }) => {
        const isEditing = editingOperation?.type === type && editingOperation?.index === index;
        if (isEditing) {
            return (
                <div className="flex items-center gap-1.5">
                    <input
                        type="date"
                        className="w-32 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                    />
                    <button className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white" onClick={handleSaveOperationDate}>
                        OK
                    </button>
                    <button
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-slate-600"
                        onClick={() => {
                            setEditingOperation(null);
                            setEditDate('');
                        }}
                    >
                        Annuler
                    </button>
                </div>
            );
        }
        return (
            <span className="group/date inline-flex items-center gap-1.5">
                <span className="text-sm text-slate-700 dark:text-slate-200">{formatDate(date)}</span>
                {isActive && (
                    <button className="opacity-0 transition-opacity group-hover/date:opacity-100" onClick={() => handleEditOperationDate(type, index, date)}>
                        <IconEdit className="h-3 w-3 text-slate-400 hover:text-primary" />
                    </button>
                )}
            </span>
        );
    };

    /* ── Mini progress bar ── */
    const ProgressSteps = ({ status }: { status?: string }) => {
        const cfg = getOperationStatusConfig(status);
        const currentStep = cfg.step;
        const isTerminal = status === 'cancelled' || status === 'returned' || status === 'not_delivered';

        if (isTerminal) {
            const dot = STATUS_DOT[cfg.color] || 'bg-slate-400';
            return (
                <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{cfg.label}</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-0.5">
                {FLOW_STEPS.map((step, i) => {
                    const stepCfg = getOperationStatusConfig(step.key);
                    const isCompleted = currentStep > i;
                    const isCurrent = currentStep === i;
                    return (
                        <div key={step.key} className="flex items-center">
                            <div
                                className={`h-1.5 rounded-full transition-all ${i === 0 ? 'w-0' : 'w-4 sm:w-6'} ${
                                    isCompleted ? `${STATUS_DOT[stepCfg.color] || 'bg-slate-300'}` : 'bg-slate-100 dark:bg-slate-700'
                                }`}
                            />
                            <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold transition-all ${
                                    isCurrent
                                        ? `${STATUS_DOT[stepCfg.color] || 'bg-slate-400'} text-white ring-2 ring-offset-1 ring-${stepCfg.color === 'secondary' ? 'slate-300' : stepCfg.color}`
                                        : isCompleted
                                        ? `${STATUS_DOT[stepCfg.color] || 'bg-slate-400'} text-white`
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                                }`}
                                title={step.label}
                            >
                                {isCompleted ? '✓' : i + 1}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /* ── Clothes info ── */
    const registrationLink = (index: number) => `/apps/registrations/new?orderId=${order._id}&clientId=${order.customerId?._id || ''}&opIndex=${index}&returnTo=${encodeURIComponent(currentPath)}`;

    const ClothesInfo = ({ type: _type, index, count, details }: { type: 'pickup' | 'delivery'; index: number; count?: number; details?: any[] }) => {
        if (!count || count === 0) {
            return isActive ? (
                <div className="flex items-center gap-2">
                    <a href={registrationLink(index)} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        Enregistrer articles
                    </a>
                </div>
            ) : (
                <span className="text-[11px] text-slate-300">—</span>
            );
        }

        // Calculate special items total
        const specialItems = details?.filter((c: any) => ['Couettes', 'Vestes', 'Draps & Serviettes', 'Draps', 'Serviettes'].includes(c.name)) || [];
        const otherItems = details?.filter((c: any) => !['Couettes', 'Vestes', 'Draps & Serviettes', 'Draps', 'Serviettes'].includes(c.name)) || [];
        const specialTotal = specialItems.reduce((s: number, c: any) => s + c.quantity, 0);
        const ordinaires = Math.max(0, count - specialTotal);

        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                    <span className="text-[10px] text-slate-400">pièces</span>
                    {isActive && (
                        <>
                            <a href={registrationLink(index)} className="ml-1 text-[10px] font-medium text-primary hover:underline">
                                Modifier
                            </a>
                            {onDeleteRegistration && (
                                <button onClick={() => onDeleteRegistration(index)} className="text-[10px] font-medium text-danger hover:underline" title="Supprimer l'enregistrement">
                                    Supprimer
                                </button>
                            )}
                        </>
                    )}
                </div>
                {(specialItems.length > 0 || otherItems.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                        {ordinaires > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{ordinaires} vêt.</span>}
                        {specialItems.map((c: any) => (
                            <span key={c.name} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                                {c.quantity} {c.name}
                            </span>
                        ))}
                        {otherItems.map((c: any) => (
                            <span key={c.name} className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                {c.quantity} {c.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="text-sm font-bold text-slate-800 dark:text-white">Opérations</h5>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{order.pickupSchedule.length} op.</span>
            </div>

            {/* Operation Cards */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {order.pickupSchedule.map((pickup, index) => {
                    const delivery = order.deliverySchedule?.[index];
                    const opStatus = pickup.status || 'pending';
                    const cfg = getOperationStatusConfig(opStatus);
                    const dot = STATUS_DOT[cfg.color] || 'bg-slate-400';

                    // Get client feedback from pickup or delivery
                    const pAny = pickup as any;
                    const dAny = delivery as any;
                    const clientRating = pAny?.clientRating || dAny?.clientRating;
                    const clientComment = pAny?.clientComment || dAny?.clientComment;
                    const adminResponse = pAny?.adminResponse || dAny?.adminResponse;

                    return (
                        <div key={index} className="px-5 py-4">
                            {/* Row 1: Operation header + status badge */}
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opération {index + 1}</span>
                                    {/* Show feedback indicator in header */}
                                    {clientRating && <span className="text-sm">{'⭐'.repeat(Math.min(clientRating, 3))}{clientRating > 3 ? '...' : ''}</span>}
                                </div>
                                <button
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        isActive
                                            ? 'cursor-pointer border-slate-200 hover:border-primary hover:bg-primary/5 dark:border-slate-600 dark:hover:border-primary'
                                            : 'cursor-default border-slate-100 dark:border-slate-700'
                                    }`}
                                    onClick={() => isActive && handleOpenOperationStatusModal('pickup', index, opStatus)}
                                    disabled={!isActive}
                                >
                                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                                    {cfg.label}
                                </button>
                            </div>

                            {/* Row 2: Progress steps */}
                            <div className="mb-3">
                                <ProgressSteps status={opStatus} />
                            </div>

                            {/* Row 3: Details grid */}
                            <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700/30">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                    {/* Pickup date */}
                                    <div>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Récupération</span>
                                        <div className="mt-0.5">
                                            <DateCell type="pickup" index={index} date={pickup.date} />
                                        </div>
                                    </div>
                                    {/* Delivery date */}
                                    <div>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Livraison</span>
                                        <div className="mt-0.5">
                                            {delivery ? <DateCell type="delivery" index={index} date={delivery.date} /> : <span className="text-[11px] text-slate-300">—</span>}
                                        </div>
                                    </div>
                                    {/* Scheduled Time / Preferred Time */}
                                    <div>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Créneau</span>
                                        <div className="mt-0.5">
                                            {(pAny?.scheduledTime || pAny?.preferredTime) ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        🕐 {pAny?.scheduledTime || pAny?.preferredTime}
                                                    </span>
                                                    {pAny?.preferredTime && pAny?.scheduledTime !== pAny?.preferredTime && (
                                                        <span className="text-[10px] text-blue-500">Client: {pAny.preferredTime}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-300">—</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Clothes */}
                                    <div>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Vêtements</span>
                                        <div className="mt-0.5">
                                            <ClothesInfo type="pickup" index={index} count={pickup.clothesCount} details={pickup.clothesDetails} />
                                        </div>
                                    </div>
                                    {/* Agents */}
                                    <div>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Agents</span>
                                        <div className="mt-0.5 flex flex-col gap-0.5">
                                            {(pAny?.pickupAgent || dAny?.pickupAgent) ? (
                                                <span className="text-xs text-slate-700 dark:text-slate-200">
                                                    <span className="text-[10px] text-slate-400">Récup:</span> {pAny?.pickupAgent || dAny?.pickupAgent}
                                                </span>
                                            ) : null}
                                            {(pickup.deliveryAgent || delivery?.deliveryAgent) ? (
                                                <span className="text-xs text-slate-700 dark:text-slate-200">
                                                    <span className="text-[10px] text-slate-400">Livr:</span> {pickup.deliveryAgent || delivery?.deliveryAgent}
                                                </span>
                                            ) : null}
                                            {!(pAny?.pickupAgent || dAny?.pickupAgent || pickup.deliveryAgent || delivery?.deliveryAgent) && (
                                                <span className="text-[11px] text-slate-300">—</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Notes */}
                                {(pickup.note || delivery?.note) && (
                                    <div className="mt-2 border-t border-slate-50 pt-2 dark:border-slate-700/20">
                                        <p className="text-[11px] italic text-slate-400">{pickup.note || delivery?.note}</p>
                                    </div>
                                )}

                                {/* Client Feedback Inline */}
                                <ClientFeedbackInline
                                    orderId={order._id}
                                    operationType="pickup"
                                    operationIndex={index}
                                    clientRating={clientRating}
                                    clientComment={clientComment}
                                    adminResponse={adminResponse}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
