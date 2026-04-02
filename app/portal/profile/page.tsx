'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { clientPortalApi, ClientProfile } from '@/lib/api/client-portal';

export default function PortalProfilePage() {
    const router = useRouter();
    const [client, setClient] = useState<ClientProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [personCount, setPersonCount] = useState(1);
    const [birthday, setBirthday] = useState('');
    const [phones, setPhones] = useState<{ number: string; type: string }[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('portal_auth') !== 'true') {
            router.replace('/portal/login');
            return;
        }
        clientPortalApi
            .getMe()
            .then((data) => {
                setClient(data);
                setName(data.name);
                setLocation(data.location);
                setPersonCount(data.personCount || 1);
                setBirthday(data.birthday || '');
                setPhones(data.phones || []);
            })
            .catch((err) => {
                if (err?.response?.status === 401) {
                    localStorage.removeItem('portal_auth');
                    router.replace('/portal/login');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await clientPortalApi.updateMe({ name, location, personCount, birthday, phones });
            setClient(updated);
            localStorage.setItem('portal_client', JSON.stringify(updated));
            setIsEditing(false);
            Swal.fire({ icon: 'success', title: 'Profil mis à jour', timer: 1500, showConfirmButton: false });
        } catch (err: any) {
            Swal.fire('Erreur', err?.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        const confirm = await Swal.fire({
            title: 'Se déconnecter ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui',
            cancelButtonText: 'Non',
        });
        if (!confirm.isConfirmed) return;
        try {
            await clientPortalApi.logout();
        } catch {}
        localStorage.removeItem('portal_auth');
        localStorage.removeItem('portal_client');
        router.replace('/portal/login');
    };

    const addPhone = () => setPhones((prev) => [...prev, { number: '', type: 'both' }]);
    const removePhone = (i: number) => setPhones((prev) => prev.filter((_, idx) => idx !== i));
    const updatePhone = (i: number, field: 'number' | 'type', value: string) => {
        setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
    };

    if (loading) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#4361ee]" />
            </div>
        );
    }

    return (
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
            {/* Header */}
            <div className="bg-white/90 px-5 pb-4 pt-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-extrabold text-slate-800">Mon profil</h1>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="rounded-full bg-[#4361ee]/10 px-4 py-1.5 text-xs font-bold text-[#4361ee] active:scale-95">
                            Modifier
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    if (client) {
                                        setName(client.name);
                                        setLocation(client.location);
                                        setPersonCount(client.personCount);
                                        setBirthday(client.birthday || '');
                                        setPhones(client.phones);
                                    }
                                }}
                                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 active:scale-95"
                            >
                                Annuler
                            </button>
                            <button onClick={handleSave} disabled={saving} className="rounded-full bg-[#4361ee] px-4 py-1.5 text-xs font-bold text-white active:scale-95 disabled:opacity-60">
                                {saving ? '...' : 'Sauvegarder'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4 p-5">
                {/* Client ID */}
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl font-black text-blue-600">{name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">{client?.customerId}</p>
                            <p className="text-[10px] text-slate-400">
                                Client depuis{' '}
                                {client?.createdAt
                                    ? new Date(client.createdAt).toLocaleDateString('fr-FR', {
                                          month: 'long',
                                          year: 'numeric',
                                      })
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Name */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nom complet</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 "
                        />
                    ) : (
                        <p className="text-sm font-semibold text-slate-700 ">{client?.name}</p>
                    )}
                </div>

                {/* Location */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Localisation</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 "
                        />
                    ) : (
                        <p className="text-sm font-semibold text-slate-700 ">{client?.location}</p>
                    )}
                </div>

                {/* Person Count */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre de personnes</label>
                    {isEditing ? (
                        <input
                            type="number"
                            value={personCount}
                            onChange={(e) => setPersonCount(Number(e.target.value) || 1)}
                            min={1}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 "
                        />
                    ) : (
                        <p className="text-sm font-semibold text-slate-700 ">{client?.personCount}</p>
                    )}
                </div>

                {/* Birthday */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Date de naissance</label>
                    {isEditing ? (
                        <input
                            type="date"
                            value={birthday}
                            onChange={(e) => setBirthday(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 "
                        />
                    ) : (
                        <p className="text-sm font-semibold text-slate-700 ">
                            {client?.birthday
                                ? new Date(client.birthday).toLocaleDateString('fr-FR', {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric',
                                  })
                                : '—'}
                        </p>
                    )}
                </div>

                {/* Phones */}
                <div className="rounded-2xl bg-white p-4 shadow-sm ">
                    <div className="mb-2 flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Téléphones</label>
                        {isEditing && (
                            <button onClick={addPhone} className="text-xs font-bold text-blue-600">
                                + Ajouter
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {phones.map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <input
                                            type="tel"
                                            value={p.number}
                                            onChange={(e) => updatePhone(i, 'number', e.target.value)}
                                            placeholder="Numéro"
                                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 "
                                        />
                                        <select
                                            value={p.type}
                                            onChange={(e) => updatePhone(i, 'type', e.target.value)}
                                            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs outline-none "
                                        >
                                            <option value="both">Les deux</option>
                                            <option value="call">Appel</option>
                                            <option value="whatsapp">WhatsApp</option>
                                        </select>
                                        {phones.length > 1 && (
                                            <button onClick={() => removePhone(i)} className="text-red-400 active:scale-95">
                                                ✕
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{p.type === 'whatsapp' ? '💬' : p.type === 'call' ? '📞' : '📱'}</span>
                                        <span className="text-sm font-semibold text-slate-700 ">{p.number}</span>
                                        <span className="text-[10px] text-slate-400">({p.type === 'both' ? 'Appel + WhatsApp' : p.type === 'call' ? 'Appel' : 'WhatsApp'})</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full rounded-2xl border border-red-100 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition active:scale-[0.98] "
                >
                    Se déconnecter
                </button>
            </div>

            <PortalBottomNav />
        </div>
    );
}


