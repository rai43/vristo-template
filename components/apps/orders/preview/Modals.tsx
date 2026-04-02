'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import IconX from '@/components/icon/icon-x';
import { getStatusConfig, Order, OrderStatus } from '@/lib/api/orders';
import { DeliveryPerson, getActiveDeliveryPersons } from '@/lib/api/delivery-persons';
import { getPackLimits } from './utils';

interface ModalsProps {
    order: Order;
    // Payment modal
    showPaymentModal: boolean;
    setShowPaymentModal: (_show: boolean) => void;
    paymentAmount: string;
    setPaymentAmount: (_val: string) => void;
    paymentMethod: string;
    setPaymentMethod: (_val: string) => void;
    paymentReference: string;
    setPaymentReference: (_val: string) => void;
    paymentNote: string;
    setPaymentNote: (_val: string) => void;
    handleAddPayment: () => void;
    paymentMutationPending: boolean;
    // Status modal
    showStatusModal: boolean;
    setShowStatusModal: (_show: boolean) => void;
    newStatus: OrderStatus;
    setNewStatus: (_status: OrderStatus) => void;
    statusNote: string;
    setStatusNote: (_val: string) => void;
    handleUpdateStatus: () => void;
    statusMutationPending: boolean;
    // Subscription status modal
    showSubscriptionStatusModal: boolean;
    setShowSubscriptionStatusModal: (_show: boolean) => void;
    newSubscriptionStatus: 'active' | 'completed' | 'stopped';
    setNewSubscriptionStatus: (_status: 'active' | 'completed' | 'stopped') => void;
    subscriptionStatusNote: string;
    setSubscriptionStatusNote: (_val: string) => void;
    handleUpdateSubscriptionStatus: () => void;
    // Operation status modal
    showOperationStatusModal: boolean;
    setShowOperationStatusModal: (_show: boolean) => void;
    editingOperationStatus: { type: 'pickup' | 'delivery'; index: number } | null;
    operationStatus: string;
    setOperationStatus: (_val: string) => void;
    operationNote: string;
    setOperationNote: (_val: string) => void;
    deliveryAgentName: string;
    setDeliveryAgentName: (_val: string) => void;
    pickupAgentName: string;
    setPickupAgentName: (_val: string) => void;
    scheduledTime: string;
    setScheduledTime: (_val: string) => void;
    handleUpdateOperationStatus: () => void;
    // Clothes modal
    showClothesModal: boolean;
    setShowClothesModal: (_show: boolean) => void;
    editingClothes: { type: 'pickup' | 'delivery'; index: number } | null;
    clothesTotal: string;
    setClothesTotal: (_val: string) => void;
    clothesCouettes: string;
    setClothesCouettes: (_val: string) => void;
    clothesVestes: string;
    setClothesVestes: (_val: string) => void;
    clothesDraps: string;
    setClothesDraps: (_val: string) => void;
    clothesServiettes: string;
    setClothesServiettes: (_val: string) => void;
    handleSaveClothesDetails: () => void;
    packsData?: any[];
}

