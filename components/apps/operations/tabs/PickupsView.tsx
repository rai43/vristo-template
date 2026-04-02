'use client';
import React, { useMemo, useState } from 'react';
import { Operation } from '../types';
import { formatDate, getStatusBadge } from '../utils';

interface PickupsViewProps {
    operations: Operation[];
    search: (_ops: Operation[]) => Operation[];
    onViewOrder: (_orderId: string) => void;
    onQuickAction?: (_op: Operation) => void;
}

const PAGE_SIZE = 20;

function buildPickupsWhatsApp(ops: Operation[]): string {
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const lines: string[] = [];
    lines.push(`📦 *RÉCUPÉRATIONS — ${cap(today).toUpperCase()}*`);
    lines.push('');
    ops.forEach((op, i) => {
        lines.push(`${i + 1}. *${op.customer.name}*${op.isSubscription ? ` (ABO · Op ${op.operationIndex + 1})` : ' (ALC)'}`);
        if (op.city || op.customer.zone) lines.push(`   📍 ${op.city || op.customer.zone}`);
        if (op.scheduledTime) lines.push(`   ⏰ ${op.scheduledTime}`);
        if (op.preferredTime && op.preferredTime !== op.scheduledTime) lines.push(`   🕐 Souhaité: ${op.preferredTime}`);
        if (op.pickupAgent) lines.push(`   🚗 ${op.pickupAgent}`);
        if (op.customer.phone) lines.push(`   📞 ${op.customer.phone}`);
    });
    lines.push('');
    lines.push(`📊 Total: ${ops.length} récupération${ops.length !== 1 ? 's' : ''}`);
    return lines.join('\n');
}

const CopyWhatsAppButton = ({ ops }: { ops: Operation[] }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        const text = buildPickupsWhatsApp(ops);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };
    return (
        <button
            type="button"
            onClick={handleCopy}
            disabled={ops.length === 0}
            title="Copier message WhatsApp"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                copied
                    ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                    : 'bg-[#25d366]/10 text-[#128c7e] hover:bg-[#25d366]/20 dark:text-[#25d366]'
            }`}
        >
            {copied ? (
                <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Copié !
                </>
            ) : (
                <>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    WhatsApp
                </>
            )}
        </button>
    );
};

const PickupsView = ({ operations, search, onViewOrder, onQuickAction }: PickupsViewProps) => {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const filtered = useMemo(() => {
        let ops = search(operations);
        if (statusFilter !== 'all') {
            ops = ops.filter((op) => op.status === statusFilter);
        }
        return ops.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [operations, search, statusFilter]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

    // Reset page when filter changes
    React.useEffect(() => setPage(1), [statusFilter]);

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
                <div className="flex items-center gap-3">
                    <div className="h-5 w-1 rounded-full bg-amber-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-white">Récupérations</h3>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">{filtered.length}</span>
                </div>
                <CopyWhatsAppButton ops={filtered} />
                <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En attente</option>
                    <option value="confirmed">✅ Confirmé (client)</option>
                    <option value="registered">Enregistré</option>
                    <option value="processing">En traitement</option>
                </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <p className="text-sm text-slate-400">Aucune récupération</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700/40 dark:bg-slate-800/30">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date prévue</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Client</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Commande</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Pack</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Zone</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Articles</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Agent</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {paged.map((op, i) => (
                                    <tr key={`${op.orderId}-${op.operationIndex}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3">
                                            <div className="text-slate-700 dark:text-slate-200">{formatDate(op.date)}</div>
                                            {op.scheduledTime && <div className="text-xs text-slate-400">🕐 {op.scheduledTime}</div>}
                                            {op.preferredTime && op.preferredTime !== op.scheduledTime && (
                                                <div className="text-[10px] text-blue-500">Client: {op.preferredTime}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-700 dark:text-white">{op.customer.name}</div>
                                            <div className="text-xs text-slate-400">{op.customer.phone || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${op.isSubscription ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                                                    {op.isSubscription ? 'ABO' : 'ALC'}
                                                </span>
                                                {op.isSubscription && (
                                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                                        Op {op.operationIndex + 1}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500">{op.orderId.slice(-10)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{op.packName || '-'}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{op.city || '-'}</td>
                                        <td className="px-4 py-3">
                                            {op.clothesCount != null && op.clothesCount > 0 ? (
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{op.clothesCount}</span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(op)}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{op.pickupAgent || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {onQuickAction && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onQuickAction(op)}
                                                        className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
                                                        title="Actions rapides"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                            />
                                                        </svg>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => onViewOrder(op.orderId)}
                                                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                                                >
                                                    Voir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-700/40">
                            <span className="text-xs text-slate-400">
                                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                                >
                                    Précédent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                                >
                                    Suivant
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PickupsView;
