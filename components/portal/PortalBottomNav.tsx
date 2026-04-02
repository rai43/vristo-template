'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientPortalApi } from '@/lib/api/client-portal';

const NAV = [
    {
        href: '/portal',
        label: 'Accueil',
        icon: (a: boolean) => (
            <svg className="h-[22px] w-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.6} viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
            </svg>
        ),
    },
    {
        href: '/portal/orders',
        label: 'Commandes',
        icon: (a: boolean) => (
            <svg className="h-[22px] w-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.6} viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75"
                />
            </svg>
        ),
    },
    {
        href: '/portal/notifications',
        label: 'Alertes',
        badge: true,
        icon: (a: boolean) => (
            <svg className="h-[22px] w-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.6} viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
            </svg>
        ),
    },
    {
        href: '/portal/profile',
        label: 'Profil',
        icon: (a: boolean) => (
            <svg className="h-[22px] w-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.6} viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
            </svg>
        ),
    },
];

export default function PortalBottomNav() {
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined' || localStorage.getItem('portal_auth') !== 'true') return;
        clientPortalApi
            .getNotifications(50)
            .then((notifs) => {
                setUnreadCount(notifs.filter((n) => !n.read).length);
            })
            .catch(() => {});
    }, [pathname]);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
                {NAV.map((item) => {
                    const active = item.href === '/portal' ? pathname === '/portal' : pathname?.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex flex-col items-center gap-[2px] rounded-2xl px-4 py-1.5 transition-all duration-200 ${
                                active ? 'text-[#4361ee]' : 'text-slate-400 active:scale-90'
                            }`}
                        >
                            {active && <span className="absolute -top-2 h-[3px] w-6 rounded-full bg-[#4361ee]" />}
                            <span className="relative">
                                {item.icon(!!active)}
                                {(item as any).badge && unreadCount > 0 && (
                                    <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </span>
                            <span className={`text-[10px] font-semibold ${active ? 'text-[#4361ee]' : ''}`}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
