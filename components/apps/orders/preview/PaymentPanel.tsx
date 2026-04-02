'use client';
import React from 'react';
import { Order } from '@/lib/api/orders';

interface PaymentPanelProps {
    order: Order;
    onShowPaymentModal: () => void;
    onDeletePayment: (_paymentIndex: number, _payment: any) => void;
}

const PaymentPanel = ({ order, onShowPaymentModal, onDeletePayment }: PaymentPanelProps) => {
    const paidPercent = order.totalPrice > 0 ? Math.round(((order.totalPaid || 0) / order.totalPrice) * 100) : 0;

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="text-sm font-bold text-slate-800 dark:text-white">Paiements</h5>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                    onClick={onShowPaymentModal}
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter
                </button>
            </div>

            <div className="space-y-5 p-5">
                {/* Progress */}
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                order.paymentStatus === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : order.paymentStatus === 'partial'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-emerald-500' : order.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`} />
                            {order.paymentStatus === 'paid' ? 'Payé' : order.paymentStatus === 'partial' ? 'Partiel' : 'Impayé'}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{paidPercent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                order.paymentStatus === 'paid' ? 'bg-emerald-500' : order.paymentStatus === 'partial' ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(paidPercent, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-center dark:border-slate-700/30 dark:bg-slate-800/30">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">{order.totalPrice.toLocaleString()}</p>
                        <p className="text-[10px] font-medium text-slate-400">Total (F)</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-500/5">
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{(order.totalPaid || 0).toLocaleString()}</p>
                        <p className="text-[10px] font-medium text-slate-400">Payé (F)</p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 text-center dark:border-amber-500/20 dark:bg-amber-500/5">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{(order.totalPrice - (order.totalPaid || 0)).toLocaleString()}</p>
                        <p className="text-[10px] font-medium text-slate-400">Restant (F)</p>
                    </div>
                </div>

                {/* Surplus breakdown */}
                {(order.surplusAmount ?? 0) > 0 && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Dont surplus</span>
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{(order.surplusAmount || 0).toLocaleString()} F</span>
                        </div>
                        <p className="mt-1 text-[10px] text-amber-600/70 dark:text-amber-400/60">
                            Base : {(order.totalPrice - (order.surplusAmount || 0)).toLocaleString()} F + Surplus : {(order.surplusAmount || 0).toLocaleString()} F
                        </p>
                    </div>
                )}

                {/* Payment History */}
                {order.payments && order.payments.length > 0 ? (
                    <div>
                        <h6 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Historique</h6>
                        <div className="space-y-2">
                            {order.payments.map((payment, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-3 dark:border-slate-700/30 dark:bg-slate-800/20"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{payment.amount.toLocaleString()} FCFA</p>
                                        <p className="text-[11px] text-slate-400">
                                            {payment.method} · {new Date(payment.paidAt).toLocaleDateString('fr-FR')}
                                            {payment.reference && <span className="ml-1 font-medium text-primary">#{payment.reference}</span>}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                        onClick={() => onDeletePayment(index, payment)}
                                        title="Supprimer"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                        <p className="text-sm text-slate-400">Aucun paiement enregistré</p>
                        <p className="mt-1 text-[11px] text-slate-300">Cliquez sur &quot;Ajouter&quot; pour enregistrer un paiement</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentPanel;
