'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

interface PhoneInput {
    number: string;
    type: 'call' | 'whatsapp' | 'both';
}

export default function ClientRegistrationPage() {
    const params = useParams();
    const token = params.token as string;

    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        phones: [{ number: '', type: 'both' as const }] as PhoneInput[],
        location: '',
        personCount: 1,
        zone: '',
        notes: '',
    });

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await axios.get(`${API_BASE}/public/clients/register/${token}/validate`);
                setIsValidToken(response.data.valid);
            } catch (err) {
                setIsValidToken(false);
            }
        };
        if (token) {
            validateToken();
        }
    }, [token]);

    const handlePhoneChange = (index: number, field: keyof PhoneInput, value: string) => {
        const newPhones = [...formData.phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setFormData({ ...formData, phones: newPhones });
    };

    const addPhone = () => {
        setFormData({
            ...formData,
            phones: [...formData.phones, { number: '', type: 'both' }],
        });
    };

    const removePhone = (index: number) => {
        if (formData.phones.length > 1) {
            const newPhones = formData.phones.filter((_, i) => i !== index);
            setFormData({ ...formData, phones: newPhones });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            await axios.post(`${API_BASE}/public/clients/register/${token}`, {
                ...formData,
                marketingSource: 'registration_link',
            });
            setIsSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isValidToken === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
        );
    }

    // Invalid token
    if (!isValidToken) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-800">Lien invalide</h1>
                    <p className="text-gray-600">Ce lien d&apos;inscription est invalide ou a expiré. Veuillez contacter MIRAI Services pour obtenir un nouveau lien.</p>
                </div>
            </div>
        );
    }

    // Success state
    if (isSuccess) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-800">Inscription réussie !</h1>
                    <p className="mb-4 text-gray-600">Votre inscription a été soumise avec succès. Notre équipe va la valider et vous contacter très prochainement.</p>
                    <p className="text-sm text-gray-500">Merci de faire confiance à MIRAI Services.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-8">
            <div className="mx-auto max-w-2xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <Image src="/mirai-logo.png" alt="MIRAI Services" width={120} height={40} className="mx-auto mb-4" />
                    <h1 className="mb-2 text-3xl font-bold text-gray-800">Inscription Client</h1>
                    <p className="text-gray-600">Remplissez le formulaire ci-dessous pour vous inscrire</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-xl md:p-8">
                    {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

                    {/* Name */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Nom complet <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Votre nom complet"
                        />
                    </div>

                    {/* Phones */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Numéros de téléphone <span className="text-red-500">*</span>
                        </label>
                        {formData.phones.map((phone, index) => (
                            <div key={index} className="mb-2 flex gap-2">
                                <input
                                    type="tel"
                                    required
                                    value={phone.number}
                                    onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                                    placeholder="+225 XX XX XX XX XX"
                                />
                                <select
                                    value={phone.type}
                                    onChange={(e) => handlePhoneChange(index, 'type', e.target.value)}
                                    className="rounded-lg border border-gray-300 px-3 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                                >
                                    <option value="both">Appel + WhatsApp</option>
                                    <option value="call">Appel uniquement</option>
                                    <option value="whatsapp">WhatsApp uniquement</option>
                                </select>
                                {formData.phones.length > 1 && (
                                    <button type="button" onClick={() => removePhone(index)} className="rounded-lg px-3 py-3 text-red-500 transition hover:bg-red-50">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addPhone} className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Ajouter un numéro
                        </button>
                    </div>

                    {/* Location */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Adresse / Localisation <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Ex: Cocody Angré, près du supermarché..."
                        />
                    </div>

                    {/* Zone */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Zone / Quartier</label>
                        <input
                            type="text"
                            value={formData.zone}
                            onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Ex: Angré, Riviera, Plateau..."
                        />
                    </div>

                    {/* Person Count */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Nombre de personnes dans le foyer <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            required
                            min={1}
                            max={50}
                            value={formData.personCount}
                            onChange={(e) => setFormData({ ...formData, personCount: parseInt(e.target.value) || 1 })}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Notes */}
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Informations supplémentaires</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Précisions sur votre adresse, préférences..."
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                                Envoi en cours...
                            </>
                        ) : (
                            "S'inscrire"
                        )}
                    </button>

                    <p className="mt-4 text-center text-xs text-gray-500">En soumettant ce formulaire, vous acceptez d&apos;être contacté par MIRAI Services.</p>
                </form>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-gray-500">© {new Date().getFullYear()} MIRAI Services - Les Laveries</div>
            </div>
        </div>
    );
}
