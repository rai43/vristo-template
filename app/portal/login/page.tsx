'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientPortalApi } from '@/lib/api/client-portal';
import Image from 'next/image';

export default function PortalLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim() || !name.trim()) { setError('Veuillez remplir tous les champs'); return; }
        setError('');
        setLoading(true);
        try {
            const res = await clientPortalApi.login(phone.trim(), name.trim());
            if (res.ok) {
                localStorage.setItem('portal_client', JSON.stringify(res.client));
                localStorage.setItem('portal_auth', 'true');
                router.push('/portal');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Identifiants incorrects';
            setError(typeof msg === 'string' ? msg : 'Identifiants incorrects');
        } finally { setLoading(false); }
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col bg-white">
            {/* ── Decorative top shape ── */}
            <div className="absolute left-0 right-0 top-0 h-[52%] overflow-hidden rounded-b-[40px] bg-gradient-to-br from-[#4361ee] via-[#3a56e8] to-[#2541d0]">
                <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/[0.06]" />
                <div className="absolute -right-12 top-16 h-40 w-40 rounded-full bg-white/[0.04]" />
                <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-white/[0.05]" />
            </div>

            {/* ── Content ── */}
            <div className="relative z-10 flex flex-1 flex-col items-center px-7 pt-20">
                {/* Logo */}
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[22px] bg-white shadow-2xl shadow-blue-900/20">
                    <Image src="/mirai-logo.png" alt="Mirai Services" width={60} height={60} priority />
                </div>
                <h1 className="mt-5 text-[26px] font-extrabold tracking-tight text-white">Bienvenue !</h1>
                <p className="mt-1 text-[13px] font-medium text-blue-200/80">Connectez-vous à votre espace client</p>

                {/* ── Login Card ── */}
                <div className="mt-10 w-full max-w-[380px] rounded-3xl bg-white px-6 py-8 shadow-xl shadow-slate-200/60">
                    {error && (
                        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
                            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Phone */}
                        <div>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Numéro de téléphone</label>
                            <div className="group relative">
                                <div className="absolute left-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 transition group-focus-within:text-blue-500">
                                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                                </div>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0701020304"
                                    className="h-[52px] w-full rounded-2xl border-2 border-slate-100 bg-slate-50/60 pl-12 pr-4 text-[15px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
                                    autoComplete="tel" inputMode="tel" />
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Votre prénom ou nom</label>
                            <div className="group relative">
                                <div className="absolute left-0 top-0 flex h-full w-12 items-center justify-center text-slate-400 transition group-focus-within:text-blue-500">
                                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                                </div>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Konan"
                                    className="h-[52px] w-full rounded-2xl border-2 border-slate-100 bg-slate-50/60 pl-12 pr-4 text-[15px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
                                    autoComplete="name" />
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-400">Un des mots de votre nom complet</p>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loading}
                            className="relative mt-2 h-[52px] w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#4361ee] to-[#3a56e8] text-[15px] font-bold text-white shadow-xl shadow-blue-600/30 transition-all active:scale-[0.97] disabled:opacity-60">
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Connexion...
                                </span>
                            ) : (
                                <>Se connecter <svg className="ml-2 inline h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-auto pb-8 pt-6 text-center text-[11px] text-slate-400">© {new Date().getFullYear()} Mirai Services · Les Laveries</p>
            </div>
        </div>
    );
}
