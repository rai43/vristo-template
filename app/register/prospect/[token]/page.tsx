'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const MONTHS = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
];

interface PhoneInput {
    number: string;
    type: 'call' | 'whatsapp' | 'both';
}

interface PackData {
    _id: string;
    code: string;
    name: string;
    price: number;
    vetements: number;
    couettes: number;
    vestes: number;
    draps_serviettes: number;
    total: number;
    validityDays: number;
    defaultPickups: number;
    defaultDeliveries: number;
    description?: string;
}

interface ZoneData {
    _id: string;
    name: string;
    displayName: string;
    subscriptionFee: number;
    aLaCarteFee: number;
}

const PACK_ICONS: Record<string, string> = {
    douceur: '🌸',
    DOUCEUR: '🌸',
    eclat: '✨',
    ECLAT: '✨',
    ÉCLAT: '✨',
    prestige: '👑',
    PRESTIGE: '👑',
};

const PACK_COLORS: Record<string, { bg: string; border: string; text: string; ring: string; gradient: string }> = {
    douceur: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        ring: 'ring-blue-500',
        gradient: 'from-blue-500 to-blue-600',
    },
    DOUCEUR: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        ring: 'ring-blue-500',
        gradient: 'from-blue-500 to-blue-600',
    },
    eclat: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        ring: 'ring-emerald-500',
        gradient: 'from-emerald-500 to-emerald-600',
    },
    ECLAT: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        ring: 'ring-emerald-500',
        gradient: 'from-emerald-500 to-emerald-600',
    },
    ÉCLAT: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        ring: 'ring-emerald-500',
        gradient: 'from-emerald-500 to-emerald-600',
    },
    prestige: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        ring: 'ring-purple-500',
        gradient: 'from-purple-500 to-purple-600',
    },
    PRESTIGE: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        ring: 'ring-purple-500',
        gradient: 'from-purple-500 to-purple-600',
    },
};

const defaultColor = {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    ring: 'ring-gray-500',
    gradient: 'from-gray-500 to-gray-600',
};

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-base outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100';

const ADD_ONS = [
    { pickups: 0, price: 0, extraItems: 0, label: 'Inclus dans le pack' },
    { pickups: 1, price: 5000, extraItems: 20, label: '+1 collecte supplémentaire' },
    { pickups: 2, price: 10000, extraItems: 40, label: '+2 collectes supplémentaires' },
    { pickups: 3, price: 15000, extraItems: 60, label: '+3 collectes supplémentaires' },
    { pickups: 4, price: 20000, extraItems: 80, label: '+4 collectes supplémentaires' },
];

/** Map DB pack codes (ÉCLAT, DOUCEUR, etc.) to enum values (eclat, douceur, etc.) */
const normalizePackCode = (code: string): string => {
    return code
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '');
};

