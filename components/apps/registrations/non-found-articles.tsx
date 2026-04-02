'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { registrationsApi } from '@/lib/api/article-registrations';

const CATEGORY_ICONS: Record<string, string> = {
    vetements: '👕',
    draps: '🛏️',
    serviettes: '🧴',
    vestes: '🧥',
    couettes: '🛌',
    rideaux: '🪟',
    moquettes: '🟫',
    coussins: '🛋️',
    chaussures: '👟',
    tapis: '🧶',
    sacs: '👜',
    peluches: '🧸',
};

const NonFoundArticles = () => {
    const router = useRouter();

    const { data: items, isLoading } = useQuery({
        queryKey: ['non-found-articles'],
        queryFn: () => registrationsApi.getNonFoundArticles(),
    });

    // Group by client
    const grouped = React.useMemo(() => {
        if (!items) return new Map<string, any[]>();
        const map = new Map<string, any[]>();
        for (const item of items) {
            const key = item.clientName || item.clientId;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        return map;
    }, [items]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Articles introuvables</h1>
                        <p className="text-sm text-slate-500">Articles marqués comme introuvables dans les vérifications</p>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
            )}

            {/* Empty */}
            {!isLoading && (!items || items.length === 0) && (
                <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl dark:bg-green-900/30">✓</div>
                    <p className="text-sm font-semibold text-green-600">Aucun article introuvable</p>
                    <p className="mt-1 text-xs text-slate-400">Tous les articles vérifiés ont été trouvés</p>
                </div>
            )}

            {/* Grouped by client */}
            {!isLoading && grouped.size > 0 && (
                <div className="space-y-4">
                    {Array.from(grouped.entries()).map(([clientName, clientItems]) => (
                        <div key={clientName} className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1a2234]">
                            {/* Client header */}
                            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700/50">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 dark:bg-red-900/30">
                                    {(clientName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{clientName}</h3>
                                    <p className="text-[10px] text-slate-400">
                                        {clientItems.length} article{clientItems.length > 1 ? 's' : ''} introuvable{clientItems.length > 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                                {clientItems.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-base">{CATEGORY_ICONS[item.categoryName] || '📦'}</span>
                                            <div>
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.categoryName}</span>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <span>{item.registrationId}</span>
                                                    {item.orderRef && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{item.orderRef}</span>
                                                        </>
                                                    )}
                                                    {item.operationIndex !== undefined && (
                                                        <>
                                                            <span>·</span>
                                                            <span>Op. {item.operationIndex + 1}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Introuvable</span>
                                            <Link
                                                href={`/apps/registrations/${item._id}`}
                                                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-primary/30 hover:text-primary dark:border-slate-700"
                                            >
                                                Voir
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NonFoundArticles;
