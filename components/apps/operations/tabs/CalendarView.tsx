'use client';
import React, { useCallback, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Operation, OperationStatus } from '../types';
import { formatDate, getStatusLabel, STATUS_CONFIG } from '../utils'; // ─── Types ──────────────────────────────────────────────────

// ─── Types ──────────────────────────────────────────────────
interface CalendarViewProps {
    calendarEvents: any[];
    calendarOrderType: 'all' | 'subscription' | 'a-la-carte';
    calendarOperationType: 'all' | 'pickup' | 'delivery';
    onOrderTypeChange: (_val: 'all' | 'subscription' | 'a-la-carte') => void;
    onOperationTypeChange: (_val: 'all' | 'pickup' | 'delivery') => void;
    onEventDrop: (_info: any) => void;
    onViewOrder: (_orderId: string) => void;
    onQuickAction?: (_op: any) => void;
    onReschedule?: (_data: { orderId: string; operationType: string; operationIndex: number; newDate: string; scheduledTime?: string }) => void;
}

// ─── Status color mapping (hex values for inline styles) ────
const STATUS_HEX: Record<string, { bg: string; border: string; text: string }> = {
    danger: { bg: '#fef2f2', border: '#e7515a', text: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#e2a03f', text: '#b45309' },
    info: { bg: '#eff6ff', border: '#2196f3', text: '#1d4ed8' },
    primary: { bg: '#eef2ff', border: '#4361ee', text: '#4338ca' },
    success: { bg: '#f0fdf4', border: '#00ab55', text: '#15803d' },
    secondary: { bg: '#f5f3ff', border: '#805dca', text: '#6d28d9' },
};

// ─── Custom Event Content ───────────────────────────────────
const renderEventContent = (eventInfo: any) => {
    const op: Operation = eventInfo.event.extendedProps;
    const colorKey = eventInfo.event.classNames?.[0] || 'primary';
    const colors = STATUS_HEX[colorKey] || STATUS_HEX.primary;
    const isOverdue = op.isOverdue;
    const isLead = op.isLead;
    const isWeekOrDay = eventInfo.view?.type?.includes('timeGrid');

    if (isWeekOrDay) {
        // Detailed rendering for Week/Day views
        return (
            <div
                className="flex h-full flex-col overflow-hidden rounded px-1.5 py-1"
                style={{
                    backgroundColor: isLead ? '#f5f3ff' : isOverdue ? '#fef2f2' : colors.bg,
                    borderLeft: `3px solid ${isLead ? '#805dca' : isOverdue ? '#e7515a' : colors.border}`,
                    color: isLead ? '#6d28d9' : isOverdue ? '#dc2626' : colors.text,
                }}
            >
                <div className="flex items-center gap-1">
                    <span className="text-[10px]">{isLead ? '⭐' : op.operationType === 'pickup' ? '📦' : '🚚'}</span>
                    <span className="truncate text-[10px] font-bold">{op.customer.name}</span>
                </div>
                {isLead && <span className="truncate text-[8px] opacity-70">Prospect confirmé</span>}
                {!isLead && op.city && <span className="truncate text-[8px] opacity-70">{op.city}</span>}
                {!isLead && op.clothesCount != null && op.clothesCount > 0 && <span className="text-[8px] opacity-60">{op.clothesCount} art.</span>}
            </div>
        );
    }

    // Compact rendering for Month view
    return (
        <div
            className="flex items-center gap-1 overflow-hidden rounded px-1.5 py-0.5"
            style={{
                backgroundColor: isLead ? '#805dca' : isOverdue ? '#e7515a' : colors.border,
                color: '#fff',
            }}
        >
            <span className="text-[9px] leading-none">{isLead ? '⭐' : op.operationType === 'pickup' ? '↓' : '↑'}</span>
            <span className="truncate text-[10px] font-semibold leading-tight">{op.customer.name}</span>
            {!isLead && op.clothesCount != null && op.clothesCount > 0 && <span className="ml-auto text-[8px] opacity-75">{op.clothesCount}</span>}
        </div>
    );
};

// ─── Tooltip (appears ABOVE the hovered event) ──────────────
const EventTooltip = ({ event, position }: { event: any; position: { x: number; y: number; elHeight: number } }) => {
    const op: Operation = event.extendedProps;
    const _statusCfg = STATUS_CONFIG[op.status as OperationStatus] || { label: op.status, dotClass: 'bg-slate-400' };
    const colorKey = event.classNames?.[0] || 'primary';
    const colors = STATUS_HEX[colorKey] || STATUS_HEX.primary;

    // Position ABOVE the event element, not below
    const tooltipH = 180;
    const spaceAbove = position.y - position.elHeight;
    const showAbove = spaceAbove > tooltipH + 8;
    const top = showAbove ? position.y - position.elHeight - tooltipH - 4 : position.y + 8;
    const left = Math.min(Math.max(position.x - 120, 8), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260);

    return (
        <div
            className="pointer-events-none fixed z-[9999] w-60 overflow-hidden rounded-xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1a2234]"
            style={{ left, top, borderColor: colors.border + '40' }}
        >
            {/* Color strip */}
            <div className="h-1" style={{ backgroundColor: colors.border }} />
            <div className="p-3">
                {/* Header */}
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm">{op.operationType === 'pickup' ? '📦' : '🚚'}</span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-800 dark:text-white">{op.customer.name}</div>
                        <div className="text-[10px] text-slate-400">{op.isSubscription ? 'Abonnement' : 'À la carte'}</div>
                    </div>
                </div>

                {/* Details grid */}
                <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Statut</span>
                        <span className="flex items-center gap-1 font-semibold" style={{ color: op.isOverdue ? '#dc2626' : colors.text }}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: op.isOverdue ? '#e7515a' : colors.border }} />
                            {op.isOverdue ? 'En retard' : getStatusLabel(op.status)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">N° Commande</span>
                        <span className="font-mono text-[9px] font-medium text-slate-600 dark:text-slate-300">{op.orderId.slice(-12)}</span>
                    </div>
                    {op.scheduledTime && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">Heure</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{op.scheduledTime}</span>
                        </div>
                    )}
                    {op.city && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">Ville</span>
                            <span className="text-slate-600 dark:text-slate-300">{op.city}</span>
                        </div>
                    )}
                    {op.clothesCount != null && op.clothesCount > 0 && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">Articles</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{op.clothesCount} pièce(s)</span>
                        </div>
                    )}
                    {(op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent) && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">Agent</span>
                            <span className="text-slate-600 dark:text-slate-300">{op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-2 border-t border-slate-100 pt-1.5 text-center text-[9px] font-medium text-primary dark:border-slate-700">Cliquer pour détails</div>
            </div>
        </div>
    );
};

