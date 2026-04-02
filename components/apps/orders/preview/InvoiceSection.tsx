'use client';
import React from 'react';
import Image from 'next/image';
import { Order } from '@/lib/api/orders';
import { formatDate, getPackLimits, getStatusBadge } from './utils';

interface InvoiceSectionProps {
    order: Order;
    printRef: React.RefObject<HTMLDivElement>;
    packsMap: Record<string, string>;
    packsData?: any[];
    resolvePackName: (_code?: string) => string;
    handleRecalculatePrice: () => void;
}

const InvoiceSection = ({ order, printRef, packsMap, packsData, resolvePackName, handleRecalculatePrice }: InvoiceSectionProps) => {
    return (
        <div ref={printRef} className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* ── Invoice Header ──────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700/50">
                <div className="flex items-center gap-4">
                    <Image src="/mirai-logo-white-bg.png" alt="MIRAI Services" width={48} height={48} className="h-12 w-12 rounded-lg" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">MIRAI Services</h2>
                        <p className="text-xs text-slate-400">Entreprise de pressing</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="mb-1.5 flex items-center justify-end gap-2">
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                order.type === 'subscription'
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}
                        >
                            {order.type === 'subscription' ? 'Abonnement' : 'À la carte'}
                        </span>
                        {order.type === 'subscription'
                            ? (() => {
                                  const subStatus = (order as any).subscriptionStatus || 'active';
                                  const statusColors: Record<string, string> = {
                                      active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
                                      completed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
                                      stopped: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
                                  };
                                  const statusLabels: Record<string, string> = {
                                      active: 'Actif',
                                      completed: 'Terminé',
                                      stopped: 'Arrêté',
                                  };
                                  return (
                                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColors[subStatus] || statusColors.active}`}>
                                          {statusLabels[subStatus] || 'Actif'}
                                      </span>
                                  );
                              })()
                            : getStatusBadge(order.status)}
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-400">
                        <div>Derrière le marché de Djorogobité, Cocody</div>
                        <div>+225 05 01 91 90 80 · infomiraisrv@gmail.com</div>
                    </div>
                </div>
            </div>

            {/* ── Client & Order Info ─────────────────────── */}
            <div className="grid grid-cols-1 gap-6 border-b border-slate-100 px-6 py-5 dark:border-slate-700/50 lg:grid-cols-3">
                {/* Client Card */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/30 dark:bg-slate-800/30">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Client</p>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {order.customerId.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-white">{order.customerId.name}</p>
                            <p className="truncate text-xs text-slate-400">{order.customerId.location}</p>
                            {order.customerId.phones?.[0] && <p className="text-xs text-slate-400">{order.customerId.phones[0].number}</p>}
                        </div>
                    </div>
                </div>

                {/* Order Details */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/30 dark:bg-slate-800/30">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Commande</p>
                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">N°</span>
                            <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{order.orderId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Date</span>
                            <span className="text-slate-700 dark:text-slate-200">{formatDate(order.createdAt)}</span>
                        </div>
                        {order.packName && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Pack</span>
                                <div className="text-right">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{resolvePackName(order.packName)}</span>
                                    {packsMap[order.packName] && <div className="font-mono text-[10px] text-slate-400">{order.packName}</div>}
                                </div>
                            </div>
                        )}
                        {order.paymentMethod && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Paiement</span>
                                <span className="text-slate-700 dark:text-slate-200">{order.paymentMethod}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dates */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700/30 dark:bg-slate-800/30">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{order.type === 'subscription' ? 'Période' : 'Logistique'}</p>
                    {order.type === 'subscription' ? (
                        <div className="space-y-1.5 text-sm">
                            {order.subscriptionStartDate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Début</span>
                                    <span className="text-slate-700 dark:text-slate-200">{formatDate(order.subscriptionStartDate)}</span>
                                </div>
                            )}
                            {order.subscriptionEndDate && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Fin</span>
                                    <span className="text-slate-700 dark:text-slate-200">{formatDate(order.subscriptionEndDate)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-400">Lieu</span>
                                <span className="text-slate-700 dark:text-slate-200">{order.pickup?.city || order.customerId.location}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5 text-sm">
                            {order.pickup && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Récupération</span>
                                        <span className="text-slate-700 dark:text-slate-200">{formatDate(order.pickup.date)}</span>
                                    </div>
                                    {(order.pickup.fee ?? 0) > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Frais récup.</span>
                                            <span className="text-slate-700 dark:text-slate-200">{order.pickup.fee!.toLocaleString()} F</span>
                                        </div>
                                    )}
                                    {order.pickup.pickupAgent && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Agent récup.</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{order.pickup.pickupAgent}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {order.delivery && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Livraison</span>
                                        <span className="text-slate-700 dark:text-slate-200">{formatDate(order.delivery.date)}</span>
                                    </div>
                                    {(order.delivery.fee ?? 0) > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Frais livr.</span>
                                            <span className="text-slate-700 dark:text-slate-200">{order.delivery.fee!.toLocaleString()} F</span>
                                        </div>
                                    )}
                                    {order.delivery.deliveryAgent && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Agent livr.</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{order.delivery.deliveryAgent}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-400">Lieu</span>
                                <span className="text-slate-700 dark:text-slate-200">{order.pickup?.city || order.delivery?.city}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Items Table ──────────────────────────── */}
            <div className="px-6 py-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Articles</p>
                <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700/30">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Article</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Catégorie</th>
                                {order.type === 'a-la-carte' && <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Couleur</th>}
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Qté</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Prix u.</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                            {order.items.map((item: any, index: number) => {
                                const total = item.quantity * item.unitPrice;
                                const catColors: Record<string, string> = {
                                    package: 'bg-primary/10 text-primary',
                                    'add-on': 'bg-emerald-50 text-emerald-600',
                                    custom: 'bg-cyan-50 text-cyan-600',
                                };
                                return (
                                    <tr key={index} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-700 dark:text-slate-200">{item.category === 'package' ? resolvePackName(item.name) : item.name}</p>
                                            {item.category === 'package' && packsMap[item.name] && <p className="font-mono text-[10px] text-slate-400">{item.name}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${catColors[item.category] || 'bg-slate-100 text-slate-500'}`}>
                                                {item.category === 'package' ? 'Pack' : item.category === 'add-on' ? 'Add-on' : item.category === 'custom' ? 'Perso' : item.category}
                                            </span>
                                        </td>
                                        {order.type === 'a-la-carte' && (
                                            <td className="px-4 py-3">
                                                <span className={`text-xs ${item.color === 'white' ? 'text-blue-500' : 'text-slate-500'}`}>{item.color === 'white' ? 'Blanc' : 'Couleur'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-200">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{item.unitPrice.toLocaleString()} F</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString()} F</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Schedule Timeline ────────────────────── */}
            {order.type === 'subscription' && order.pickupSchedule && order.pickupSchedule.length > 0 && (
                <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-700/50">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Planning des opérations</p>
                    <div className="space-y-3">
                        {order.pickupSchedule.map((pickup: any, index: number) => {
                            const delivery = order.deliverySchedule?.[index];
                            return (
                                <div key={index} className="flex items-stretch gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</div>
                                        {index < order.pickupSchedule!.length - 1 && <div className="mt-1 flex-1 border-l-2 border-dashed border-slate-200 dark:border-slate-700" />}
                                    </div>
                                    <div className="flex flex-1 flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-3 dark:border-slate-700/30 dark:bg-slate-800/20">
                                        <div className="text-sm">
                                            <span className="text-[10px] uppercase text-slate-400">Récup. </span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{formatDate(pickup.date)}</span>
                                        </div>
                                        {pickup.pickupAgent && (
                                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                                🚗 {pickup.pickupAgent}
                                            </span>
                                        )}
                                        {delivery && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-600">→</span>
                                                <div className="text-sm">
                                                    <span className="text-[10px] uppercase text-slate-400">Livr. </span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{formatDate(delivery.date)}</span>
                                                </div>
                                            </>
                                        )}
                                        {(delivery as any)?.deliveryAgent && (
                                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                🚚 {(delivery as any).deliveryAgent}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Totals ──────────────────────────────── */}
            <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-700/50">
                <div className="ml-auto max-w-sm">
                    {(() => {
                        const itemsSubtotal = order.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
                        const pickupFee = order.type === 'a-la-carte' && order.pickup?.enabled ? order.pickup?.fee || 0 : 0;
                        const subscriptionDeliveryFee = order.type === 'subscription' ? (order.deliverySchedule || []).reduce((sum: number, op: any) => sum + (op.fee || 0), 0) : 0;
                        const aLaCarteDeliveryFee = order.type === 'a-la-carte' && order.delivery?.enabled ? order.delivery?.fee || 0 : 0;
                        const computedTotal = itemsSubtotal + pickupFee + subscriptionDeliveryFee + aLaCarteDeliveryFee;
                        const hasMismatch = order.totalPrice !== undefined && Math.abs(computedTotal - order.totalPrice) > 1;

                        return (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-500">
                                    <span>Sous-total</span>
                                    <span>{itemsSubtotal.toLocaleString()} F</span>
                                </div>
                                {order.type === 'subscription' && subscriptionDeliveryFee > 0 && (
                                    <div className="flex justify-between text-slate-500">
                                        <span>Livraison ({order.deliverySchedule?.length || 0} op.)</span>
                                        <span>{subscriptionDeliveryFee.toLocaleString()} F</span>
                                    </div>
                                )}
                                {order.type === 'a-la-carte' && pickupFee > 0 && (
                                    <div className="flex justify-between text-slate-500">
                                        <span>Récupération</span>
                                        <span>{pickupFee.toLocaleString()} F</span>
                                    </div>
                                )}
                                {order.type === 'a-la-carte' && aLaCarteDeliveryFee > 0 && (
                                    <div className="flex justify-between text-slate-500">
                                        <span>Livraison</span>
                                        <span>{aLaCarteDeliveryFee.toLocaleString()} F</span>
                                    </div>
                                )}
                                {(order.surplusAmount ?? 0) > 0 && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                        <span>Surplus ({order.surplus?.length || 0} article(s))</span>
                                        <span>{(order.surplusAmount || 0).toLocaleString()} F</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800 dark:border-slate-700 dark:text-white">
                                    <span>Total</span>
                                    <span>{(order.totalPrice ?? computedTotal).toLocaleString()} FCFA</span>
                                </div>
                                {hasMismatch && (
                                    <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs dark:border-amber-500/20 dark:bg-amber-500/5">
                                        <span className="text-amber-600">Attendu : {computedTotal.toLocaleString()} F</span>
                                        <button type="button" className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-amber-600" onClick={handleRecalculatePrice}>
                                            Recalculer
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ── Notes ──────────────────────────────── */}
            {order.note && (
                <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
                    <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{order.note}</p>
                </div>
            )}

            {/* ── Pack Details Section ──────────────────── */}
            {order.type === 'subscription' &&
                order.packName &&
                (() => {
                    const limits = getPackLimits(order.packName, packsData);
                    if (limits.total > 0) {
                        const categories = [
                            { label: 'Total articles', value: limits.total, color: 'text-primary' },
                            { label: 'Ordinaires', value: limits.ordinaires, color: 'text-slate-600' },
                            { label: 'Couettes', value: limits.couettes, color: 'text-indigo-600' },
                            { label: 'Vestes', value: limits.vestes, color: 'text-amber-600' },
                            {
                                label: 'Draps & Serviettes',
                                value: limits.draps_serviettes,
                                color: 'text-cyan-600',
                            },
                        ];
                        return (
                            <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-700/50">
                                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Détails du Pack — {resolvePackName(order.packName)}</p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                    {categories.map((cat) => (
                                        <div key={cat.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-center dark:border-slate-700/30 dark:bg-slate-800/30">
                                            <div className={`text-2xl font-bold ${cat.color} dark:text-white`}>{cat.value}</div>
                                            <div className="mt-0.5 text-[10px] text-slate-400">{cat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}
        </div>
    );
};

export default InvoiceSection;
