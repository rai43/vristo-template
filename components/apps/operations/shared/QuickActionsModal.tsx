'use client';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateOperation } from '@/lib/api/orders';
import { DeliveryPerson, getActiveDeliveryPersons } from '@/lib/api/delivery-persons';
import Swal from 'sweetalert2';
import { Operation } from '../types';

interface QuickActionsModalProps {
    operation: Operation | null;
    onClose: () => void;
}

const QuickActionsModal = ({ operation, onClose }: QuickActionsModalProps) => {
    const queryClient = useQueryClient();
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [agentName, setAgentName] = useState('');
    const [newStatus, setNewStatus] = useState('');

    const { data: deliveryPersons } = useQuery({
        queryKey: ['delivery-persons', 'active'],
        queryFn: async () => {
            const res = await getActiveDeliveryPersons();
            return res.data || [];
        },
    });

    useEffect(() => {
        if (operation) {
            setNewDate(operation.date?.split('T')[0] || '');
            setNewTime(operation.scheduledTime || '');
            // Use the appropriate agent field based on operation type
            setAgentName(operation.operationType === 'pickup' ? (operation.pickupAgent || '') : (operation.deliveryAgent || ''));
            setNewStatus(operation.status || '');
        }
    }, [operation]);

    const updateMutation = useMutation({
        mutationFn: async (data: { date?: string; scheduledTime?: string; pickupAgent?: string; deliveryAgent?: string; status?: string }) => {
            if (!operation) throw new Error('No operation selected');
            return updateOperation(operation.orderMongoId, operation.operationType, operation.operationIndex, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operations'] });
            Swal.fire({
                icon: 'success',
                title: 'Mis à jour!',
                text: 'Opération mise à jour avec succès',
                timer: 1500,
                showConfirmButton: false,
            });
            onClose();
        },
        onError: (err: any) => {
            Swal.fire('Erreur', err?.response?.data?.message || 'Échec de la mise à jour', 'error');
        },
    });

    const handleSave = () => {
        const updates: any = {};
        if (newDate && newDate !== operation?.date?.split('T')[0]) updates.date = newDate;
        if (newTime !== operation?.scheduledTime) updates.scheduledTime = newTime || undefined;
        // Send the correct agent field based on operation type
        if (operation?.operationType === 'pickup') {
            const currentAgent = operation?.pickupAgent || '';
            if (agentName !== currentAgent) updates.pickupAgent = agentName || undefined;
        } else {
            const currentAgent = operation?.deliveryAgent || '';
            if (agentName !== currentAgent) updates.deliveryAgent = agentName || undefined;
        }
        if (newStatus && newStatus !== operation?.status) updates.status = newStatus;
        if (Object.keys(updates).length > 0) {
            updateMutation.mutate(updates);
        } else {
            onClose();
        }
    };

    if (!operation) return null;

    const getStatusOptions = () => {
        return [
            { value: 'pending', label: 'En attente' },
            { value: 'registered', label: 'Enregistré' },
            { value: 'processing', label: 'En traitement' },
            { value: 'ready_for_delivery', label: 'Prêt livraison' },
            { value: 'out_for_delivery', label: 'En livraison' },
            { value: 'not_delivered', label: 'Pas livré' },
            { value: 'delivered', label: 'Livré' },
            { value: 'returned', label: 'Retourné' },
            { value: 'cancelled', label: 'Annulé' },
        ];
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-[#1a2234]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Actions rapides</h3>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Operation info */}
                <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${operation.isSubscription ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                            {operation.isSubscription ? 'ABO' : 'ALC'}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${operation.operationType === 'pickup' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {operation.operationType === 'pickup' ? 'Récupération' : 'Livraison'}
                        </span>
                        {operation.isSubscription && (
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-600 dark:text-slate-200">Op {operation.operationIndex + 1}</span>
                        )}
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{operation.customer.name}</div>
                    <div className="text-xs text-slate-400">{operation.orderId}</div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Date prévue</label>
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Heure prévue (optionnel)</label>
                        <input
                            type="time"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {operation.operationType === 'pickup' ? 'Agent de récupération' : 'Agent de livraison'}
                        </label>
                        <select
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                            <option value="">— Non assigné —</option>
                            {deliveryPersons?.map((dp: DeliveryPerson) => (
                                <option key={dp._id} value={dp.name}>
                                    {dp.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Statut</label>
                        <select
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                            {getStatusOptions().map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                        {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickActionsModal;