const Modals = ({
    order,
    showPaymentModal,
    setShowPaymentModal,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    paymentReference,
    setPaymentReference,
    paymentNote,
    setPaymentNote,
    handleAddPayment,
    paymentMutationPending,
    showStatusModal,
    setShowStatusModal,
    newStatus,
    setNewStatus,
    statusNote,
    setStatusNote,
    handleUpdateStatus,
    statusMutationPending,
    showSubscriptionStatusModal,
    setShowSubscriptionStatusModal,
    newSubscriptionStatus,
    setNewSubscriptionStatus,
    subscriptionStatusNote,
    setSubscriptionStatusNote,
    handleUpdateSubscriptionStatus,
    showOperationStatusModal,
    setShowOperationStatusModal,
    editingOperationStatus,
    operationStatus,
    setOperationStatus,
    operationNote,
    setOperationNote,
    deliveryAgentName,
    setDeliveryAgentName,
    pickupAgentName,
    setPickupAgentName,
    scheduledTime,
    setScheduledTime,
    handleUpdateOperationStatus,
    showClothesModal,
    setShowClothesModal,
    editingClothes,
    clothesTotal,
    setClothesTotal,
    clothesCouettes,
    setClothesCouettes,
    clothesVestes,
    setClothesVestes,
    clothesDraps,
    setClothesDraps,
    clothesServiettes,
    setClothesServiettes,
    handleSaveClothesDetails,
    packsData,
}: ModalsProps) => {
    // Fetch active delivery persons for the dropdown
    const { data: deliveryPersons = [] } = useQuery<DeliveryPerson[]>({
        queryKey: ['delivery-persons', 'active'],
        queryFn: async () => {
            const res = await getActiveDeliveryPersons();
            return res.data;
        },
        enabled: showOperationStatusModal,
    });

    return (
        <>
            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
                    <div className="w-full max-w-md rounded-xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h5 className="text-base font-bold text-slate-800 dark:text-white">Nouveau Paiement</h5>
                                <p className="mt-0.5 text-xs text-slate-400">Restant : {((order?.totalPrice || 0) - (order?.totalPaid || 0)).toLocaleString()} FCFA</p>
                            </div>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                onClick={() => setShowPaymentModal(false)}
                            >
                                <IconX />
                            </button>
                        </div>
                        <div className="space-y-4 p-6">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Montant (FCFA) *</label>
                                <input type="number" className="form-input rounded-lg" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Ex: 50000" />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Méthode de paiement</label>
                                <select className="form-select rounded-lg" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                    <option value="Cash">Espèces</option>
                                    <option value="OrangeMoney">Orange Money</option>
                                    <option value="MTNMoney">MTN Money</option>
                                    <option value="MoovMoney">Moov Money</option>
                                    <option value="Wave">Wave</option>
                                    <option value="BankTransfer">Virement Bancaire</option>
                                    <option value="Other">Autre</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Référence</label>
                                    <input type="text" className="form-input rounded-lg" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="N° transaction" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Note</label>
                                    <input type="text" className="form-input rounded-lg" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Détails" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => setShowPaymentModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                                onClick={handleAddPayment}
                                disabled={paymentMutationPending}
                            >
                                {paymentMutationPending ? 'En cours...' : 'Enregistrer le paiement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowStatusModal(false)}>
                    <div className="w-full max-w-md rounded-xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h5 className="text-base font-bold text-slate-800 dark:text-white">Changer le Statut</h5>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Statut actuel : <span className="font-medium text-slate-600 dark:text-slate-300">{getStatusConfig(order?.status || 'pending').label}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                onClick={() => setShowStatusModal(false)}
                            >
                                <IconX />
                            </button>
                        </div>
                        <div className="space-y-4 p-6">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nouveau Statut</label>
                                <select className="form-select rounded-lg" value={newStatus} onChange={(e) => setNewStatus(e.target.value as OrderStatus)}>
                                    <option value="pending">En attente</option>
                                    <option value="registered">Enregistrement</option>
                                    <option value="processing">En traitement</option>
                                    <option value="ready_for_delivery">Prêt pour livraison</option>
                                    <option value="out_for_delivery">En cours de livraison</option>
                                    <option value="not_delivered">Pas livré</option>
                                    <option value="delivered">Livré</option>
                                    <option value="returned">Retourné</option>
                                    <option value="cancelled">Annulé</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Note (optionnel)</label>
                                <textarea
                                    className="form-textarea rounded-lg"
                                    value={statusNote}
                                    onChange={(e) => setStatusNote(e.target.value)}
                                    rows={2}
                                    placeholder="Raison du changement de statut"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => setShowStatusModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                                onClick={handleUpdateStatus}
                                disabled={statusMutationPending}
                            >
                                {statusMutationPending ? 'En cours...' : 'Mettre à jour'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subscription Status Modal */}
            {showSubscriptionStatusModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSubscriptionStatusModal(false)}>
                    <div className="w-full max-w-md rounded-xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h5 className="text-base font-bold text-slate-800 dark:text-white">Statut d&apos;Abonnement</h5>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Actuel :{' '}
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                        {order?.subscriptionStatus === 'active' ? 'Actif' : order?.subscriptionStatus === 'completed' ? 'Terminé' : 'Arrêté'}
                                    </span>
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                onClick={() => setShowSubscriptionStatusModal(false)}
                            >
                                <IconX />
                            </button>
                        </div>
                        <div className="space-y-4 p-6">
                            {/* Auto-complete info */}
                            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                                <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                                    Le statut passe automatiquement à <strong>Terminé</strong> lorsque toutes les opérations atteignent un état final (livré, retourné, annulé) ou que la date de fin
                                    est dépassée. Utilisez cette option uniquement pour <strong>arrêter manuellement</strong> l&apos;abonnement.
                                </p>
                            </div>

                            {/* Status cards */}
                            <div className="space-y-2">
                                {[
                                    { value: 'active', label: 'Actif', desc: 'Opérations modifiables', color: 'emerald' },
                                    {
                                        value: 'stopped',
                                        label: 'Arrêté',
                                        desc: 'Opérations verrouillées, paiements autorisés',
                                        color: 'slate',
                                    },
                                    {
                                        value: 'completed',
                                        label: 'Terminé',
                                        desc: 'Abonnement entièrement consommé',
                                        color: 'blue',
                                    },
                                ].map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                                            newSubscriptionStatus === opt.value
                                                ? `border-${opt.color}-300 bg-${opt.color}-50/50 dark:border-${opt.color}-500/30 dark:bg-${opt.color}-500/5`
                                                : 'border-slate-100 hover:border-slate-200 dark:border-slate-700/30 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="subscriptionStatus"
                                            value={opt.value}
                                            checked={newSubscriptionStatus === opt.value}
                                            onChange={() => setNewSubscriptionStatus(opt.value as 'active' | 'completed' | 'stopped')}
                                            className="form-radio text-primary"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{opt.label}</p>
                                            <p className="text-[11px] text-slate-400">{opt.desc}</p>
                                        </div>
                                        <div className={`h-2.5 w-2.5 rounded-full bg-${opt.color}-500`} />
                                    </label>
                                ))}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Raison (optionnel)</label>
                                <textarea
                                    className="form-textarea rounded-lg"
                                    value={subscriptionStatusNote}
                                    onChange={(e) => setSubscriptionStatusNote(e.target.value)}
                                    rows={2}
                                    placeholder="Raison du changement de statut"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => setShowSubscriptionStatusModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                                onClick={handleUpdateSubscriptionStatus}
                            >
                                Mettre à jour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Operation Status Modal */}
            {showOperationStatusModal && editingOperationStatus && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowOperationStatusModal(false)}>
                    <div className="w-full max-w-lg rounded-xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h5 className="text-base font-bold text-slate-800 dark:text-white">Opération #{editingOperationStatus.index + 1}</h5>
                                <p className="mt-0.5 text-xs text-slate-400">Changer le statut de l&apos;opération</p>
                            </div>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                onClick={() => setShowOperationStatusModal(false)}
                            >
                                <IconX />
                            </button>
                        </div>
                        <div className="space-y-4 p-6">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nouveau Statut *</label>
                                <select className="form-select rounded-lg" value={operationStatus} onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'registered') {
                                        // Redirect to the article registration page
                                        setShowOperationStatusModal(false);
                                        const clientId = typeof order.customerId === 'object' ? (order.customerId as any)._id : order.customerId;
                                        const returnTo = typeof window !== 'undefined' ? window.location.pathname : '';
                                        window.location.href = `/apps/registrations/new?orderId=${order._id}&clientId=${clientId}&opIndex=${editingOperationStatus.index}&returnTo=${encodeURIComponent(returnTo)}`;
                                        return;
                                    }
                                    setOperationStatus(val);
                                }}>
                                    <option value="pending">En attente</option>
                                    <option value="registered">Enregistrement →</option>
                                    <option value="processing">En traitement</option>
                                    <option value="ready_for_delivery">Prêt pour livraison</option>
                                    <option value="out_for_delivery">En cours de livraison</option>
                                    <option value="not_delivered">Pas livré</option>
                                    <option value="delivered">Livré</option>
                                    <option value="returned">Retourné</option>
                                    <option value="cancelled">Annulé</option>
                                </select>
                            </div>

                            {/* Inline clothes fields removed — user is redirected to full registration page */}

                            {operationStatus === 'ready_for_delivery' && (
                                <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400">
                                    <strong>Important :</strong> Les détails des vêtements doivent être confirmés avant &quot;Prêt pour livraison&quot;.
                                </div>
                            )}
                            {/* Pickup agent selector — shown when editing a pickup operation */}
                            {editingOperationStatus?.type === 'pickup' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Agent de récupération</label>
                                    <select className="form-select rounded-lg" value={pickupAgentName} onChange={(e) => setPickupAgentName(e.target.value)}>
                                        <option value="">— Sélectionner un livreur —</option>
                                        {deliveryPersons.map((dp) => (
                                            <option key={dp._id} value={dp.name}>
                                                {dp.name} {dp.zone ? `(${dp.zone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-slate-400">Sélectionnez qui prend en charge la récupération</p>
                                </div>
                            )}
                            {operationStatus === 'out_for_delivery' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Agent de livraison *</label>
                                    <select className="form-select rounded-lg" value={deliveryAgentName} onChange={(e) => setDeliveryAgentName(e.target.value)}>
                                        <option value="">— Sélectionner un livreur —</option>
                                        {deliveryPersons.map((dp) => (
                                            <option key={dp._id} value={dp.name}>
                                                {dp.name} {dp.zone ? `(${dp.zone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-slate-400">Obligatoire — sélectionnez qui prend en charge la livraison</p>
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Note (optionnel)</label>
                                <textarea
                                    className="form-textarea rounded-lg"
                                    value={operationNote}
                                    onChange={(e) => setOperationNote(e.target.value)}
                                    rows={2}
                                    placeholder="Notes sur le changement de statut"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => setShowOperationStatusModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                                onClick={handleUpdateOperationStatus}
                            >
                                Mettre à jour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clothes Details Modal */}
            {showClothesModal && editingClothes && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowClothesModal(false)}>
                    <div className="w-full max-w-lg rounded-xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700/50 dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h5 className="text-base font-bold text-slate-800 dark:text-white">Détails des Vêtements</h5>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Opération #{editingClothes.index + 1} — {editingClothes.type === 'pickup' ? 'Récupération' : 'Livraison'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                onClick={() => setShowClothesModal(false)}
                            >
                                <IconX />
                            </button>
                        </div>
                        <div className="space-y-4 p-6">
                            {order && getPackLimits(order.packName, packsData).total > 0 && (
                                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Limites du pack :</strong> {getPackLimits(order.packName, packsData).total} total · {getPackLimits(order.packName, packsData).ordinaires} ordinaires ·{' '}
                                        {getPackLimits(order.packName, packsData).couettes} couette(s) · {getPackLimits(order.packName, packsData).vestes} veste(s) ·{' '}
                                        {getPackLimits(order.packName, packsData).draps_serviettes} draps/serv.
                                    </p>
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Ordinaires *</label>
                                <input type="number" className="form-input rounded-lg" value={clothesTotal} onChange={(e) => setClothesTotal(e.target.value)} placeholder="Ex: 25" min="0" />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Articles spéciaux</label>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-700/30">
                                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Couettes</label>
                                        <input
                                            type="number"
                                            className="form-input rounded-lg text-center text-sm"
                                            value={clothesCouettes}
                                            onChange={(e) => setClothesCouettes(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-700/30">
                                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Vestes</label>
                                        <input
                                            type="number"
                                            className="form-input rounded-lg text-center text-sm"
                                            value={clothesVestes}
                                            onChange={(e) => setClothesVestes(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-700/30">
                                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Draps</label>
                                        <input
                                            type="number"
                                            className="form-input rounded-lg text-center text-sm"
                                            value={clothesDraps}
                                            onChange={(e) => setClothesDraps(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <span className="mt-0.5 block text-[8px] text-slate-400">1 000 FCFA/surplus</span>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-3 text-center dark:border-slate-700/30">
                                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Serviettes</label>
                                        <input
                                            type="number"
                                            className="form-input rounded-lg text-center text-sm"
                                            value={clothesServiettes}
                                            onChange={(e) => setClothesServiettes(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <span className="mt-0.5 block text-[8px] text-slate-400">700 FCFA/surplus</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total de vêtements</span>
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                        {(parseInt(clothesTotal) || 0) +
                                            (parseInt(clothesCouettes) || 0) +
                                            (parseInt(clothesVestes) || 0) +
                                            (parseInt(clothesDraps) || 0) +
                                            (parseInt(clothesServiettes) || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/50">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={() => setShowClothesModal(false)}
                            >
                                Annuler
                            </button>
                            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90" onClick={handleSaveClothesDetails}>
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Modals;
