'use client';
import React, { useMemo, useState } from 'react';
import { Operation } from '../types';
import { formatDate, getStatusBadge } from '../utils';

interface CollectionsTabProps {
    operations: Operation[];
    search: (_ops: Operation[]) => Operation[];
    onViewOrder: (_orderId: string) => void;
    onQuickAction?: (_op: Operation) => void;
}

const formatCFA = (amount: number) => `CFA ${amount.toLocaleString('fr-FR')}`;

interface AgentGroup {
    agent: string;
    ops: Operation[];
    totalCFA: number;
}

const CollectionsTab = ({ operations, search, onViewOrder, onQuickAction }: CollectionsTabProps) => {
    const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<'unpaid' | 'partial' | 'all'>('unpaid');

    // Filter delivery operations needing collection
    const collectionsOps = useMemo(() => {
        let ops = search(operations).filter((op) => op.operationType === 'delivery' && !op.isTerminal);
        if (filterStatus === 'unpaid') {
            ops = ops.filter((op) => op.paymentStatus !== 'paid');
        } else if (filterStatus === 'partial') {
            ops = ops.filter((op) => op.paymentStatus === 'partial');
        }
        return ops.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [operations, search, filterStatus]);

    // Group by delivery agent
    const agentGroups: AgentGroup[] = useMemo(() => {
        const map: Record<string, Operation[]> = {};
        collectionsOps.forEach((op) => {
            const agent = op.deliveryAgent || 'Non assigné';
            if (!map[agent]) map[agent] = [];
            map[agent].push(op);
        });
        return Object.entries(map)
            .map(([agent, ops]) => ({
                agent,
                ops,
                totalCFA: ops.reduce((sum, op) => sum + (op.totalPrice || 0), 0),
            }))
            .sort((a, b) => b.totalCFA - a.totalCFA);
    }, [collectionsOps]);

    const totalToCollect = agentGroups.reduce((sum, g) => sum + g.totalCFA, 0);
    const totalOpsCount = collectionsOps.length;
    const agentsCount = agentGroups.filter((g) => g.agent !== 'Non assigné').length;

    const toggleAgent = (agent: string) => {
        setExpandedAgents((prev) => {
            const next = new Set(prev);
            if (next.has(agent)) next.delete(agent);
            else next.add(agent);
            return next;
        });
    };

    const getPaymentBadge = (status?: string) => {
        switch (status) {
            case 'paid':
                return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:bg-green-500/10 dark:text-green-400">Payé</span>;
            case 'partial':
                return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">Partiel</span>;
            default:
                return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">Impayé</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Summary Bar ───────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/40">
                    <div className="flex items-center gap-3">
                        <div className="h-5 w-1 rounded-full bg-green-500" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-white">Encaissements</h3>
                        <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-600 dark:bg-green-500/15 dark:text-green-400">{totalOpsCount}</span>
                    </div>
                    <select
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'unpaid' | 'partial' | 'all')}
                    >
                        <option value="unpaid">Non payés</option>
                        <option value="partial">Partiellement payés</option>
                        <option value="all">Tous</option>
                    </select>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 p-5">
                    <div className="rounded-xl bg-green-50 px-4 py-3 dark:bg-green-500/10">
                        <div className="text-xl font-bold text-green-700 dark:text-green-400">{formatCFA(totalToCollect)}</div>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Total à encaisser</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{totalOpsCount}</div>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Opérations</div>
                    </div>
                    <div className="rounded-xl bg-purple-50 px-4 py-3 dark:bg-purple-500/10">
                        <div className="text-xl font-bold text-purple-700 dark:text-purple-400">{agentsCount}</div>
                        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Agents</div>
                    </div>
                </div>
            </div>

            {/* ── Agent Groups ──────────────────────────────── */}
            {agentGroups.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-slate-200/60 bg-white py-16 shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                    <p className="text-sm text-slate-400">Aucun encaissement à collecter</p>
                </div>
            ) : (
                agentGroups.map((group) => {
                    const isExpanded = expandedAgents.has(group.agent);
                    return (
                        <div key={group.agent} className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/40 dark:bg-[#1a2234]">
                            {/* Agent header */}
                            <button
                                type="button"
                                onClick={() => toggleAgent(group.agent)}
                                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                        {group.agent === 'Non assigné' ? '?' : group.agent.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 dark:text-white">{group.agent}</div>
                                        <div className="text-xs text-slate-400">{group.ops.length} opération{group.ops.length > 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCFA(group.totalCFA)}</span>
                                    <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {/* Operations table (collapsible) */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 dark:border-slate-700/40">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700/40 dark:bg-slate-800/30">
                                            <tr>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Date</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Client</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Commande</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Zone</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Montant</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Paiement</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Statut op.</th>
                                                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {group.ops.map((op, i) => (
                                                <tr key={`${op.orderId}-${op.operationIndex}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{formatDate(op.date)}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="font-medium text-slate-700 dark:text-white">{op.customer.name}</div>
                                                        <div className="text-xs text-slate-400">{op.customer.phone || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${op.isSubscription ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                                                                {op.isSubscription ? 'ABO' : 'ALC'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-0.5 text-xs text-slate-500">{op.orderId.slice(-10)}</div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-slate-500">{op.city || '-'}</td>
                                                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{op.totalPrice ? formatCFA(op.totalPrice) : '-'}</td>
                                                    <td className="px-4 py-2.5">{getPaymentBadge(op.paymentStatus)}</td>
                                                    <td className="px-4 py-2.5">{getStatusBadge(op)}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1">
                                                            {onQuickAction && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onQuickAction(op)}
                                                                    className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
                                                                    title="Actions rapides"
                                                                >
                                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default CollectionsTab;

