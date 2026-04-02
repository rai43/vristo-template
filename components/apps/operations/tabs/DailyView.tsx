'use client';
import React, { useState } from 'react';
import { DailyOperations, Operation } from '../types';
import { exportDailyToExcel, formatDate, getStatusBadge } from '../utils';

interface DailyViewProps {
    dailyOperations: DailyOperations;
    search: (_ops: Operation[]) => Operation[];
    onViewOrder: (_orderId: string) => void;
}

const SectionCard = ({
    title,
    count,
    colorBar,
    countBg,
    children,
    emptyMsg,
    isEmpty,
}: {
    title: string;
    count: number;
    colorBar: string;
    countBg: string;
    children: React.ReactNode;
    emptyMsg: string;
    isEmpty: boolean;
}) => (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
            <div className={`h-5 w-1 rounded-full ${colorBar}`} />
            <h3 className="flex-1 text-sm font-bold text-slate-700 dark:text-white">{title}</h3>
            <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold ${countBg}`}>{count}</span>
        </div>
        {isEmpty ? (
            <div className="flex items-center justify-center py-10">
                <p className="text-xs text-slate-400">{emptyMsg}</p>
            </div>
        ) : (
            children
        )}
    </div>
);

const OpRow = ({ op, onViewOrder, sectionKey }: { op: Operation; onViewOrder: (_id: string) => void; sectionKey?: string }) => {
    // In "À laver" and "En traitement" sections, we already have the items — don't show "Récup"
    const hideOperationType = sectionKey === 'wash' || sectionKey === 'progress';

    return (
        <div className="flex items-center gap-3 border-b border-slate-50 px-5 py-2.5 last:border-0 hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/30">
            {/* Date */}
            <div className="w-20 shrink-0">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatDate(op.date).slice(0, 6)}</div>
                {op.scheduledTime && <div className="text-[10px] text-slate-400">{op.scheduledTime}</div>}
            </div>
            {/* Type badge — hidden in wash/progress sections */}
            {!hideOperationType && (
                <div className="w-16 shrink-0">
                    <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            op.operationType === 'pickup'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        }`}
                    >
                        {op.operationType === 'pickup' ? 'Récup' : 'Livr'}
                    </span>
                </div>
            )}
            {/* Client */}
            <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onViewOrder(op.orderId)} className="truncate text-sm font-medium text-slate-700 hover:text-primary dark:text-slate-200">
                    {op.customer.name}
                </button>
                <div className="flex items-center gap-1.5 truncate text-[10px] text-slate-400">
                    <span className={`inline-block rounded px-1 py-px text-[9px] font-bold ${op.isSubscription ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                        {op.isSubscription ? 'ABO' : 'ALC'}
                    </span>
                    <span>{op.orderId.slice(-10)}</span>
                    {/* Operation number for subscriptions */}
                    {op.isSubscription && <span className="font-medium">· Op {op.operationIndex + 1}</span>}
                    {op.city && <span>· {op.city}</span>}
                </div>
            </div>
            {/* Days after pickup indicator (for à laver) */}
            {sectionKey === 'wash' && op.daysAfterPickup != null && (
                <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        op.daysAfterPickup >= 5 ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}
                >
                    {op.daysAfterPickup}j
                </span>
            )}
            {/* Agent */}
            {(op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent) && (
                <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400 sm:inline">{op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent}</span>
            )}
            {/* Status badge — show appropriate status */}
            <div className="shrink-0">{getStatusBadge(op)}</div>
        </div>
    );
};

/** Generate WhatsApp message for daily operations */
function buildWhatsAppMessage(pickups: Operation[], deliveries: Operation[]): string {
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const lines: string[] = [];
    lines.push(`📋 *OPÉRATIONS DU JOUR — ${cap(today).toUpperCase()}*`);
    lines.push('');

    if (pickups.length > 0) {
        lines.push(`📦 *RÉCUPÉRATIONS (${pickups.length})*`);
        lines.push('─────────────────────');
        pickups.forEach((op, i) => {
            lines.push(`${i + 1}. *${op.customer.name}*${op.isSubscription ? ` (ABO · Op ${op.operationIndex + 1})` : ' (ALC)'}`);
            if (op.city || op.customer.zone) lines.push(`   📍 ${op.city || op.customer.zone}`);
            if (op.scheduledTime) lines.push(`   ⏰ ${op.scheduledTime}`);
            if (op.pickupAgent) lines.push(`   🚗 ${op.pickupAgent}`);
            if (op.customer.phone) lines.push(`   📞 ${op.customer.phone}`);
        });
        lines.push('');
    }

    if (deliveries.length > 0) {
        lines.push(`🚚 *LIVRAISONS (${deliveries.length})*`);
        lines.push('─────────────────────');
        deliveries.forEach((op, i) => {
            lines.push(`${i + 1}. *${op.customer.name}*${op.isSubscription ? ` (ABO · Op ${op.operationIndex + 1})` : ' (ALC)'}`);
            if (op.city || op.customer.zone) lines.push(`   📍 ${op.city || op.customer.zone}`);
            if (op.scheduledTime) lines.push(`   ⏰ ${op.scheduledTime}`);
            if (op.clothesCount) lines.push(`   👕 ${op.clothesCount} pièces`);
            if (op.deliveryAgent) lines.push(`   🚗 ${op.deliveryAgent}`);
            if (op.customer.phone) lines.push(`   📞 ${op.customer.phone}`);
        });
        lines.push('');
    }

    lines.push(`📊 Total: ${pickups.length} récup. · ${deliveries.length} livr.`);
    return lines.join('\n');
}

const CopyWhatsAppButton = ({ text, label }: { text: string; label: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };
    return (
        <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                copied
                    ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                    : 'bg-[#25d366]/10 text-[#128c7e] hover:bg-[#25d366]/20 dark:text-[#25d366]'
            }`}
        >
            {copied ? (
                <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copié !
                </>
            ) : (
                <>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    {label}
                </>
            )}
        </button>
    );
};