// ─── Side Drawer ────────────────────────────────────────────
const OperationDrawer = ({
    operation,
    onClose,
    onViewOrder,
    onQuickAction: _onQuickAction,
    onReschedule,
}: {
    operation: Operation | null;
    onClose: () => void;
    onViewOrder: (_id: string) => void;
    onQuickAction?: (_op: any) => void;
    onReschedule?: (_data: { orderId: string; operationType: string; operationIndex: number; newDate: string; scheduledTime?: string }) => void;
}) => {
    const [showReschedule, setShowReschedule] = React.useState(false);
    const [rescheduleDate, setRescheduleDate] = React.useState('');
    const [rescheduleTime, setRescheduleTime] = React.useState('');

    // Reset reschedule form when operation changes
    React.useEffect(() => {
        if (operation) {
            setShowReschedule(false);
            setRescheduleDate(operation.date?.split('T')[0] || '');
            setRescheduleTime(operation.scheduledTime || '');
        }
    }, [operation]);

    if (!operation) return null;
    const op = operation;
    const statusCfg = STATUS_CONFIG[op.status as OperationStatus] || {
        label: op.status,
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        dotClass: 'bg-slate-400',
    };
    const colorKey = op.isOverdue ? 'danger' : op.operationType === 'pickup' ? 'warning' : 'success';
    const colors = STATUS_HEX[colorKey];

    const handleRescheduleSubmit = () => {
        if (!rescheduleDate || !onReschedule) return;
        onReschedule({
            orderId: op.orderMongoId || op.orderId,
            operationType: op.operationType,
            operationIndex: op.operationIndex,
            newDate: rescheduleDate,
            scheduledTime: rescheduleTime || undefined,
        });
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l bg-white shadow-2xl dark:border-slate-700/50 dark:bg-[#1a2234]">
                {/* Colored header strip */}
                <div className="h-1.5 shrink-0" style={{ backgroundColor: colors.border }} />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.bg }}>
                            <span className="text-lg">{op.operationType === 'pickup' ? '📦' : '🚚'}</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                {op.operationType === 'pickup' ? 'Récupération' : 'Livraison'} #{op.operationIndex + 1}
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                    {op.isSubscription ? 'ABO' : 'ALC'}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">{op.orderId.slice(-12)}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 pb-4">
                    {/* Status banner */}
                    {op.isLead ? (
                        <div className="mb-4 flex items-center gap-2 rounded-lg bg-purple-50 p-2.5 dark:bg-purple-500/10">
                            <span className="h-2 w-2 rounded-full bg-purple-500" />
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Prospect confirmé — en attente de conversion</span>
                        </div>
                    ) : (
                        <div className="mb-4 flex items-center gap-2 rounded-lg p-2.5" style={{ backgroundColor: op.isOverdue ? '#fef2f2' : colors.bg }}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: op.isOverdue ? '#e7515a' : colors.border }} />
                            <span className="text-xs font-bold" style={{ color: op.isOverdue ? '#dc2626' : colors.text }}>
                                {op.isOverdue ? 'En retard — Date dépassée' : statusCfg.label}
                            </span>
                        </div>
                    )}

                    {/* Client card */}
                    <div className="mb-4 rounded-xl border border-slate-100 p-3.5 dark:border-slate-700/50">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Client</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white">{op.customer.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {op.customer.phone && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    📞 {op.customer.phone}
                                </span>
                            )}
                            {op.customer.zone && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    📍 {op.customer.zone}
                                </span>
                            )}
                            {op.city && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">🏙 {op.city}</span>
                            )}
                        </div>
                    </div>

                    {/* Details grid */}
                    <div className="space-y-2.5">
                        <DetailRow label="Date" value={formatDate(op.date)} />
                        {op.scheduledTime && <DetailRow label="Heure prévue" value={op.scheduledTime} />}
                        {op.packName && <DetailRow label="Pack" value={op.packName} />}
                        {op.clothesCount != null && op.clothesCount > 0 && <DetailRow label="Articles" value={`${op.clothesCount} pièce(s)`} highlight />}
                        {op.pickupAgent && <DetailRow label="Agent de récupération" value={op.pickupAgent} />}
                        {op.deliveryAgent && <DetailRow label="Agent de livraison" value={op.deliveryAgent} />}
                        {op.paymentStatus && (
                            <DetailRow
                                label="Paiement"
                                value={op.paymentStatus === 'paid' ? 'Payé' : op.paymentStatus === 'partial' ? 'Partiel' : op.paymentStatus === 'unpaid' ? 'Impayé' : op.paymentStatus}
                            />
                        )}
                        {op.totalPrice != null && op.totalPrice > 0 && <DetailRow label="Montant" value={`${op.totalPrice.toLocaleString()} FCFA`} />}
                    </div>

                    {/* Subscription info */}
                    {op.isSubscription && op.subscriptionStatus && (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Abonnement</div>
                            <div className="mt-1 flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${op.subscriptionStatus === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                <span className="text-xs font-bold capitalize text-slate-700 dark:text-white">{op.subscriptionStatus}</span>
                            </div>
                        </div>
                    )}

                    {/* Reschedule section */}
                    {onReschedule && !op.isLead && (
                        <div className="mt-4">
                            {!showReschedule ? (
                                <button
                                    type="button"
                                    onClick={() => setShowReschedule(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-600 dark:text-slate-400"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Reprogrammer cette opération
                                </button>
                            ) : (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-primary">Reprogrammer</h4>
                                        <button
                                            type="button"
                                            onClick={() => setShowReschedule(false)}
                                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nouvelle date</label>
                                            <input
                                                type="date"
                                                value={rescheduleDate}
                                                onChange={(e) => setRescheduleDate(e.target.value)}
                                                min={new Date().toISOString().slice(0, 10)}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Heure (optionnel)</label>
                                            <input
                                                type="time"
                                                value={rescheduleTime}
                                                onChange={(e) => setRescheduleTime(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRescheduleSubmit}
                                            disabled={!rescheduleDate}
                                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Confirmer la reprogrammation
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-700/50">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            if (op.isLead) {
                                // Navigate to lead preview
                                window.location.href = `/apps/leads/preview?id=${op.orderMongoId}`;
                            } else {
                                onViewOrder(op.orderId);
                            }
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                        </svg>
                        {op.isLead ? 'Voir le prospect' : 'Voir la commande'}
                    </button>
                </div>
            </div>
        </>
    );
};

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex items-center justify-between rounded-lg bg-slate-50/50 px-3 py-2 dark:bg-slate-800/30">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-slate-700 dark:text-white'}`}>{value}</span>
    </div>
);

// ─── Legend Items ────────────────────────────────────────────
const LEGEND = [
    { color: '#e7515a', label: 'En retard' },
    { color: '#e2a03f', label: 'Récupération' },
    { color: '#805dca', label: 'Prospect confirmé' },
    { color: '#2196f3', label: 'Enregistré' },
    { color: '#4361ee', label: 'En traitement' },
    { color: '#00ab55', label: 'Prêt / Livré' },
];

// ─── Main Calendar ──────────────────────────────────────────
const CalendarView = ({
    calendarEvents,
    calendarOrderType,
    calendarOperationType,
    onOrderTypeChange,
    onOperationTypeChange,
    onEventDrop,
    onViewOrder,
    onQuickAction,
    onReschedule,
}: CalendarViewProps) => {
    const [drawerOp, setDrawerOp] = useState<Operation | null>(null);
    const [tooltip, setTooltip] = useState<{
        event: any;
        position: { x: number; y: number; elHeight: number };
    } | null>(null);
    const calendarRef = useRef<FullCalendar>(null);

    const handleEventClick = useCallback((info: any) => {
        setTooltip(null);
        setDrawerOp(info.event.extendedProps as Operation);
    }, []);

    // Tooltip — position relative to the element, not the mouse
    const handleEventMouseEnter = useCallback((info: any) => {
        const rect = info.el.getBoundingClientRect();
        setTooltip({
            event: info.event,
            position: {
                x: rect.left + rect.width / 2,
                y: rect.top,
                elHeight: rect.height,
            },
        });
    }, []);

    const handleEventMouseLeave = useCallback(() => {
        setTooltip(null);
    }, []);

    // Filter chips
    const chips = [
        { key: 'all', label: 'Toutes', active: calendarOrderType === 'all' && calendarOperationType === 'all' },
        { key: 'pickup', label: 'Récupérations', active: calendarOperationType === 'pickup' },
        { key: 'delivery', label: 'Livraisons', active: calendarOperationType === 'delivery' },
        { key: 'subscription', label: 'Abonnements', active: calendarOrderType === 'subscription' },
        { key: 'a-la-carte', label: 'À la carte', active: calendarOrderType === 'a-la-carte' },
    ];

    const handleChipClick = (key: string) => {
        if (key === 'all') {
            onOrderTypeChange('all');
            onOperationTypeChange('all');
        } else if (key === 'pickup' || key === 'delivery') {
            onOperationTypeChange(key);
            onOrderTypeChange('all');
        } else if (key === 'subscription' || key === 'a-la-carte') {
            onOrderTypeChange(key);
            onOperationTypeChange('all');
        }
    };

    // Count by type for the filter bar
    const pickupCount = calendarEvents.filter((e: any) => e.extendedProps?.operationType === 'pickup').length;
    const deliveryCount = calendarEvents.filter((e: any) => e.extendedProps?.operationType === 'delivery').length;
    const overdueCount = calendarEvents.filter((e: any) => e.extendedProps?.isOverdue).length;

    return (
        <div className="space-y-3">
            {/* ── Filter + Stats bar ──────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white dark:border-slate-700/40 dark:bg-[#1a2234]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    {/* Chips */}
                    <div className="flex flex-wrap gap-1">
                        {chips.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => handleChipClick(c.key)}
                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                    c.active ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">↓ {pickupCount}</span>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">↑ {deliveryCount}</span>
                        {overdueCount > 0 && <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 dark:bg-red-500/10">⚠ {overdueCount}</span>}
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                        <span className="text-[10px] font-bold text-slate-500">{calendarEvents.length} total</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2 dark:border-slate-700/40">
                    {LEGEND.map((l) => (
                        <div key={l.label} className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: l.color }} />
                            <span className="text-[9px] font-medium text-slate-400">{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Calendar ───────────────────────────────── */}
            <div className="calendar-wrapper overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                <div className="p-3 sm:p-4">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay',
                        }}
                        events={calendarEvents}
                        eventContent={renderEventContent}
                        editable={true}
                        droppable={true}
                        eventClick={handleEventClick}
                        eventDrop={onEventDrop}
                        eventMouseEnter={handleEventMouseEnter}
                        eventMouseLeave={handleEventMouseLeave}
                        locale="fr"
                        buttonText={{
                            today: "Aujourd'hui",
                            month: 'Mois',
                            week: 'Semaine',
                            day: 'Jour',
                        }}
                        height="auto"
                        dayMaxEvents={4}
                        moreLinkText={(n) => `+${n}`}
                        moreLinkClassNames="text-[10px] font-bold text-primary"
                        eventDisplay="block"
                        nowIndicator={true}
                        stickyHeaderDates={true}
                        slotMinTime="07:00:00"
                        slotMaxTime="22:00:00"
                        slotDuration="00:30:00"
                        allDaySlot={true}
                        allDayText="Journée"
                        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                        dayCellClassNames={(arg) => {
                            const d = arg.date;
                            const today = new Date();
                            if (d.toDateString() === today.toDateString()) return ['ops-today'];
                            return [];
                        }}
                    />
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && <EventTooltip event={tooltip.event} position={tooltip.position} />}

            {/* Drawer */}
            {drawerOp && <OperationDrawer operation={drawerOp} onClose={() => setDrawerOp(null)} onViewOrder={onViewOrder} onQuickAction={onQuickAction} onReschedule={onReschedule} />}
        </div>
    );
};

export default CalendarView;
