'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import Swal from 'sweetalert2';
import { getCustomer, updateCustomer, type Customer } from '@/lib/api/clients';

interface CustomerDetailProps {
    customerId: string;
    onClose: () => void;
}

const CustomerDetail = ({ customerId, onClose }: CustomerDetailProps) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(0);

    // Fetch customer details
    const { data: customer, isLoading } = useQuery({
        queryKey: ['customer', customerId],
        queryFn: () => getCustomer(customerId),
        enabled: !!customerId,
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (data: Partial<Customer>) => updateCustomer(customerId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            Swal.fire('Modifié!', 'Les informations ont été mises à jour.', 'success');
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Une erreur est survenue',
            });
        },
    });

    const [profileForm, setProfileForm] = useState<any>({});
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // Initialize form when customer data loads
    useEffect(() => {
        if (customer?.data) {
            setProfileForm({
                name: customer.data.name || '',
                location: customer.data.location || '',
                phones: customer.data.phones || [{ number: '', type: 'both' }],
                personCount: customer.data.personCount || 1,
                notes: customer.data.notes || '',
            });
        }
    }, [customer]);

    const handleProfileEdit = () => {
        setProfileForm({
            name: customer?.data?.name || '',
            location: customer?.data?.location || '',
            phones: customer?.data?.phones || [{ number: '', type: 'both' }],
            personCount: customer?.data?.personCount || 1,
            notes: customer?.data?.notes || '',
        });
        setIsEditingProfile(true);
    };

    const handleProfileSave = () => {
        updateMutation.mutate(profileForm);
        setIsEditingProfile(false);
    };

    const handleAddPhone = () => {
        setProfileForm({
            ...profileForm,
            phones: [...profileForm.phones, { number: '', type: 'both' }],
        });
    };

    const handleRemovePhone = (index: number) => {
        if (profileForm.phones.length > 1) {
            const newPhones = profileForm.phones.filter((_: any, i: number) => i !== index);
            setProfileForm({ ...profileForm, phones: newPhones });
        }
    };

    const handlePhoneChange = (index: number, field: 'number' | 'type', value: string) => {
        const newPhones = [...profileForm.phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setProfileForm({ ...profileForm, phones: newPhones });
    };

    const handleToggleProspect = () => {
        Swal.fire({
            icon: 'question',
            title: customer?.data?.isProspect ? 'Marquer comme client' : 'Marquer comme prospect',
            text: customer?.data?.isProspect ? 'Ce contact deviendra un client actif.' : 'Ce contact sera marqué comme prospect.',
            showCancelButton: true,
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
        }).then((result) => {
            if (result.isConfirmed) {
                updateMutation.mutate({ isProspect: !customer?.data?.isProspect });
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-l-transparent"></div>
            </div>
        );
    }

    if (!customer?.data) {
        return (
            <div className="panel">
                <div className="text-center">Client non trouvé</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="panel">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white">{customer.data.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h4 className="text-2xl font-semibold">{customer.data.name}</h4>
                            <span className={`badge badge-outline-${customer.data.isProspect ? 'warning' : 'success'}`}>{customer.data.isProspect ? 'Prospect' : 'Client'}</span>
                        </div>
                        <p className="mt-1 text-white-dark">
                            <svg className="mr-1 inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {customer.data.location}
                        </p>
                        <p className="mt-1 text-sm text-white-dark">
                            ID: <span className="font-mono">{customer.data.customerId}</span> • Créé le {new Date(customer.data.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-outline-primary" onClick={handleToggleProspect}>
                            {customer.data.isProspect ? 'Convertir en client' : 'Marquer comme prospect'}
                        </button>
                        <button className="btn btn-outline-danger" onClick={onClose}>
                            Fermer
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="panel">
                <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                    <Tab.List className="mb-5 flex flex-wrap border-b border-white-light dark:border-[#191e3a]">
                        <Tab as="div" className="flex-1">
                            {({ selected }) => (
                                <button className={`${selected ? 'border-b !border-primary text-primary' : ''} -mb-[1px] block border border-transparent p-3.5 py-2 hover:text-primary`}>
                                    Informations
                                </button>
                            )}
                        </Tab>
                        <Tab as="div" className="flex-1">
                            {({ selected }) => (
                                <button className={`${selected ? 'border-b !border-primary text-primary' : ''} -mb-[1px] block border border-transparent p-3.5 py-2 hover:text-primary`}>
                                    Historique
                                </button>
                            )}
                        </Tab>
                        <Tab as="div" className="flex-1">
                            {({ selected }) => (
                                <button className={`${selected ? 'border-b !border-primary text-primary' : ''} -mb-[1px] block border border-transparent p-3.5 py-2 hover:text-primary`}>Notes</button>
                            )}
                        </Tab>
                    </Tab.List>

                    <Tab.Panels>
                        {/* Profile Tab */}
                        <Tab.Panel>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-lg font-semibold">Informations du client</h5>
                                    {!isEditingProfile ? (
                                        <button className="btn btn-primary" onClick={handleProfileEdit}>
                                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                            Modifier
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button className="btn btn-outline-danger" onClick={() => setIsEditingProfile(false)}>
                                                Annuler
                                            </button>
                                            <button className="btn btn-success" onClick={handleProfileSave}>
                                                Enregistrer
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block font-semibold">Nom complet</label>
                                        {isEditingProfile ? (
                                            <input type="text" className="form-input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                                        ) : (
                                            <p className="rounded-md border border-white-light bg-white-light/20 p-3 dark:border-[#1b2e4b]">{customer.data.name}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-2 block font-semibold">Nombre de personnes</label>
                                        {isEditingProfile ? (
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={profileForm.personCount}
                                                onChange={(e) => setProfileForm({ ...profileForm, personCount: parseInt(e.target.value) || 1 })}
                                                min="1"
                                                max="50"
                                            />
                                        ) : (
                                            <p className="rounded-md border border-white-light bg-white-light/20 p-3 dark:border-[#1b2e4b]">{customer.data.personCount}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-2 block font-semibold">Adresse / Localisation</label>
                                        {isEditingProfile ? (
                                            <input type="text" className="form-input" value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} />
                                        ) : (
                                            <p className="rounded-md border border-white-light bg-white-light/20 p-3 dark:border-[#1b2e4b]">{customer.data.location}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-2 block font-semibold">Téléphones</label>
                                        {isEditingProfile ? (
                                            <div className="space-y-2">
                                                {profileForm.phones?.map((phone: any, index: number) => (
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
                                                        {profileForm.phones.length > 1 && (
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
                                        ) : (
                                            <div className="space-y-2">
                                                {customer.data.phones?.map((phone: any, idx: number) => (
                                                    <p key={idx} className="rounded-md border border-white-light bg-white-light/20 p-3 dark:border-[#1b2e4b]">
                                                        {phone.number}
                                                        <span className="ml-2 text-sm text-white-dark">({phone.type === 'whatsapp' ? 'WhatsApp' : phone.type === 'call' ? 'Appel' : 'Tous'})</span>
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Tab.Panel>

                        {/* History Tab */}
                        <Tab.Panel>
                            <div className="space-y-4">
                                <h5 className="text-lg font-semibold">Historique des commandes</h5>
                                <div className="rounded-md border border-white-light p-8 text-center dark:border-[#1b2e4b]">
                                    <svg className="mx-auto mb-4 h-16 w-16 text-white-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path
                                            d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    <p className="text-white-dark">Aucune commande enregistrée</p>
                                    <p className="mt-2 text-sm text-white-dark">L&apos;historique des commandes apparaîtra ici</p>
                                </div>
                            </div>
                        </Tab.Panel>

                        {/* Notes Tab */}
                        <Tab.Panel>
                            <div className="space-y-4">
                                <h5 className="text-lg font-semibold">Notes</h5>
                                {isEditingProfile ? (
                                    <textarea
                                        className="form-textarea"
                                        rows={6}
                                        value={profileForm.notes}
                                        onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                                        placeholder="Ajouter des notes sur ce client..."
                                    />
                                ) : (
                                    <div className="rounded-md border border-white-light bg-white-light/20 p-4 dark:border-[#1b2e4b]">
                                        {customer.data.notes ? <p className="whitespace-pre-wrap">{customer.data.notes}</p> : <p className="text-white-dark">Aucune note</p>}
                                    </div>
                                )}
                                {!isEditingProfile && (
                                    <button className="btn btn-primary" onClick={handleProfileEdit}>
                                        {customer.data.notes ? 'Modifier les notes' : 'Ajouter des notes'}
                                    </button>
                                )}
                            </div>
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>
            </div>
        </div>
    );
};

export default CustomerDetail;


