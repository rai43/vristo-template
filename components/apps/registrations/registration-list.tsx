'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArticleRegistration, registrationsApi } from '@/lib/api/article-registrations';

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: 'Brouillon', bg: 'bg-amber-100', text: 'text-amber-700' },
    completed: { label: 'Complété', bg: 'bg-green-100', text: 'text-green-700' },
    validated: { label: 'Validé', bg: 'bg-blue-100', text: 'text-blue-700' },
};

const RegistrationList = () => {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const { data, isLoading } = useQuery({
        queryKey: ['registrations', page, statusFilter, debouncedSearch],
        queryFn: () =>
            registrationsApi.list({
                page,
                limit: 20,
                status: statusFilter || undefined,
                search: debouncedSearch || undefined,
            }),
    });

    const registrations = data?.data || [];
    const totalPages = data?.totalPages || 1;
    const total = data?.total || 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">Enregistrements</h1>
                    <p className="text-sm text-slate-500">Réception et comptage des articles</p>
                </div>
                <button
                    onClick={() => router.push('/apps/registrations/new')}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nouvel enregistrement
                </button>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Rechercher par client, ID, commande..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#1a2234] dark:text-white"
                    />
                    {search && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setDebouncedSearch('');
                                setPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="flex gap-1.5">
                    {['', 'draft', 'completed', 'validated'].map((s) => (
                        <button
                            key={s}
                            onClick={() => {
                                setStatusFilter(s);
                                setPage(1);
                            }}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                statusFilter === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {s === '' ? 'Tous' : STATUS_MAP[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results count */}
            {!isLoading && (
                <p className="text-xs text-slate-400">
                    {total} enregistrement{total !== 1 ? 's' : ''} trouvé{total !== 1 ? 's' : ''}
                </p>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && registrations.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">📋</div>
                    <p className="text-sm font-semibold text-slate-500">{debouncedSearch ? 'Aucun résultat' : 'Aucun enregistrement'}</p>
                    <p className="mt-1 text-xs text-slate-400">{debouncedSearch ? 'Essayez une autre recherche' : 'Commencez par créer un nouvel enregistrement'}</p>
                </div>
            )}

            {/* Table */}
            {!isLoading && registrations.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">ID</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client</th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Articles</th>
                                <th className="hidden px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Photos</th>
                                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Statut</th>
                                <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Date</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {registrations.map((reg: ArticleRegistration) => {
                                const st = STATUS_MAP[reg.status] || STATUS_MAP.draft;
                                return (
                                    <tr key={reg._id} onClick={() => router.push(`/apps/registrations/${reg._id}`)} className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/30 ${reg.status === 'draft' ? 'border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{reg.registrationId}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                    {(reg.clientName || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-white">{reg.clientName || '—'}</div>
                                                    {reg.orderRef && <div className="truncate text-[10px] text-slate-400">{reg.orderRef}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-bold text-primary">{reg.totalArticles}</span>
                                        </td>
                                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                                            {reg.photos?.length > 0 ? <span className="text-xs text-slate-500">📷 {reg.photos.length}</span> : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                                        </td>
                                        <td className="hidden px-4 py-3 md:table-cell">
                                            <span className="text-xs text-slate-400">
                                                {new Date(reg.createdAt).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                    <span className="text-xs text-slate-400">
                        Page {page} / {totalPages}
                    </span>
                    <div className="flex gap-1">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-600">
                            Précédent
                        </button>
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-600"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistrationList;
