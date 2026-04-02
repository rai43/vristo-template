'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RegistrationPhoto, registrationsApi } from '@/lib/api/article-registrations';
import { computeEmbeddingFromFile, findBestMatches, preloadModel } from '@/lib/image-embeddings';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

interface Props {
    registrationId: string;
    photos: RegistrationPhoto[];
    onMatch?: (photoUrl: string) => void;
}

interface MatchResult {
    filename: string;
    url: string;
    score: number;
}

const ArticleVerifier = ({ registrationId, photos, onMatch }: Props) => {
    const cameraRef = useRef<HTMLInputElement>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
    const [storedEmbeddings, setStoredEmbeddings] = useState<
        {
            filename: string;
            url: string;
            embedding: number[];
        }[]
    >([]);
    const [embeddingsLoaded, setEmbeddingsLoaded] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

    // Preload model on mount
    useEffect(() => {
        preloadModel();
    }, []);

    // Load stored embeddings
    useEffect(() => {
        if (!registrationId) return;
        registrationsApi
            .getEmbeddings(registrationId)
            .then((data) => {
                setStoredEmbeddings(data);
                setEmbeddingsLoaded(true);
            })
            .catch(() => setEmbeddingsLoaded(true));
    }, [registrationId]);

    const handleCapture = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;

            const file = files[0];
            const preview = URL.createObjectURL(file);
            setCapturedPreview(preview);
            setMatches([]);
            setSelectedMatch(null);

            // If we have stored embeddings, use AI matching
            if (storedEmbeddings.length > 0) {
                setIsSearching(true);
                try {
                    const queryEmb = await computeEmbeddingFromFile(file);
                    const results = findBestMatches(queryEmb, storedEmbeddings, 5);
                    setMatches(results);
                } catch (err) {
                    console.warn('AI matching failed, showing all photos', err);
                }
                setIsSearching(false);
            }

            e.target.value = '';
        },
        [storedEmbeddings]
    );

    const handleSelectMatch = (url: string) => {
        setSelectedMatch(url);
        onMatch?.(url);
    };

    const handleReset = () => {
        if (capturedPreview) URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
        setMatches([]);
        setSelectedMatch(null);
    };

    const articlePhotos = photos.filter((p) => p.type === 'articles');
    const hasEmbeddings = storedEmbeddings.length > 0;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1a2234]">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Recherche par image</h2>
                {!hasEmbeddings && embeddingsLoaded && articlePhotos.length > 0 && <span className="text-[10px] text-amber-500">Embeddings non calculés</span>}
            </div>

            <p className="mb-4 text-xs text-slate-500">Prenez une photo de l&apos;article à vérifier. Le système trouvera les photos les plus similaires dans l&apos;enregistrement.</p>

            {/* Camera button */}
            <input id="verifier-camera" ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />

            {!capturedPreview && (
                <label
                    htmlFor="verifier-camera"
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-6 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Prendre une photo
                </label>
            )}

            {/* Captured photo + results */}
            {capturedPreview && (
                <div className="space-y-4">
                    {/* Captured image */}
                    <div className="relative">
                        <div className="overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={capturedPreview} alt="Photo capturée" className="h-40 w-full object-cover" />
                        </div>
                        <button onClick={handleReset} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Loading */}
                    {isSearching && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                            <span className="text-xs text-slate-500">Recherche en cours...</span>
                        </div>
                    )}

                    {/* Match results */}
                    {matches.length > 0 && !isSearching && (
                        <div>
                            <p className="mb-2 text-xs font-semibold text-slate-500">Correspondances trouvées :</p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                {matches.map((match) => {
                                    const pct = Math.round(match.score * 100);
                                    const isSelected = selectedMatch === match.url;
                                    return (
                                        <button
                                            key={match.filename}
                                            onClick={() => handleSelectMatch(match.url)}
                                            className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                                                isSelected ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-primary/30'
                                            }`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`${API_URL}${match.url}`} alt={match.filename} className="h-full w-full object-cover" loading="lazy" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                                                <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                                                    <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* No embeddings — show manual photo grid */}
                    {!hasEmbeddings && !isSearching && articlePhotos.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold text-slate-500">Sélectionnez la photo correspondante :</p>
                            <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
                                {articlePhotos.map((photo) => {
                                    const isSelected = selectedMatch === photo.url;
                                    return (
                                        <button
                                            key={photo.filename}
                                            onClick={() => handleSelectMatch(photo.url)}
                                            className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                                                isSelected ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-primary/30'
                                            }`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`${API_URL}${photo.url}`} alt={photo.filename} className="h-full w-full object-cover" loading="lazy" />
                                            {isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                                                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <label
                            htmlFor="verifier-camera"
                            className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                            Reprendre
                        </label>
                        <button onClick={handleReset} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 dark:border-slate-700">
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleVerifier;
