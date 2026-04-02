'use client';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { getCustomers, updateCustomer } from '@/lib/api/clients';
import IconHome from '@/components/icon/icon-home';
import IconUser from '@/components/icon/icon-user';

const ComponentsClientsSettings = () => {
    const queryClient = useQueryClient();
    const [tabs, setTabs] = useState<string>('home');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [formData, setFormData] = useState<any>({
        name: '',
        location: '',
        phones: [{ number: '', type: 'both' }],
        personCount: 1,
        isBusiness: false,
        isProspect: false,
        marketingSource: '',
        notes: '',
    });

    const toggleTabs = (name: string) => {
        setTabs(name);
    };

    // Fetch clients
    const { data: clientsData } = useQuery({
        queryKey: ['customers'],
        queryFn: () => getCustomers({ limit: 100 }),
    });

    const clients = clientsData?.data?.data || [];
    const selectedClient = clients.find((c: any) => c._id === selectedClientId);

    // Update form data when client is selected
    useEffect(() => {
        if (selectedClient) {
            setFormData({
                name: selectedClient.name || '',
                location: selectedClient.location || '',
                phones: selectedClient.phones || [{ number: '', type: 'both' }],
                personCount: selectedClient.personCount || 1,
                isBusiness: selectedClient.isBusiness || false,
                isProspect: selectedClient.isProspect || false,
                marketingSource: selectedClient.marketingSource || '',
                notes: selectedClient.notes || '',
            });
        }
    }, [selectedClient]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (data: any) => updateCustomer(selectedClientId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            Swal.fire('Succès!', 'Les informations ont été mises à jour.', 'success');
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue', 'error');
        },
    });

    const handleSave = () => {
        updateMutation.mutate(formData);
    };

    const handleAddPhone = () => {
        setFormData({
            ...formData,
            phones: [...formData.phones, { number: '', type: 'both' }],
        });
    };

    const handleRemovePhone = (index: number) => {
        if (formData.phones.length > 1) {
            const newPhones = formData.phones.filter((_: any, i: number) => i !== index);
            setFormData({ ...formData, phones: newPhones });
        }
    };

    const handlePhoneChange = (index: number, field: 'number' | 'type', value: string) => {
        const newPhones = [...formData.phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setFormData({ ...formData, phones: newPhones });
    };

    return (
        <div className="pt-5">
            {/* Client Selector */}
            <div className="panel mb-5">
                <label htmlFor="clientSelect" className="mb-2 block text-lg font-semibold">
                    Sélectionner un client
                </label>
                <select id="clientSelect" className="form-select" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                    <option value="">-- Choisir un client --</option>
                    {clients.map((client: any) => (
                        <option key={client._id} value={client._id}>
                            {client.name} - {client.customerId}
                        </option>
                    ))}
                </select>
            </div>

            {selectedClient && (
                <div>
                    <div className="mb-5 flex items-center justify-between">
                        <h5 className="text-lg font-semibold dark:text-white-light">Paramètres</h5>
                    </div>
                    <div>
                        <ul className="mb-5 overflow-y-auto whitespace-nowrap border-b border-[#ebedf2] font-semibold dark:border-[#191e3a] sm:flex">
                            <li className="inline-block">
                                <button
                                    onClick={() => toggleTabs('home')}
                                    className={`flex gap-2 border-b border-transparent p-4 hover:border-primary hover:text-primary ${tabs === 'home' ? '!border-primary text-primary' : ''}`}
                                >
                                    <IconHome />
                                    Informations
                                </button>
                            </li>
                            <li className="inline-block">
                                <button
                                    onClick={() => toggleTabs('notes')}
                                    className={`flex gap-2 border-b border-transparent p-4 hover:border-primary hover:text-primary ${tabs === 'notes' ? '!border-primary text-primary' : ''}`}
                                >
                                    <IconUser className="h-5 w-5" />
                                    Notes
                                </button>
                            </li>
                        </ul>
                    </div>
                    {tabs === 'home' && (
                        <div>
                            <form className="mb-5 rounded-md border border-[#ebedf2] bg-white p-4 dark:border-[#191e3a] dark:bg-black">
                                <h6 className="mb-5 text-lg font-bold">Informations Générales</h6>
                                <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="name">Nom Complet</label>
                                        <input
                                            id="name"
                                            type="text"
                                            placeholder="Nom du client"
                                            className="form-input"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="location">Localisation</label>
                                        <input
                                            id="location"
                                            type="text"
                                            placeholder="Adresse"
                                            className="form-input"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="personCount">Nombre de Personnes</label>
                                        <input
                                            id="personCount"
                                            type="number"
                                            min="1"
                                            className="form-input"
                                            value={formData.personCount}
                                            onChange={(e) => setFormData({ ...formData, personCount: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="marketingSource">Source Marketing</label>
                                        <input
                                            id="marketingSource"
                                            type="text"
                                            placeholder="Facebook, Google, etc."
                                            className="form-input"
                                            value={formData.marketingSource}
                                            onChange={(e) => setFormData({ ...formData, marketingSource: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="inline-flex cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={formData.isBusiness}
                                                onChange={(e) => setFormData({ ...formData, isBusiness: e.target.checked })}
                                            />
                                            <span className="relative text-white-dark checked:bg-none">Entreprise</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="inline-flex cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={formData.isProspect}
                                                onChange={(e) => setFormData({ ...formData, isProspect: e.target.checked })}
                                            />
                                            <span className="relative text-white-dark checked:bg-none">Prospect</span>
                                        </label>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-2 block font-semibold">Téléphones</label>
                                        <div className="space-y-2">
                                            {formData.phones.map((phone: any, index: number) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="tel"
                                                        className="form-input flex-1"
                                                        placeholder="Numéro de téléphone"
                                                        value={phone.number}
                                                        onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                                                    />
                                                    <select className="form-select w-40" value={phone.type} onChange={(e) => handlePhoneChange(index, 'type', e.target.value)}>
                                                        <option value="both">Tous</option>
                                                        <option value="call">Appel</option>
                                                        <option value="whatsapp">WhatsApp</option>
                                                    </select>
                                                    {formData.phones.length > 1 && (
                                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRemovePhone(index)}>
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleAddPhone}>
                                                <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path d="M12 5V19M5 12H19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                Ajouter un téléphone
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3 sm:col-span-2">
                                        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                                            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                    {tabs === 'notes' && (
                        <div className="panel">
                            <h6 className="mb-5 text-lg font-bold">Notes</h6>
                            <div className="mb-5">
                                <textarea
                                    rows={6}
                                    className="form-textarea"
                                    placeholder="Ajouter des notes sur ce client..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!selectedClient && (
                <div className="panel">
                    <div className="flex h-64 items-center justify-center">
                        <div className="text-center">
                            <p className="text-lg text-white-dark">Sélectionnez un client pour modifier ses paramètres</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComponentsClientsSettings;
