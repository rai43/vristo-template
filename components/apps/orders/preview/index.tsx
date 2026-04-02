'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    addPayment,
    type ClothesDetail,
    deletePayment,
    getOrderByOrderId,
    type Order,
    type OrderStatus,
    recalculateTotalPrice,
    updateOperation,
    updateOrderStatus,
    updateSubscriptionStatus,
} from '@/lib/api/orders';
import { getPacks, type Pack } from '@/lib/api/packs';
import { registrationsApi } from '@/lib/api/article-registrations';

import ActionBar from './ActionBar';
import InvoiceSection from './InvoiceSection';
import InvoicePDF, { PAPER_SIZES, type PaperSize } from './InvoicePDF';
import PaymentPanel from './PaymentPanel';
import StatusPanel from './StatusPanel';
import { OperationsTable, PackUsage } from './OperationsSection';
import SurplusSection from './SurplusSection';
import WhatsAppSummary from './WhatsAppSummary';
import Modals from './Modals';
import ClientFeedbackSection from './ClientFeedbackSection';
import { getPackLimits } from './utils';

interface OrderPreviewProps {
    orderId?: string;
}

const ComponentsAppsOrderPreview = ({ orderId }: OrderPreviewProps) => {
    const queryClient = useQueryClient();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const printRef = useRef<HTMLDivElement>(null); // screen invoice ref
    const pdfRef = useRef<HTMLDivElement>(null); // off-screen InvoicePDF ref
    const [paperSize, setPaperSize] = useState<PaperSize>('a4');
    const [packsMap, setPacksMap] = useState<Record<string, string>>({});
    const [packsData, setPacksData] = useState<Pack[]>([]);

    // Payment management
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNote, setPaymentNote] = useState('');

    // Status management
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState<OrderStatus>('registered');
    const [statusNote, setStatusNote] = useState('');

    // Subscription status management
    const [showSubscriptionStatusModal, setShowSubscriptionStatusModal] = useState(false);
    const [newSubscriptionStatus, setNewSubscriptionStatus] = useState<'active' | 'completed' | 'stopped'>('active');
    const [subscriptionStatusNote, setSubscriptionStatusNote] = useState('');

    // Operation date editing
    const [editingOperation, setEditingOperation] = useState<{
        type: 'pickup' | 'delivery';
        index: number;
    } | null>(null);
    const [editDate, setEditDate] = useState('');

    // Operation status management
    const [showOperationStatusModal, setShowOperationStatusModal] = useState(false);
    const [editingOperationStatus, setEditingOperationStatus] = useState<{
        type: 'pickup' | 'delivery';
        index: number;
    } | null>(null);
    const [operationStatus, setOperationStatus] = useState('');
    const [operationNote, setOperationNote] = useState('');
    const [deliveryAgentName, setDeliveryAgentName] = useState('');
    const [pickupAgentName, setPickupAgentName] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');

    // Operation clothes editing
    const [showClothesModal, setShowClothesModal] = useState(false);
    const [editingClothes, setEditingClothes] = useState<{ type: 'pickup' | 'delivery'; index: number } | null>(null);
    const [clothesTotal, setClothesTotal] = useState('');
    const [clothesCouettes, setClothesCouettes] = useState('');
    const [clothesVestes, setClothesVestes] = useState('');
    const [clothesDraps, setClothesDraps] = useState('');
    const [clothesServiettes, setClothesServiettes] = useState('');

    useEffect(() => {
        if (orderId) {
            fetchOrder(orderId);
        }
        getPacks(true)
            .then((res) => {
                const allPacks = Array.isArray(res.data) ? res.data : [];
                const map: Record<string, string> = {};
                allPacks.forEach((p: Pack) => {
                    map[p.code] = p.name;
                });
                setPacksMap(map);
                setPacksData(allPacks);
            })
            .catch(() => {});
    }, [orderId]);

    const resolvePackName = (code?: string) => {
        if (!code) return '';
        return packsMap[code] || code;
    };

    const fetchOrder = async (id: string) => {
        try {
            setLoading(true);
            const response = await getOrderByOrderId(id);
            setOrder(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching order:', error);
            setOrder(null);
            setLoading(false);
        }
    };

    // Payment mutation
    const paymentMutation = useMutation({
        mutationFn: (data: { amount: number; method: string; reference?: string; note?: string }) => addPayment(order!._id, data),
        onSuccess: (response) => {
            setOrder(response.data);
            setShowPaymentModal(false);
            setPaymentAmount('');
            setPaymentReference('');
            setPaymentNote('');
            Swal.fire('Succès!', 'Paiement ajouté avec succès', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: () => {
            Swal.fire('Erreur', "Échec de l'ajout du paiement", 'error');
        },
    });

    // Delete payment mutation
    const deletePaymentMutation = useMutation({
        mutationFn: ({ paymentIndex, reason }: { paymentIndex: number; reason?: string }) => deletePayment(order!._id, paymentIndex, reason),
        onSuccess: (response) => {
            setOrder(response.data);
            Swal.fire('Succès!', 'Paiement supprimé avec succès', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: () => {
            Swal.fire('Erreur', 'Échec de la suppression du paiement', 'error');
        },
    });

    // Status mutation
    const statusMutation = useMutation({
        mutationFn: (data: { status: OrderStatus; note?: string }) => updateOrderStatus(order!._id, data.status, data.note),
        onSuccess: (response) => {
            setOrder(response.data);
            setShowStatusModal(false);
            setStatusNote('');
            Swal.fire('Succès!', 'Statut mis à jour avec succès', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: () => {
            Swal.fire('Erreur', 'Échec de la mise à jour du statut', 'error');
        },
    });

    const handleAddPayment = () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) {
            Swal.fire('Erreur', 'Veuillez entrer un montant valide', 'error');
            return;
        }
        const remaining = order!.totalPrice - (order!.totalPaid || 0);
        if (amount > remaining) {
            Swal.fire('Erreur', `Le montant ne peut pas dépasser le montant restant: ${remaining.toLocaleString()} FCFA`, 'error');
            return;
        }
        paymentMutation.mutate({
            amount,
            method: paymentMethod,
            reference: paymentReference || undefined,
            note: paymentNote || undefined,
        });
    };

    const handleDeletePayment = async (paymentIndex: number, payment: any) => {
        const result = await Swal.fire({
            title: 'Supprimer ce paiement?',
            html: `
                <div class="text-left space-y-3">
                    <p>Montant: <strong>${payment.amount.toLocaleString()} FCFA</strong></p>
                    <p>Méthode: <strong>${payment.method}</strong></p>
                    ${payment.reference ? `<p>Référence: <strong>${payment.reference}</strong></p>` : ''}
                    <div class="mt-4">
                        <label class="block text-sm font-medium mb-1">Raison de la suppression (optionnel)</label>
                        <textarea id="delete-reason" class="form-textarea w-full" rows="2" placeholder="Ex: Erreur de saisie, paiement annulé..."></textarea>
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e74c3c',
            preConfirm: () => {
                const reasonInput = document.getElementById('delete-reason') as HTMLTextAreaElement;
                return { reason: reasonInput.value || undefined };
            },
        });
        if (result.isConfirmed) {
            deletePaymentMutation.mutate({ paymentIndex, reason: result.value?.reason });
        }
    };

    const handleUpdateStatus = () => {
        statusMutation.mutate({ status: newStatus, note: statusNote || undefined });
    };

    const handleUpdateSubscriptionStatus = async () => {
        try {
            const response = await updateSubscriptionStatus(order!._id, newSubscriptionStatus, subscriptionStatusNote || undefined);
            setOrder(response.data);
            setShowSubscriptionStatusModal(false);
            setSubscriptionStatusNote('');
            Swal.fire('Succès!', "Statut d'abonnement mis à jour", 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        } catch (error) {
            Swal.fire('Erreur', 'Échec de la mise à jour du statut', 'error');
        }
    };

    const handleEditOperationDate = (operationType: 'pickup' | 'delivery', operationIndex: number, currentDate: string) => {
        if (order?.type === 'subscription' && order?.subscriptionStatus !== 'active') {
            Swal.fire('Attention', "Impossible de modifier la date. L'abonnement n'est pas actif.", 'warning');
            return;
        }
        setEditingOperation({ type: operationType, index: operationIndex });
        setEditDate(new Date(currentDate).toISOString().split('T')[0]);
    };

    const handleSaveOperationDate = async () => {
        if (!editingOperation || !editDate) return;
        try {
            const response = await updateOperation(order!._id, editingOperation.type, editingOperation.index, { date: editDate });
            setOrder(response.data);
            setEditingOperation(null);
            setEditDate('');
            Swal.fire('Succès!', 'Date mise à jour avec succès', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        } catch (error: any) {
            Swal.fire('Erreur', error?.response?.data?.message || 'Échec de la mise à jour de la date', 'error');
        }
    };

    const handleOpenOperationStatusModal = (type: 'pickup' | 'delivery', index: number, currentStatus?: string) => {
        if (order?.subscriptionStatus !== 'active') {
            Swal.fire('Attention', "Impossible de modifier le statut. L'abonnement n'est pas actif.", 'warning');
            return;
        }
        setEditingOperationStatus({ type, index });
        setOperationStatus(currentStatus || 'pending');
        setOperationNote('');
        // Pre-fill agents and scheduled time from current operation
        const schedule = type === 'pickup' ? order?.pickupSchedule : order?.deliverySchedule;
        const currentOp = schedule?.[index] as any;
        setDeliveryAgentName(currentOp?.deliveryAgent || '');
        setPickupAgentName(currentOp?.pickupAgent || '');
        setScheduledTime(currentOp?.scheduledTime || currentOp?.preferredTime || '');
        setShowOperationStatusModal(true);
    };

    const handleUpdateOperationStatus = async () => {
        if (!editingOperationStatus || !order) return;
        const { type, index } = editingOperationStatus;
        const schedule = type === 'pickup' ? order.pickupSchedule : order.deliverySchedule;
        const operation = schedule?.[index];
        let clothesCount = operation?.clothesCount;
        let clothesDetails = operation?.clothesDetails;

        try {
            // 'registered' is handled by redirect to registration page — should not reach here
            if (operationStatus === 'registered') {
                const clientId = typeof order.customerId === 'object' ? (order.customerId as any)._id : order.customerId;
                const returnTo = typeof window !== 'undefined' ? window.location.pathname : '';
                window.location.href = `/apps/registrations/new?orderId=${order._id}&clientId=${clientId}&opIndex=${index}&returnTo=${encodeURIComponent(returnTo)}`;
                return;
            }

            // Clothes required for 'ready_for_delivery'
            if (operationStatus === 'ready_for_delivery') {
                if (!clothesCount || !clothesDetails || clothesDetails.length === 0) {
                    setShowOperationStatusModal(false);
                    setEditingClothes({ type, index });
                    const couettes = clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0;
                    const vestes = clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0;
                    const drapsCombined = clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
                    const drapsSep = clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
                    const serviettesSep = clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
                    const ordinaires = Math.max(0, (clothesCount || 0) - couettes - vestes - drapsCombined - drapsSep - serviettesSep);
                    setClothesTotal(ordinaires > 0 ? ordinaires.toString() : '');
                    setClothesCouettes(couettes.toString());
                    setClothesVestes(vestes.toString());
                    setClothesDraps(drapsCombined > 0 ? Math.ceil(drapsCombined / 2).toString() : drapsSep.toString());
                    setClothesServiettes(drapsCombined > 0 ? Math.floor(drapsCombined / 2).toString() : serviettesSep.toString());
                    setShowClothesModal(true);
                    Swal.fire('Information', 'Les détails des vêtements doivent être confirmés avant "Prêt livraison"', 'info');
                    return;
                }
            }

            // Delivery agent required for 'out_for_delivery'
            if (operationStatus === 'out_for_delivery' && !deliveryAgentName.trim()) {
                Swal.fire('Erreur', "Le nom de l'agent de livraison est obligatoire", 'error');
                return;
            }

            const currentOpStatus = (operation as any)?.status || 'pending';
            const statusChanged = operationStatus !== currentOpStatus;

            const response = await updateOperation(order._id, type, index, {
                ...(statusChanged && { status: operationStatus }),
                note: operationNote || undefined,
                ...(scheduledTime.trim() && { scheduledTime: scheduledTime.trim() }),
                ...(pickupAgentName.trim() && { pickupAgent: pickupAgentName.trim() }),
                ...(deliveryAgentName.trim() && { deliveryAgent: deliveryAgentName.trim() }),
                ...(clothesCount && { clothesCount }),
                ...(clothesDetails && { clothesDetails }),
            });

            setOrder(response.data);
            setShowOperationStatusModal(false);
            setEditingOperationStatus(null);
            setOperationNote('');
            setDeliveryAgentName('');
            setPickupAgentName('');
            setScheduledTime('');
            Swal.fire('Succès!', 'Statut mis à jour avec succès', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        } catch (error: any) {
            Swal.fire('Erreur', error?.response?.data?.message || 'Échec de la mise à jour du statut', 'error');
        }
    };

    const handleOpenClothesModal = (type: 'pickup' | 'delivery', index: number) => {
        if (order?.subscriptionStatus !== 'active') {
            Swal.fire('Attention', "Impossible de modifier. L'abonnement n'est pas actif.", 'warning');
            return;
        }
        const schedule = type === 'pickup' ? order!.pickupSchedule : order!.deliverySchedule;
        const operation = schedule?.[index];
        setEditingClothes({ type, index });
        const couettes = operation?.clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0;
        const vestes = operation?.clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0;
        const drapsCombined = operation?.clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
        const drapsSep = operation?.clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
        const serviettesSep = operation?.clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
        const totalCount = operation?.clothesCount || 0;
        const ordinaires = Math.max(0, totalCount - couettes - vestes - drapsCombined - drapsSep - serviettesSep);
        setClothesTotal(ordinaires > 0 ? ordinaires.toString() : '');
        setClothesCouettes(couettes.toString());
        setClothesVestes(vestes.toString());
        setClothesDraps(drapsCombined > 0 ? Math.ceil(drapsCombined / 2).toString() : drapsSep.toString());
        setClothesServiettes(drapsCombined > 0 ? Math.floor(drapsCombined / 2).toString() : serviettesSep.toString());
        setShowClothesModal(true);
    };

    const handleRecalculatePrice = async () => {
        if (!order) return;
        try {
            const itemsSubtotal = order.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
            const deliveryFees =
                order.type === 'subscription'
                    ? (order.deliverySchedule || []).reduce((sum: number, op: any) => sum + (op.fee || 0), 0)
                    : (order.delivery?.enabled ? order.delivery?.fee || 0 : 0) + (order.pickup?.enabled ? order.pickup?.fee || 0 : 0);
            const expectedTotal = itemsSubtotal + deliveryFees;

            const result = await Swal.fire({
                title: 'Recalculer le total?',
                html: `
                    <div class="text-left space-y-3">
                        <p>Cette action recalculera le prix total de la commande.</p>
                        <div class="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
                            <div class="text-sm space-y-1">
                                <div class="flex justify-between"><span>Articles (pack + add-ons):</span><strong>${itemsSubtotal.toLocaleString()} FCFA</strong></div>
                                ${deliveryFees > 0 ? `<div class="flex justify-between"><span>Frais de livraison:</span><strong>${deliveryFees.toLocaleString()} FCFA</strong></div>` : ''}
                                <div class="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-700"><span class="font-semibold">Nouveau total:</span><strong class="text-success">${expectedTotal.toLocaleString()} FCFA</strong></div>
                            </div>
                        </div>
                        <p class="text-sm text-warning">Le nouveau montant remplacera l'ancien (${order.totalPrice.toLocaleString()} FCFA) dans la base de données.</p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Oui, recalculer',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#00ab55',
            });

            if (result.isConfirmed) {
                const response = await recalculateTotalPrice(order._id);
                setOrder(response.data.order);
                queryClient.invalidateQueries({ queryKey: ['orders'] });
                await Swal.fire({
                    title: 'Succès!',
                    html: `
                        <div class="text-left space-y-2">
                            <p>Le prix total a été recalculé avec succès.</p>
                            <div class="rounded bg-gray-100 p-3 dark:bg-gray-700 mt-3">
                                <div class="flex justify-between mb-1"><span>Ancien total:</span><strong>${response.data.oldTotalPrice.toLocaleString()} FCFA</strong></div>
                                <div class="flex justify-between"><span>Nouveau total:</span><strong class="text-success">${response.data.newTotalPrice.toLocaleString()} FCFA</strong></div>
                                <div class="flex justify-between mt-2 pt-2 border-t"><span>Différence:</span><strong class="${response.data.difference >= 0 ? 'text-success' : 'text-danger'}">${
                        response.data.difference >= 0 ? '+' : ''
                    }${response.data.difference.toLocaleString()} FCFA</strong></div>
                            </div>
                        </div>
                    `,
                    icon: 'success',
                });
            }
        } catch (error: any) {
            console.error('Recalculate error:', error);
            Swal.fire('Erreur', error?.response?.data?.message || 'Échec du recalcul', 'error');
        }
    };

    const handleDeleteRegistration = async (operationIndex: number) => {
        if (!order) return;
        const confirm = await Swal.fire({
            title: "Supprimer l'enregistrement ?",
            html: `<p>Cela supprimera l'enregistrement d'articles de l'<b>opération ${operationIndex + 1}</b> et réinitialisera les vêtements.</p><p class="text-sm text-danger mt-2">Cette action est irréversible.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e74c3c',
        });
        if (!confirm.isConfirmed) return;
        try {
            // Find the registration for this order + operation
            const regs = await registrationsApi.getByOrder(order._id);
            const reg = regs.find((r) => r.operationIndex === operationIndex);
            if (!reg) {
                Swal.fire('Info', 'Aucun enregistrement trouvé pour cette opération', 'info');
                return;
            }
            await registrationsApi.delete(reg._id);
            // Refresh the order data
            if (orderId) await fetchOrder(orderId);
            queryClient.invalidateQueries({ queryKey: ['registrations'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            Swal.fire('Supprimé !', "L'enregistrement a été supprimé", 'success');
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || "Échec de la suppression de l'enregistrement", 'error');
        }
    };

    const handleSaveClothesDetails = async () => {
        if (!editingClothes || !order) return;
        const ordinaires = parseInt(clothesTotal) || 0;
        const couettes = parseInt(clothesCouettes) || 0;
        const vestes = parseInt(clothesVestes) || 0;
        const draps = parseInt(clothesDraps) || 0;
        const serviettes = parseInt(clothesServiettes) || 0;
        const total = ordinaires + couettes + vestes + draps + serviettes;

        if (total === 0) {
            Swal.fire('Erreur', 'Le nombre total de vêtements est requis', 'error');
            return;
        }

        const limits = getPackLimits(order.packName, packsData);
        if (limits.total > 0) {
            const { type, index } = editingClothes;
            const totalUsedCouettes =
                order.pickupSchedule?.reduce((sum, p, i) => (type === 'pickup' && i === index ? sum : sum + (p.clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0)), 0) || 0;
            const totalUsedVestes =
                order.pickupSchedule?.reduce((sum, p, i) => (type === 'pickup' && i === index ? sum : sum + (p.clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0)), 0) || 0;
            const totalUsedDraps =
                order.pickupSchedule?.reduce((sum, p, i) => {
                    if (type === 'pickup' && i === index) return sum;
                    const combined = p.clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
                    const dSep = p.clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
                    const sSep = p.clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
                    return sum + combined + dSep + sSep;
                }, 0) || 0;

            const errors: string[] = [];
            const suggestions: string[] = [];

            if (totalUsedCouettes + couettes > limits.couettes) {
                const available = limits.couettes - totalUsedCouettes;
                errors.push(`Couettes: ${couettes} demandé, limite totale dépassée (${totalUsedCouettes + couettes}/${limits.couettes})`);
                if (available > 0) suggestions.push(`Couettes: Maximum ${available} peuvent être ajoutés`);
            }
            if (totalUsedVestes + vestes > limits.vestes) {
                const available = limits.vestes - totalUsedVestes;
                errors.push(`Vestes: ${vestes} demandé, limite totale dépassée (${totalUsedVestes + vestes}/${limits.vestes})`);
                if (available > 0) suggestions.push(`Vestes: Maximum ${available} peuvent être ajoutés`);
            }
            if (totalUsedDraps + draps + serviettes > limits.draps_serviettes) {
                const available = limits.draps_serviettes - totalUsedDraps;
                errors.push(`Draps & Serviettes: ${draps + serviettes} demandé, limite totale dépassée (${totalUsedDraps + draps + serviettes}/${limits.draps_serviettes})`);
                if (available > 0) suggestions.push(`Draps & Serviettes: Maximum ${available} peuvent être ajoutés`);
            }

            if (errors.length > 0) {
                const result = await Swal.fire({
                    title: '⚠️ Limites du pack dépassées',
                    html: `
                        <div class="text-left space-y-3">
                            <div class="rounded-lg bg-danger-light p-3 dark:bg-danger/20">
                                <div class="text-sm text-danger font-semibold mb-2">Dépassements détectés:</div>
                                <ul class="list-disc list-inside text-xs text-danger space-y-1">${errors.map((e) => `<li>${e}</li>`).join('')}</ul>
                            </div>
                            ${
                                suggestions.length > 0
                                    ? `
                                <div class="rounded-lg bg-success-light p-3 dark:bg-success/20">
                                    <div class="text-sm text-success font-semibold mb-2">Ce qui peut être sauvegardé:</div>
                                    <ul class="list-disc list-inside text-xs text-success space-y-1">${suggestions.map((s) => `<li>${s}</li>`).join('')}</ul>
                                </div>
                            `
                                    : ''
                            }
                            <div class="text-xs text-gray-500 dark:text-gray-400">Les dépassements seront facturés comme surplus.</div>
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sauvegarder quand même',
                    cancelButtonText: 'Annuler',
                    confirmButtonColor: '#e2a03f',
                });
                if (!result.isConfirmed) return;
            }
        }

        const clothesDetails: ClothesDetail[] = [];
        if (couettes > 0) clothesDetails.push({ category: 'special', name: 'Couettes', quantity: couettes });
        if (vestes > 0) clothesDetails.push({ category: 'special', name: 'Vestes', quantity: vestes });
        if (draps > 0) clothesDetails.push({ category: 'special', name: 'Draps', quantity: draps });
        if (serviettes > 0) clothesDetails.push({ category: 'special', name: 'Serviettes', quantity: serviettes });

        const { type, index } = editingClothes;

        try {
            const response = await updateOperation(order._id, type, index, { clothesCount: total, clothesDetails });
            setOrder(response.data);
            setShowClothesModal(false);
            setEditingClothes(null);
            Swal.fire('Succès!', 'Détails des vêtements mis à jour', 'success');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (editingOperationStatus) {
                handleUpdateOperationStatus();
            }
        } catch (error: any) {
            Swal.fire('Erreur', error?.response?.data?.message || 'Échec de la mise à jour', 'error');
        }
    };

    const generatePDF = async (mode: 'download' | 'print' = 'download') => {
        if (!pdfRef.current || !order) return;
        setIsGeneratingPdf(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const ps = PAPER_SIZES[paperSize];
            const opt = {
                margin: [8, 8, 8, 8] as [number, number, number, number],
                filename: `MIRAI-${order.orderId}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    windowWidth: Math.round(ps.w * 3.7795),
                },
                jsPDF: {
                    unit: 'mm' as const,
                    format: 'a4' as const, // overridden below via jspdf directly
                    orientation: 'portrait' as const,
                    compress: true,
                },
                pagebreak: { mode: ['css', 'legacy'] },
            };
            if (mode === 'download') {
                await html2pdf().set(opt).from(pdfRef.current).save();
            } else {
                const pdfBlob = await html2pdf().set(opt).from(pdfRef.current).output('blob');
                const url = URL.createObjectURL(pdfBlob as Blob);
                const win = window.open(url, '_blank');
                if (win) {
                    win.addEventListener('load', () => {
                        win.focus();
                        win.print();
                    });
                }
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Erreur', 'Échec de la génération du PDF.', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSend = () => {
        if (!order) return;
        const client = order.customerId as any;
        const phone = client?.phones?.[0]?.number?.replace(/\s+/g, '').replace(/^\+/, '');
        const text = encodeURIComponent(
            `Bonjour ${client?.name || ''},\n\nVoici votre facture MIRAI Services.\nN° Commande : ${order.orderId}\nTotal : ${(order.totalPrice || 0).toLocaleString(
                'fr-FR'
            )} FCFA\n\nMerci pour votre confiance ! 🙏`
        );
        const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
        window.open(url, '_blank');
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-4">Chargement de la commande...</p>
                </div>
            </div>
        );
    }

    // Not found state
    if (!order) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-red-600">Commande introuvable</p>
                    <Link href="/apps/orders/list" className="btn btn-primary mt-4">
                        Retour à la liste
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ActionBar
                order={order}
                isGeneratingPdf={isGeneratingPdf}
                paperSize={paperSize}
                setPaperSize={setPaperSize}
                onPrint={() => generatePDF('print')}
                onDownload={() => generatePDF('download')}
                onSend={handleSend}
            />

            {/* Off-screen professional invoice for PDF generation */}
            <div
                style={{
                    position: 'fixed',
                    left: '-9999px',
                    top: 0,
                    width: `${PAPER_SIZES[paperSize].w * 3.7795}px`,
                    backgroundColor: '#ffffff',
                    zIndex: -1,
                }}
            >
                <InvoicePDF ref={pdfRef} order={order} packsMap={packsMap} packsData={packsData} resolvePackName={resolvePackName} />
            </div>

            <InvoiceSection
                order={order}
                printRef={printRef as React.RefObject<HTMLDivElement>}
                packsMap={packsMap}
                packsData={packsData}
                resolvePackName={resolvePackName}
                handleRecalculatePrice={handleRecalculatePrice}
            />

            {/* Management Panels */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PaymentPanel order={order} onShowPaymentModal={() => setShowPaymentModal(true)} onDeletePayment={handleDeletePayment} />
                <StatusPanel order={order} onChangeStatus={() => (order.type === 'subscription' ? setShowSubscriptionStatusModal(true) : setShowStatusModal(true))} />
            </div>

            <SurplusSection order={order} onOrderUpdate={setOrder} packsData={packsData} />

            <PackUsage order={order} resolvePackName={resolvePackName} packsData={packsData} />

            <OperationsTable
                order={order}
                editingOperation={editingOperation}
                editDate={editDate}
                setEditDate={setEditDate}
                setEditingOperation={setEditingOperation}
                handleEditOperationDate={handleEditOperationDate}
                handleSaveOperationDate={handleSaveOperationDate}
                handleOpenOperationStatusModal={handleOpenOperationStatusModal}
                handleOpenClothesModal={handleOpenClothesModal}
                onDeleteRegistration={handleDeleteRegistration}
            />

            <WhatsAppSummary order={order} resolvePackName={resolvePackName} packsData={packsData} />

            <ClientFeedbackSection order={order} />

            <Modals
                order={order}
                showPaymentModal={showPaymentModal}
                setShowPaymentModal={setShowPaymentModal}
                paymentAmount={paymentAmount}
                setPaymentAmount={setPaymentAmount}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentReference={paymentReference}
                setPaymentReference={setPaymentReference}
                paymentNote={paymentNote}
                setPaymentNote={setPaymentNote}
                handleAddPayment={handleAddPayment}
                paymentMutationPending={paymentMutation.isPending}
                showStatusModal={showStatusModal}
                setShowStatusModal={setShowStatusModal}
                newStatus={newStatus}
                setNewStatus={setNewStatus}
                statusNote={statusNote}
                setStatusNote={setStatusNote}
                handleUpdateStatus={handleUpdateStatus}
                statusMutationPending={statusMutation.isPending}
                showSubscriptionStatusModal={showSubscriptionStatusModal}
                setShowSubscriptionStatusModal={setShowSubscriptionStatusModal}
                newSubscriptionStatus={newSubscriptionStatus}
                setNewSubscriptionStatus={setNewSubscriptionStatus}
                subscriptionStatusNote={subscriptionStatusNote}
                setSubscriptionStatusNote={setSubscriptionStatusNote}
                handleUpdateSubscriptionStatus={handleUpdateSubscriptionStatus}
                showOperationStatusModal={showOperationStatusModal}
                setShowOperationStatusModal={setShowOperationStatusModal}
                editingOperationStatus={editingOperationStatus}
                operationStatus={operationStatus}
                setOperationStatus={setOperationStatus}
                operationNote={operationNote}
                setOperationNote={setOperationNote}
                deliveryAgentName={deliveryAgentName}
                setDeliveryAgentName={setDeliveryAgentName}
                pickupAgentName={pickupAgentName}
                setPickupAgentName={setPickupAgentName}
                scheduledTime={scheduledTime}
                setScheduledTime={setScheduledTime}
                handleUpdateOperationStatus={handleUpdateOperationStatus}
                showClothesModal={showClothesModal}
                setShowClothesModal={setShowClothesModal}
                editingClothes={editingClothes}
                clothesTotal={clothesTotal}
                setClothesTotal={setClothesTotal}
                clothesCouettes={clothesCouettes}
                setClothesCouettes={setClothesCouettes}
                clothesVestes={clothesVestes}
                setClothesVestes={setClothesVestes}
                clothesDraps={clothesDraps}
                setClothesDraps={setClothesDraps}
                clothesServiettes={clothesServiettes}
                setClothesServiettes={setClothesServiettes}
                handleSaveClothesDetails={handleSaveClothesDetails}
                packsData={packsData}
            />
        </div>
    );
};

export default ComponentsAppsOrderPreview;