const DailyView = ({ dailyOperations, search, onViewOrder }: DailyViewProps) => {
    const todayPickups = search(dailyOperations.toPickupToday || []);
    const todayDeliveries = search(dailyOperations.toDeliverToday);
    const whatsappText = buildWhatsAppMessage(todayPickups, todayDeliveries);

    const sections = [
        {
            key: 'pickup',
            title: "Récupérations du jour",
            colorBar: 'bg-amber-500',
            countBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
            ops: todayPickups,
            empty: "Aucune récupération prévue aujourd'hui",
        },
        {
            key: 'wash',
            title: "À laver aujourd'hui",
            colorBar: 'bg-amber-400',
            countBg: 'bg-amber-100 text-amber-600 dark:bg-emerald-500/15 dark:text-amber-400',
            ops: search(dailyOperations.toWashToday),
            empty: "Rien à laver aujourd'hui",
        },
        {
            key: 'deliver',
            title: 'Livraisons du jour',
            colorBar: 'bg-emerald-500',
            countBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
            ops: todayDeliveries,
            empty: 'Aucune livraison prévue',
        },
        {
            key: 'progress',
            title: 'En traitement',
            colorBar: 'bg-blue-500',
            countBg: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
            ops: search(dailyOperations.inProgress),
            empty: 'Aucun traitement en cours',
        },
    ];

    return (
        <div className="space-y-4">
            {/* Export + WhatsApp copy */}
            <div className="flex flex-wrap items-center justify-end gap-2">
                <CopyWhatsAppButton
                    text={whatsappText}
                    label="Copier message WhatsApp"
                />
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                    onClick={() => exportDailyToExcel(dailyOperations)}
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter
                </button>
            </div>

            {sections.map((s) => (
                <SectionCard key={s.key} title={s.title} count={s.ops.length} colorBar={s.colorBar} countBg={s.countBg} emptyMsg={s.empty} isEmpty={s.ops.length === 0}>
                    <div>
                        {s.ops.map((op, i) => (
                            <OpRow key={`${op.orderId}-${op.operationIndex}-${i}`} op={op} onViewOrder={onViewOrder} sectionKey={s.key} />
                        ))}
                    </div>
                </SectionCard>
            ))}
        </div>
    );
};

export default DailyView;
