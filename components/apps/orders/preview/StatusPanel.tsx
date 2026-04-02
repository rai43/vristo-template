'use client';
import React from 'react';
import { getStatusConfig, Order } from '@/lib/api/orders';
import { getStatusConfigSafe } from './utils';

interface StatusPanelProps {
    order: Order;
    onChangeStatus: () => void;
}

const StatusPanel = ({ order, onChangeStatus }: StatusPanelProps) => {
    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="text-sm font-bold text-slate-800 dark:text-white">{order.type === 'subscription' ? 'Abonnement' : 'Statut'}</h5>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    onClick={onChangeStatus}
                >
                    Changer
                </button>
            </div>

            <div className="space-y-5 p-5">
                {/* Current Status Card */}
                {order.type === 'subscription' ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/30 dark:bg-slate-800/30">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`h-3 w-3 rounded-full ${
                                        order.subscriptionStatus === 'active' ? 'bg-emerald-500' : order.subscriptionStatus === 'completed' ? 'bg-blue-500' : 'bg-slate-400'
                                    }`}
                                />
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Statut</p>
                                    <p className="text-base font-bold text-slate-800 dark:text-white">
                                        {order.subscriptionStatus === 'active' ? 'Actif' : order.subscriptionStatus === 'completed' ? 'Terminé' : 'Arrêté'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400">Mis à jour</p>
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{new Date(order.updatedAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                        </div>
                        {order.subscriptionStatus === 'completed' && (
                            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-300">
                                L&apos;abonnement est terminé. Toutes les opérations ont atteint un état final ou la date de fin est dépassée.
                            </div>
                        )}
                        {order.subscriptionStatus === 'stopped' && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400">
                                Abonnement arrêté manuellement — les opérations sont verrouillées, seuls les paiements restent autorisés.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/30 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${getStatusConfig(order.status).color}/10 text-sm font-semibold text-${
                                    getStatusConfig(order.status).color
                                }`}
                            >
                                {getStatusConfig(order.status).label.charAt(0)}
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400">Statut actuel</p>
                                <p className="text-base font-bold text-slate-800 dark:text-white">{getStatusConfig(order.status).label}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400">Mis à jour</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{new Date(order.updatedAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                )}

                {/* Status Timeline */}
                {order.history.filter((h) => h.previousStatus || h.newStatus).length > 0 && (
                    <div>
                        <h6 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Historique</h6>
                        <div className="relative space-y-2">
                            <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-slate-200 dark:bg-slate-700"></div>

                            {order.history
                                .filter((h) => h.previousStatus || h.newStatus)
                                .slice(-5)
                                .reverse()
                                .map((h, index) => (
                                    <div key={index} className="relative flex gap-3 pl-1">
                                        <div
                                            className={`z-10 mt-1.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${
                                                index === 0 ? 'border-primary bg-primary' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                            }`}
                                        />
                                        <div className="flex-1 pb-2">
                                            <div className="flex items-center gap-1.5">
                                                {h.previousStatus && h.newStatus && (
                                                    <>
                                                        <span className="text-xs text-slate-500">{getStatusConfigSafe(h.previousStatus).label}</span>
                                                        <span className="text-[10px] text-slate-300">→</span>
                                                        <span className={`text-xs font-medium text-${getStatusConfigSafe(h.newStatus).color}`}>{getStatusConfigSafe(h.newStatus).label}</span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-slate-400">
                                                {new Date(h.modifiedAt).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                                {' · '}
                                                {new Date(h.modifiedAt).toLocaleTimeString('fr-FR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                            {h.note && <p className="mt-1 text-[11px] italic text-slate-400">{h.note}</p>}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatusPanel;
