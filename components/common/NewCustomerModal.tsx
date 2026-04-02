'use client';

import IconX from '@/components/icon/icon-x';
import { createCustomer, type Customer } from '@/lib/api/clients';
import { type Zone } from '@/lib/api/zones';
import { Dialog, Transition } from '@headlessui/react';
import { useQueryClient } from '@tanstack/react-query';
import React, { Fragment, useState } from 'react';

interface NewCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line no-unused-vars
    onCustomerCreated?: (customer: Customer) => void;
    zones: Zone[];
}

interface NewCustomerForm {
    name: string;
    phone: string;
    location: string;
    zone: string;
    isBusiness: boolean;
    personCount: number;
}

const EMPTY_FORM: NewCustomerForm = {
    name: '',
    phone: '+225 ',
    location: '',
    zone: '',
    isBusiness: false,
    personCount: 1,
};

const NewCustomerModal: React.FC<NewCustomerModalProps> = ({ isOpen, onClose, onCustomerCreated, zones }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<NewCustomerForm>({ ...EMPTY_FORM });
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string>('');

    const resetForm = () => {
        setForm({ ...EMPTY_FORM });
        setError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async () => {
        // Validation
        if (!form.name.trim()) {
            setError('Le nom est requis');
            return;
        }
        if (!form.phone.trim() || form.phone === '+225 ') {
            setError('Le numéro de téléphone est requis');
            return;
        }
        if (!form.location.trim()) {
            setError('La localisation est requise');
            return;
        }

        setIsCreating(true);
        setError('');

        try {
            const response = await createCustomer({
                name: form.name.trim(),
                phones: [{ number: form.phone, type: 'both' as const }],
                location: form.location.trim(),
                zone: form.zone || undefined,
                isBusiness: form.isBusiness,
                personCount: form.personCount,
                isProspect: false,
            });

            // Invalidate customers cache
            queryClient.invalidateQueries({ queryKey: ['customers'] });

            // Call the callback with the new customer
            if (onCustomerCreated) {
                onCustomerCreated(response.data);
            }

            // Reset and close
            handleClose();
        } catch (err: any) {
            console.error('Error creating customer:', err);
            setError(err.response?.data?.message || 'Échec de la création du client');
        } finally {
            setIsCreating(false);
        }
    };

    const isValid = form.name.trim() && form.phone.trim() && form.phone !== '+225 ' && form.location.trim();

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" open={isOpen} onClose={handleClose} className="relative z-[60]">
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/50">
                                    <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">Nouveau client</Dialog.Title>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                                    >
                                        <IconX className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="space-y-4 p-6">
                                    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Nom <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Nom du client"
                                            className="form-input w-full rounded-lg"
                                            value={form.name}
                                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Téléphone <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="+225 XX XX XX XX XX"
                                            className="form-input w-full rounded-lg"
                                            value={form.phone}
                                            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Localisation <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Adresse / Quartier"
                                            className="form-input w-full rounded-lg"
                                            value={form.location}
                                            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Zone de livraison</label>
                                        <select className="form-select w-full rounded-lg" value={form.zone} onChange={(e) => setForm((prev) => ({ ...prev, zone: e.target.value }))}>
                                            <option value="">— Aucune zone —</option>
                                            {(zones ?? []).map((z) => (
                                                <option key={z._id} value={z.name}>
                                                    {z.displayName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Type de client</label>
                                            <select
                                                className="form-select w-full rounded-lg"
                                                value={form.isBusiness.toString()}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        isBusiness: e.target.value === 'true',
                                                    }))
                                                }
                                            >
                                                <option value="false">Particulier</option>
                                                <option value="true">Entreprise</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nb personnes</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={50}
                                                className="form-input w-full rounded-lg"
                                                value={form.personCount}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        personCount: parseInt(e.target.value) || 1,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                                    <button
                                        type="button"
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                        onClick={handleClose}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={handleSubmit}
                                        disabled={isCreating || !isValid}
                                    >
                                        {isCreating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                        {isCreating ? 'Création...' : 'Créer le client'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default NewCustomerModal;