export default function ProspectRegistrationPage() {
    const params = useParams();
    const token = params.token as string;

    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);

    const [packs, setPacks] = useState<PackData[]>([]);
    const [zones, setZones] = useState<ZoneData[]>([]);

    const [birthdayDay, setBirthdayDay] = useState('');
    const [birthdayMonth, setBirthdayMonth] = useState('');
    const [addOnPickups, setAddOnPickups] = useState(0);

    const [formData, setFormData] = useState({
        name: '',
        phones: [{ number: '', type: 'whatsapp' as const }] as PhoneInput[],
        address: '',
        zone: '',
        packChoice: '',
        preferredPickupDate: '',
        notes: '',
    });

    useEffect(() => {
        const init = async () => {
            try {
                const [tokenRes, packsRes, zonesRes] = await Promise.all([
                    axios.get(`${API_BASE}/public/leads/register/${token}/validate`),
                    axios.get(`${API_BASE}/public/leads/packs`),
                    axios.get(`${API_BASE}/public/leads/zones`),
                ]);
                setIsValidToken(tokenRes.data.valid);
                setPacks(packsRes.data || []);
                setZones(zonesRes.data || []);
            } catch {
                setIsValidToken(false);
            }
        };
        if (token) init();
    }, [token]);

    const selectedPack = packs.find((p) => normalizePackCode(p.code) === formData.packChoice);
    const selectedZone = zones.find((z) => z.name === formData.zone);
    const birthdayStr = birthdayDay && birthdayMonth ? `${birthdayDay}/${birthdayMonth}` : '';
    const currentAddOn = ADD_ONS[addOnPickups] || ADD_ONS[0];
    const isALaCarte = formData.packChoice === 'a_la_carte';
    const totalPickups = selectedPack ? selectedPack.defaultPickups + addOnPickups : 0;
    const totalDeliveries = selectedPack ? selectedPack.defaultDeliveries + addOnPickups : 0;
    const totalItems = selectedPack ? selectedPack.total + currentAddOn.extraItems : 0;
    const deliveryCost = selectedZone && selectedPack ? selectedZone.subscriptionFee * totalDeliveries : 0;
    const addOnPrice = currentAddOn.price;
    const totalMonthly = selectedPack ? selectedPack.price + addOnPrice + deliveryCost : 0;

    const handlePhoneChange = (index: number, field: keyof PhoneInput, value: string) => {
        const newPhones = [...formData.phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setFormData({ ...formData, phones: newPhones });
    };

    const addPhone = () => setFormData({ ...formData, phones: [...formData.phones, { number: '', type: 'whatsapp' }] });

    const removePhone = (index: number) => {
        if (formData.phones.length > 1)
            setFormData({
                ...formData,
                phones: formData.phones.filter((_, i) => i !== index),
            });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/public/leads/register/${token}`, {
                name: formData.name,
                phones: formData.phones.filter((p) => p.number.trim()),
                address: formData.address,
                zone: formData.zone || undefined,
                packChoice: formData.packChoice,
                preferredPickupDate: formData.preferredPickupDate || undefined,
                additionalPickups: addOnPickups > 0 ? addOnPickups : undefined,
                birthday: birthdayStr || undefined,
                notes: formData.notes || undefined,
                source: 'inscription_link',
            });
            setIsSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ── Loading ──────────────────────────────── */
    if (isValidToken === null) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
                    <p className="text-sm text-slate-500">Vérification du lien...</p>
                </div>
            </div>
        );
    }

    /* ── Invalid ──────────────────────────────── */
    if (!isValidToken) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
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

    /* ── Success ──────────────────────────────── */
    if (isSuccess) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-emerald-50 to-cyan-50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                        <svg className="h-10 w-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-800">Inscription réussie ! 🎉</h1>
                    <p className="mb-4 text-gray-600">Votre inscription a été soumise avec succès. Notre équipe va vous contacter très prochainement pour organiser votre première collecte.</p>
                    {selectedPack && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                            <p className="font-medium text-slate-700">Pack choisi : {selectedPack.name}</p>
                            <p>{selectedPack.price.toLocaleString()} FCFA / mois</p>
                        </div>
                    )}
                    <p className="mt-6 text-sm text-gray-500">Merci de faire confiance à MIRAI Services 💙</p>
                </div>
            </div>
        );
    }

    /* ── Main ─────────────────────────────────── */
    return (
        <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Header — sticky on mobile */}
            <div className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Image src="/mirai-logo.png" alt="MIRAI" width={36} height={36} className="rounded-lg" />
                        <div className="leading-tight">
                            <h1 className="text-base font-bold text-slate-800">MIRAI Services</h1>
                            <p className="text-[10px] text-slate-400">Les Laveries</p>
                        </div>
                    </div>
                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                        <div className={`h-0.5 w-6 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 py-5 pb-8">
                {/* ══════════ STEP 1 ══════════ */}
                {step === 1 && (
                    <div>
                        <div className="mb-5 text-center">
                            <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">Choisissez votre pack</h2>
                            <p className="mt-1 text-sm text-slate-500">Sélectionnez le pack qui convient le mieux à vos besoins</p>
                        </div>

                        {/* Pack cards — single column on mobile */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {packs
                                .filter((p) => normalizePackCode(p.code) !== 'a_la_carte')
                                .map((pack) => {
                                    const colors = PACK_COLORS[pack.code] || defaultColor;
                                    const icon = PACK_ICONS[pack.code] || '📦';
                                    const isSelected = formData.packChoice === normalizePackCode(pack.code);
                                    const specialItems = pack.couettes + pack.vestes + pack.draps_serviettes;

                                    return (
                                        <button
                                            key={pack._id}
                                            type="button"
                                            onClick={() => {
                                                setFormData({
                                                    ...formData,
                                                    packChoice: normalizePackCode(pack.code),
                                                });
                                                setAddOnPickups(0);
                                            }}
                                            className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 sm:p-5 ${
                                                isSelected
                                                    ? `${colors.border} ${colors.bg} ring-2 ${colors.ring} shadow-lg`
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md active:scale-[0.98]'
                                            }`}
                                        >
                                            {isSelected && (
                                                <div
                                                    className={`absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r ${colors.gradient} text-white shadow-md`}
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}

                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-xl sm:text-2xl">{icon}</span>
                                                <h3 className={`text-base font-bold sm:text-lg ${isSelected ? colors.text : 'text-slate-800'}`}>{pack.name}</h3>
                                            </div>

                                            <div className="mb-3">
                                                <span className={`text-2xl font-extrabold sm:text-3xl ${isSelected ? colors.text : 'text-slate-800'}`}>{pack.price.toLocaleString()}</span>
                                                <span className="ml-1 text-xs text-slate-500 sm:text-sm">FCFA / mois</span>
                                            </div>

                                            {/* Items grid — compact on mobile */}
                                            <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-3 text-xs sm:text-sm">
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="text-xs">👕</span>
                                                    <span>Vêtements</span>
                                                    <span className="ml-auto font-bold text-slate-800">{pack.vetements}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="text-xs">🧥</span>
                                                    <span>Vestes</span>
                                                    <span className="ml-auto font-bold text-slate-800">{pack.vestes}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="text-xs">🛏️</span>
                                                    <span>Draps & Serv.</span>
                                                    <span className="ml-auto font-bold text-slate-800">{pack.draps_serviettes}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="text-xs">🛌</span>
                                                    <span>Couettes</span>
                                                    <span className="ml-auto font-bold text-slate-800">{pack.couettes}</span>
                                                </div>
                                            </div>

                                            {/* Summary strip */}
                                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:text-xs">
                                                    📦 {pack.total} articles ({specialItems} spéciaux)
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 sm:text-xs">
                                                    📥 {pack.defaultPickups} collecte{pack.defaultPickups > 1 ? 's' : ''} gratuite{pack.defaultPickups > 1 ? 's' : ''}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:text-xs">
                                                    🚚 {pack.defaultDeliveries} livraison{pack.defaultDeliveries > 1 ? 's' : ''}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:text-xs">
                                                    📅 {pack.validityDays} jours
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* À la carte — always available */}
                        <button
                            type="button"
                            onClick={() => {
                                setFormData({ ...formData, packChoice: 'a_la_carte' });
                                setAddOnPickups(0);
                            }}
                            className={`mt-3 w-full rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                                formData.packChoice === 'a_la_carte' ? 'border-amber-300 bg-amber-50 shadow-md ring-2 ring-amber-400' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🎯</span>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800">À la carte</h3>
                                    <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Sans engagement mensuel · Payez uniquement ce que vous lavez</p>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>👕 Vêtements ordinaires (min. 15 articles)</span>
                                    <span className="font-bold text-slate-800">6 000 FCFA</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>🛌 Couettes, rideaux, draps &amp; articles spéciaux</span>
                                    <span className="font-medium text-amber-700">Prix sur devis</span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">Le tarif des articles spéciaux sera communiqué sur la facture</p>
                            </div>
                        </button>

                        {/* ── Add-on pickups ── */}
                        {selectedPack && !isALaCarte && (
                            <div className="mt-5">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="text-base">🚀</span>
                                    <label className="text-sm font-semibold text-slate-700">Collectes supplémentaires</label>
                                </div>
                                <p className="mb-3 text-xs text-slate-500">
                                    Votre pack inclut{' '}
                                    <strong>
                                        {selectedPack.defaultPickups} collecte{selectedPack.defaultPickups > 1 ? 's' : ''}
                                    </strong>
                                    . Ajoutez-en pour un linge toujours frais !
                                </p>

                                <div className="space-y-2">
                                    {ADD_ONS.map((opt, idx) => {
                                        const sel = addOnPickups === idx;
                                        const newTotal = selectedPack.total + opt.extraItems;
                                        const newPickups = selectedPack.defaultPickups + opt.pickups;

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setAddOnPickups(idx)}
                                                className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                                                    sel ? 'border-indigo-300 bg-indigo-50 shadow-md ring-2 ring-indigo-400' : 'border-slate-200 bg-white active:scale-[0.99]'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div
                                                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${sel ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}
                                                        >
                                                            {sel && (
                                                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div>
                                                            {idx === 0 ? (
                                                                <p className="text-sm font-medium text-slate-700">Pas de collecte supplémentaire</p>
                                                            ) : (
                                                                <p className="text-sm font-medium text-slate-800">
                                                                    +{opt.pickups} collecte{opt.pickups > 1 ? 's' : ''}
                                                                    <span className="ml-1.5 text-xs font-normal text-slate-500">(+{opt.extraItems} articles)</span>
                                                                </p>
                                                            )}
                                                            {idx > 0 && (
                                                                <p className="mt-0.5 text-[11px] text-slate-400">
                                                                    → {newPickups} collectes · {newTotal} articles au total
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {idx > 0 && (
                                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sel ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                            +{opt.price.toLocaleString()} F
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {addOnPickups > 0 && (
                                    <div className="mt-2.5 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                                        <strong>🎉 Excellent choix !</strong> Avec {totalPickups} collectes, votre linge sera récupéré environ tous les {Math.round(30 / totalPickups)} jours. Vous
                                        aurez droit à <strong>{totalItems} articles</strong> au total.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Zone selection */}
                        {zones.length > 0 && (
                            <div className="mt-5">
                                <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    🚚 Zone de livraison <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                    {zones.map((zone) => (
                                        <button
                                            key={zone._id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, zone: zone.name })}
                                            className={`rounded-xl border-2 p-2.5 text-left transition-all active:scale-[0.97] sm:p-3 ${
                                                formData.zone === zone.name ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-400' : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <p className="text-sm font-medium text-slate-800">{zone.displayName}</p>
                                            <p className="text-[10px] text-slate-500 sm:text-xs">
                                                {isALaCarte
                                                    ? zone.aLaCarteFee > 0
                                                        ? `${zone.aLaCarteFee.toLocaleString()} FCFA / livraison`
                                                        : 'Livraison gratuite'
                                                    : zone.subscriptionFee > 0
                                                    ? `${zone.subscriptionFee.toLocaleString()} FCFA / livraison`
                                                    : 'Livraison gratuite'}
                                            </p>
                                            <p className="text-[10px] text-emerald-600 sm:text-xs">Collecte gratuite ✓</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recap */}
                        {isALaCarte && selectedZone && (
                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                                <h4 className="mb-2.5 text-sm font-semibold text-amber-800">📋 Récapitulatif — À la carte</h4>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">👕 Vêtements ordinaires (min. 15)</span>
                                        <span className="font-semibold text-amber-900">6 000 FCFA</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">🛌 Articles spéciaux</span>
                                        <span className="font-semibold text-amber-700">Sur devis</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">🚚 Livraison ({selectedZone.displayName})</span>
                                        <span className="font-semibold">{selectedZone.aLaCarteFee > 0 ? `${selectedZone.aLaCarteFee.toLocaleString()} FCFA` : 'Offerte'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700">📥 Collecte</span>
                                        <span className="font-semibold text-emerald-600">Gratuite ✓</span>
                                    </div>
                                </div>
                                <p className="mt-2.5 text-[11px] text-amber-600">* Le prix des couettes, rideaux, draps et autres articles spéciaux sera communiqué sur la facture.</p>
                            </div>
                        )}
                        {selectedPack && !isALaCarte && selectedZone && (
                            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h4 className="mb-2.5 text-sm font-semibold text-slate-700">📋 Récapitulatif</h4>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Pack {selectedPack.name}</span>
                                        <span className="font-semibold">{selectedPack.price.toLocaleString()} FCFA</span>
                                    </div>
                                    {addOnPickups > 0 && (
                                        <div className="flex justify-between text-indigo-700">
                                            <span>
                                                🚀 +{addOnPickups} collecte{addOnPickups > 1 ? 's' : ''} supp. (+{currentAddOn.extraItems} articles)
                                            </span>
                                            <span className="font-semibold">+{addOnPrice.toLocaleString()} FCFA</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">
                                            Livraison ({selectedZone.displayName}) × {totalDeliveries}
                                        </span>
                                        <span className="font-semibold">{deliveryCost > 0 ? `${deliveryCost.toLocaleString()} FCFA` : 'Offerte'}</span>
                                    </div>
                                    {deliveryCost > 0 && (
                                        <p className="text-[11px] text-slate-400">
                                            ({selectedZone.subscriptionFee.toLocaleString()} FCFA × {totalDeliveries} livraison{totalDeliveries > 1 ? 's' : ''})
                                        </p>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Collecte × {totalPickups}</span>
                                        <span className="font-semibold text-emerald-600">Gratuite ✓</span>
                                    </div>
                                    <div className="border-t border-slate-100 pt-2">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-800">Total mensuel</span>
                                            <span className="text-lg font-extrabold text-blue-600">{totalMonthly.toLocaleString()} FCFA</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notices */}
                        <div className="mt-5 space-y-2.5">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                                <div className="flex gap-2.5">
                                    <span className="text-base">💳</span>
                                    <div>
                                        <p className="text-xs font-semibold text-amber-800 sm:text-sm">Paiement et livraison</p>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700 sm:text-xs">
                                            Le paiement intégral du pack doit être effectué pour que la livraison soit activée.{' '}
                                            <strong>C&apos;est le paiement intégral qui valide la livraison.</strong> Seul le paiement confirmé déclenche la livraison de vos vêtements.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                                <div className="flex gap-2.5">
                                    <span className="text-base">📏</span>
                                    <div>
                                        <p className="text-xs font-semibold text-blue-800 sm:text-sm">Articles supplémentaires</p>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-700 sm:text-xs">
                                            Si vous dépassez le nombre d&apos;articles inclus dans votre pack, un supplément sera ajouté à la facture finale. Ce montant devra être{' '}
                                            <strong>intégralement réglé avant la 1ère livraison</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <button
                            type="button"
                            disabled={!formData.packChoice || (!formData.zone && zones.length > 0)}
                            onClick={() => {
                                setStep(2);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:py-4 sm:text-base"
                        >
                            Continuer
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* ══════════ STEP 2 ══════════ */}
                {step === 2 && (
                    <div>
                        <button type="button" onClick={() => setStep(1)} className="mb-3 flex items-center gap-1 text-sm font-medium text-blue-600 active:text-blue-800">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour au choix du pack
                        </button>

                        <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">Vos informations</h2>
                        <p className="mb-5 mt-1 text-sm text-slate-500">Remplissez le formulaire ci-dessous pour finaliser votre inscription</p>

                        {/* Pack summary card */}
                        {isALaCarte && (
                            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">🎯</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-amber-800">À la carte</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">👕 Min. 15 articles · 6 000 F</span>
                                            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">🛌 Spéciaux · Sur devis</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedZone && (
                                    <div className="mt-2.5 space-y-1 border-t border-dashed border-amber-200 pt-2.5 text-xs">
                                        <div className="flex justify-between text-amber-700">
                                            <span>🚚 Livraison ({selectedZone.displayName})</span>
                                            <span className="font-semibold">{selectedZone.aLaCarteFee > 0 ? `${selectedZone.aLaCarteFee.toLocaleString()} F` : 'Offerte'}</span>
                                        </div>
                                        <div className="flex justify-between text-amber-700">
                                            <span>📥 Collecte</span>
                                            <span className="font-semibold text-emerald-600">Gratuite ✓</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedPack && !isALaCarte && (
                            <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg">{PACK_ICONS[selectedPack.code] || '📦'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-slate-800">{selectedPack.name}</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                👕 {selectedPack.vetements + currentAddOn.extraItems} vêtements
                                            </span>
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">🧥 {selectedPack.vestes} vestes</span>
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                🛏️ {selectedPack.draps_serviettes} draps/serv.
                                            </span>
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                🛌 {selectedPack.couettes} couettes
                                            </span>
                                            <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                                📥 {totalPickups} collecte{totalPickups > 1 ? 's' : ''} gratuite{totalPickups > 1 ? 's' : ''}
                                            </span>
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                🚚 {totalDeliveries} livraison{totalDeliveries > 1 ? 's' : ''}
                                            </span>
                                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">📦 {totalItems} articles</span>
                                        </div>
                                        {addOnPickups > 0 && (
                                            <p className="mt-1 text-[10px] font-medium text-indigo-600">
                                                🚀 +{addOnPickups} collecte{addOnPickups > 1 ? 's' : ''} · +{currentAddOn.extraItems} articles · +{addOnPrice.toLocaleString()} F
                                            </p>
                                        )}
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-blue-600">{(selectedPack.price + addOnPrice).toLocaleString()} F</p>
                                </div>
                                {selectedZone && (
                                    <div className="mt-2.5 space-y-1 border-t border-dashed border-slate-100 pt-2.5 text-xs">
                                        <div className="flex justify-between text-slate-500">
                                            <span>
                                                🚚 Livraison ({selectedZone.displayName}) × {totalDeliveries}
                                            </span>
                                            <span className="font-semibold text-slate-700">{deliveryCost > 0 ? `${deliveryCost.toLocaleString()} F` : 'Offerte'}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-500">
                                            <span>📥 Collecte × {totalPickups}</span>
                                            <span className="font-semibold text-emerald-600">Gratuite ✓</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-100 pt-1.5">
                                            <span className="font-bold text-slate-700">Total mensuel</span>
                                            <span className="font-bold text-blue-600">{totalMonthly.toLocaleString()} F</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                            {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                            {/* Name */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Nom complet <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={inputCls}
                                    placeholder="Votre nom complet"
                                />
                            </div>

                            {/* Phones — stacked on mobile */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Numéro(s) de téléphone <span className="text-red-500">*</span>
                                </label>
                                {formData.phones.map((phone, index) => (
                                    <div key={index} className="mb-2 flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="tel"
                                            required={index === 0}
                                            value={phone.number}
                                            onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                                            className={`${inputCls} flex-1`}
                                            placeholder="+225 XX XX XX XX XX"
                                            inputMode="tel"
                                        />
                                        <div className="flex gap-2">
                                            <select
                                                value={phone.type}
                                                onChange={(e) => handlePhoneChange(index, 'type', e.target.value)}
                                                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-sm outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-[140px] sm:flex-none"
                                            >
                                                <option value="whatsapp">WhatsApp</option>
                                                <option value="call">Appel</option>
                                                <option value="both">Les deux</option>
                                            </select>
                                            {formData.phones.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePhone(index)}
                                                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50 hover:text-red-500 active:bg-red-100"
                                                >
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
                                    </div>
                                ))}
                                <button type="button" onClick={addPhone} className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 active:text-blue-800">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Ajouter un numéro
                                </button>
                            </div>

                            {/* Address */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Adresse complète <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className={inputCls}
                                    placeholder="Quartier + indications pour la collecte"
                                />
                            </div>

                            {/* Pickup date */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date de 1ère collecte souhaitée</label>
                                <input type="date" value={formData.preferredPickupDate} onChange={(e) => setFormData({ ...formData, preferredPickupDate: e.target.value })} className={inputCls} />
                            </div>

                            {/* Birthday — dd/mm selects */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date d&apos;anniversaire 🎂</label>
                                <div className="flex gap-2">
                                    <select value={birthdayDay} onChange={(e) => setBirthdayDay(e.target.value)} className={`${inputCls} w-auto flex-1`}>
                                        <option value="">Jour</option>
                                        {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                    <select value={birthdayMonth} onChange={(e) => setBirthdayMonth(e.target.value)} className={`${inputCls} w-auto flex-[2]`}>
                                        <option value="">Mois</option>
                                        {MONTHS.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">Pour les surprises d&apos;anniversaire</p>
                            </div>

                            {/* Notes */}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes / Remarques</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className={`${inputCls} resize-none`}
                                    placeholder="Informations supplémentaires..."
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-4 sm:text-base"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Envoi en cours...
                                    </>
                                ) : (
                                    <>
                                        Finaliser mon inscription
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </>
                                )}
                            </button>

                            <p className="mt-3 text-center text-[11px] text-slate-400">En soumettant ce formulaire, vous acceptez d&apos;être contacté par MIRAI Services.</p>
                        </form>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-white/50 px-4 py-3 text-center text-[11px] text-slate-400">© {new Date().getFullYear()} MIRAI Services - Les Laveries</div>
        </div>
    );
}
