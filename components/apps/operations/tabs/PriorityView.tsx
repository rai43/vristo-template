'use client';
import React, { useMemo, useState } from 'react';
import { Operation } from '../types';
import { formatDate, getStatusBadge } from '../utils';

interface PriorityViewProps {
    operations: Operation[];
    search: (_ops: Operation[]) => Operation[];
    onViewOrder: (_orderId: string) => void;
    onQuickAction?: (_op: Operation) => void;
}

const PAGE_SIZE = 20;

const PriorityView = ({ operations, search, onViewOrder, onQuickAction }: PriorityViewProps) => {
    const [page, setPage] = useState(1);
    const filtered = search(operations);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

    const getDaysOverdue = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
    };

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
                <div className="flex items-center gap-3">
                    <div className="h-5 w-1 rounded-full bg-red-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-white">Priorités</h3>
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-500/15 dark:text-red-400">{filtered.length}</span>
                </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <p className="text-sm text-slate-400">Aucune opération prioritaire</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700/40 dark:bg-slate-800/30">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date prévue</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Retard</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Type</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Client</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Commande</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Zone</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {paged.map((op, i) => {
                                    const days = getDaysOverdue(op.date);
                                    return (
                                        <tr key={`${op.orderId}-${op.operationIndex}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDate(op.date)}</td>
                                            <td className="px-4 py-3">
                                                {days > 0 && (
                                                    <span
                                                        className={`rounded px-2 py-0.5 text-xs font-bold ${
                                                            days >= 3
                                                                ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                                                                : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                                                        }`}
                                                    >
                                                        {days}j
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                                                        op.operationType === 'pickup'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {op.operationType === 'pickup' ? 'Récup' : 'Livr'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-700 dark:text-white">{op.customer.name}</div>
                                                <div className="text-xs text-slate-400">{op.customer.phone}</div>
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
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{op.city || '-'}</td>
                                            <td className="px-4 py-3">{getStatusBadge(op)}</td>
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
                                    );
                                })}
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

export default PriorityView;
