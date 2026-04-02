'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalBottomNav from '@/components/portal/PortalBottomNav';
import { ClientNotification, clientPortalApi } from '@/lib/api/client-portal';

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
    pickup: { icon: '📦', color: 'text-blue-700', bg: 'bg-blue-50' },
    delivery: { icon: '🚚', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    payment: { icon: '💰', color: 'text-amber-700', bg: 'bg-amber-50' },
    status: { icon: '🔄', color: 'text-violet-700', bg: 'bg-violet-50' },
    rating: { icon: '⭐', color: 'text-orange-700', bg: 'bg-orange-50' },
    system: { icon: '🔔', color: 'text-slate-700', bg: 'bg-slate-50' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function PortalNotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<ClientNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (localStorage.getItem('portal_auth') !== 'true') {
            router.replace('/portal/login');
            return;
        }
        clientPortalApi
            .getNotifications(100)
            .then((data) => {
                setNotifications(data);
                // Mark all as read
                const unread = data.filter((n) => !n.read);
                if (unread.length > 0) {
                    clientPortalApi.markNotificationsRead(true).catch(() => {});
                }
            })
            .catch((err) => {
                if (err?.response?.status === 401) {
                    localStorage.removeItem('portal_auth');
                    router.replace('/portal/login');
                }
            })
            .finally(() => setLoading(false));
    }, [router]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f8f9fc] pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 px-5 pb-4 pt-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-extrabold text-slate-800">Notifications</h1>
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-[#4361ee] px-2.5 py-1 text-[10px] font-bold text-white">
                            {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            <div className="p-5">
                {loading && (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-100" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-3/4 rounded bg-slate-100" />
                                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && notifications.length === 0 && (
                    <div className="mt-16 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                            <span className="text-4xl">🔔</span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-slate-500">Aucune notification</p>
                        <p className="mt-1 text-[12px] text-slate-400">
                            Vos notifications de commandes, livraisons et paiements apparaîtront ici
                        </p>
                    </div>
                )}

                {!loading && notifications.length > 0 && (
                    <div className="space-y-2">
                        {notifications.map((n, i) => {
                            const meta = TYPE_META[n.type] || TYPE_META.system;
                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        if (n.url) router.push(n.url);
                                    }}
                                    className={`group flex w-full items-start gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98] ${
                                        !n.read
                                            ? 'bg-white shadow-lg shadow-slate-200/50 ring-1 ring-[#4361ee]/10'
                                            : 'bg-white/60 shadow-sm'
                                    }`}
                                >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${meta.bg}`}>
                                        {n.icon || meta.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-[13px] font-bold ${!n.read ? 'text-slate-800' : 'text-slate-600'}`}>
                                                {n.title}
                                            </p>
                                            <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{n.body}</p>
                                        {n.orderId && (
                                            <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                                                {n.orderId}
                                            </span>
                                        )}
                                    </div>
                                    {!n.read && <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#4361ee]" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <PortalBottomNav />
        </div>
    );
}
