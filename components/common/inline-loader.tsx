'use client';
import React from 'react';

interface InlineLoaderProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
}

/**
 * InlineLoader - A compact loading indicator for use within components
 */
const InlineLoader = ({ size = 'md', text, className = '' }: InlineLoaderProps) => {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-3',
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            <div className={`animate-spin rounded-full border-primary/30 border-t-primary ${sizeClasses[size]}`} />
            {text && <span className={`text-slate-500 dark:text-slate-400 ${textSizeClasses[size]}`}>{text}</span>}
        </div>
    );
};

/**
 * LoadingOverlay - Full component overlay with loading state
 */
export const LoadingOverlay = ({ isLoading, children, text = 'Chargement...' }: { isLoading: boolean; children: React.ReactNode; text?: string }) => {
    return (
        <div className="relative">
            {children}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                    <InlineLoader size="lg" text={text} />
                </div>
            )}
        </div>
    );
};

/**
 * ButtonLoader - Loading state for buttons
 */
export const ButtonLoader = ({ className = '' }: { className?: string }) => <div className={`h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;

/**
 * DataLoader - Wrapper for data fetching states
 */
export const DataLoader = ({
    isLoading,
    isEmpty,
    error,
    children,
    loadingComponent,
    emptyComponent,
    errorComponent,
}: {
    isLoading: boolean;
    isEmpty?: boolean;
    error?: string | null;
    children: React.ReactNode;
    loadingComponent?: React.ReactNode;
    emptyComponent?: React.ReactNode;
    errorComponent?: React.ReactNode;
}) => {
    if (isLoading) {
        return (
            loadingComponent || (
                <div className="flex min-h-[200px] items-center justify-center">
                    <InlineLoader size="lg" text="Chargement des données..." />
                </div>
            )
        );
    }

    if (error) {
        return (
            errorComponent || (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
                        <svg className="h-6 w-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">Erreur de chargement</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                </div>
            )
        );
    }

    if (isEmpty) {
        return (
            emptyComponent || (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                        </svg>
                    </div>
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">Aucune donnée</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Il n&apos;y a pas de données à afficher</p>
                    </div>
                </div>
            )
        );
    }

    return <>{children}</>;
};

export default InlineLoader;
