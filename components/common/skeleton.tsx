'use client';
import React from 'react';

/**
 * Skeleton - Base shimmer loading component
 */
export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />;

/**
 * SkeletonText - Simulates text loading
 */
export const SkeletonText = ({ lines = 1, className = '' }: { lines?: number; className?: string }) => (
    <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
    </div>
);

/**
 * SkeletonCard - Card-shaped loading placeholder
 */
export const SkeletonCard = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>
        <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
        <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
        </div>
    </div>
);

/**
 * SkeletonTable - Table loading placeholder
 */
export const SkeletonTable = ({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) => (
    <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>
        {/* Header */}
        <div className="flex gap-4 border-b border-slate-100 p-4 dark:border-slate-700/50">
            {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
            ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 border-b border-slate-50 p-4 last:border-0 dark:border-slate-700/30">
                {Array.from({ length: cols }).map((_, colIndex) => (
                    <Skeleton key={colIndex} className={`h-4 flex-1 ${colIndex === 0 ? 'w-1/4' : ''}`} />
                ))}
            </div>
        ))}
    </div>
);

/**
 * SkeletonStats - Dashboard stats loading placeholder
 */
export const SkeletonStats = ({ count = 4, className = '' }: { count?: number; className?: string }) => (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${count} ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-6 w-16" />
                </div>
                <div className="mt-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="mt-2 h-3 w-32" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * SkeletonForm - Form loading placeholder
 */
export const SkeletonForm = ({ fields = 4, className = '' }: { fields?: number; className?: string }) => (
    <div className={`space-y-4 ${className}`}>
        {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
            </div>
        ))}
        <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
    </div>
);

/**
 * PageSkeleton - Full page loading skeleton
 */
export const PageSkeleton = ({ type = 'default' }: { type?: 'default' | 'table' | 'form' | 'dashboard' }) => {
    if (type === 'dashboard') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                <SkeletonStats count={4} />
                <div className="grid gap-6 lg:grid-cols-2">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
                <SkeletonTable rows={5} cols={5} />
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-40 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-64 rounded-lg" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                <SkeletonTable rows={10} cols={6} />
            </div>
        );
    }

    if (type === 'form') {
        return (
            <div className="mx-auto max-w-2xl space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                    <SkeletonForm fields={6} />
                </div>
            </div>
        );
    }

    // Default
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            <SkeletonCard />
            <SkeletonCard />
        </div>
    );
};

export default Skeleton;
