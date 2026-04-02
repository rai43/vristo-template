'use client';
import IconCalendar from '@/components/icon/icon-calendar';
import IconMapPin from '@/components/icon/icon-map-pin';
import IconMail from '@/components/icon/icon-mail';
import IconPencilPaper from '@/components/icon/icon-pencil-paper';
import IconPhone from '@/components/icon/icon-phone';
import IconUser from '@/components/icon/icon-user';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import React, { useState } from 'react';
import { getCustomers } from '@/lib/api/clients';

const ComponentsClientsProfile = () => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // Fetch clients
    const { data: clientsData } = useQuery({
        queryKey: ['customers'],
        queryFn: () => getCustomers({ limit: 100 }),
    });

    const clients = clientsData?.data?.data || [];
    const selectedClient = clients.find((c: any) => c._id === selectedClientId);

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
                <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3 xl:grid-cols-4">
                    <div className="panel">
                        <div className="mb-5 flex items-center justify-between">
                            <h5 className="text-lg font-semibold dark:text-white-light">Profil Client</h5>
                            <Link href="/management/clients/settings" className="btn btn-primary rounded-full p-2 ltr:ml-auto rtl:mr-auto">
                                <IconPencilPaper />
                            </Link>
                        </div>
                        <div className="mb-5">
                            <div className="flex flex-col items-center justify-center">
                                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">
                                    {selectedClient.name.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-xl font-semibold text-primary">{selectedClient.name}</p>
                            </div>
                            <ul className="m-auto mt-5 flex max-w-[200px] flex-col space-y-4 font-semibold text-white-dark">
                                <li className="flex items-center gap-2">
                                    <IconUser className="shrink-0" />
                                    {selectedClient.isBusiness ? 'Entreprise' : 'Particulier'}
                                </li>
                                <li className="flex items-center gap-2">
                                    <IconCalendar className="shrink-0" />
                                    {new Date(selectedClient.createdAt).toLocaleDateString('fr-FR')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <IconMapPin className="shrink-0" />
                                    {selectedClient.location}
                                </li>
                                <li>
                                    <button className="flex items-center gap-2">
                                        <IconMail className="h-5 w-5 shrink-0" />
                                        <span className="truncate text-primary">{selectedClient.customerId}</span>
                                    </button>
                                </li>
                                {selectedClient.phones?.map((phone: any, idx: number) => (
                                    <li key={idx} className="flex items-center gap-2">
                                        <IconPhone />
                                        <span className="whitespace-nowrap" dir="ltr">
                                            {phone.number}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="panel lg:col-span-2 xl:col-span-3">
                        <div className="mb-5">
                            <h5 className="text-lg font-semibold dark:text-white-light">Informations Détaillées</h5>
                        </div>
                        <div className="mb-5">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                    <div className="font-semibold">ID Client</div>
                                    <div className="font-mono">{selectedClient.customerId}</div>
                                </div>
                                <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                    <div className="font-semibold">Type</div>
                                    <div>
                                        <span className={`badge ${selectedClient.isBusiness ? 'badge-outline-primary' : 'badge-outline-info'}`}>
                                            {selectedClient.isBusiness ? 'Entreprise' : 'Particulier'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                    <div className="font-semibold">Statut</div>
                                    <div>
                                        <span className={`badge ${selectedClient.isProspect ? 'badge-outline-warning' : 'badge-outline-success'}`}>
                                            {selectedClient.isProspect ? 'Prospect' : 'Client'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                    <div className="font-semibold">Nombre de personnes</div>
                                    <div>{selectedClient.personCount}</div>
                                </div>
                                <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                    <div className="font-semibold">Localisation</div>
                                    <div>{selectedClient.location}</div>
                                </div>
                                {selectedClient.marketingSource && (
                                    <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                        <div className="font-semibold">Source Marketing</div>
                                        <div>{selectedClient.marketingSource}</div>
                                    </div>
                                )}
                                {selectedClient.notes && (
                                    <div className="border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                                        <div className="mb-2 font-semibold">Notes</div>
                                        <div className="whitespace-pre-wrap text-white-dark">{selectedClient.notes}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!selectedClient && (
                <div className="panel">
                    <div className="flex h-64 items-center justify-center">
                        <div className="text-center">
                            <p className="text-lg text-white-dark">Sélectionnez un client pour voir son profil</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComponentsClientsProfile;
