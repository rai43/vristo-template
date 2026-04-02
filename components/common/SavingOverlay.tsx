'use client';
import React from 'react';

export interface SavingOverlayStep {
    key: string;
    label: string;
    icon: string;
}

export interface SavingOverlayProps {
    /** Controls overlay visibility */
    isVisible: boolean;
    /** Main title — e.g. "Enregistrement en cours", "Mise à jour du client..." */
    title?: string;
    /** Subtitle — e.g. entity name or extra context */
    subtitle?: string;
    /** Optional step indicators for multi-step save processes */
    steps?: SavingOverlayStep[];
    /** Current step text — used to determine which step is active (matched via includes) */
    currentStep?: string;
    /** Optional progress bar */
    progress?: { current: number; total: number };
    /** Whether to use a modal style (centered card) vs fullscreen. Default: false (fullscreen) */
    modal?: boolean;
}

/**
 * Reusable full-screen or modal saving/editing overlay with animated step indicators.
 *
 * Usage:
 * ```tsx
 * <SavingOverlay
 *   isVisible={isSaving}
 *   title="Création du client..."
 *   subtitle={form.name}
 * />
 * ```
 *
 * With steps:
 * ```tsx
 * <SavingOverlay
 *   isVisible={isSaving}
 *   title="Enregistrement en cours"
 *   subtitle="John Doe — 45 pièces"
 *   steps={[
 *     { key: 'create', label: "Création de l'enregistrement", icon: '📝' },
 *     { key: 'articles', label: 'Sauvegarde des articles', icon: '👕' },
 *     { key: 'photos', label: 'Envoi des photos', icon: '📷' },
 *   ]}
 *   currentStep={saveStep}
 *   progress={{ current: 3, total: 10 }}
 * />
 * ```
 */
const SavingOverlay: React.FC<SavingOverlayProps> = ({
    isVisible,
    title = 'Enregistrement en cours...',
    subtitle,
    steps,
    currentStep,
    progress,
    modal = false,
}) => {
    if (!isVisible) return null;

    const content = (
        <div className="mx-auto w-full max-w-sm px-6">
            {/* Spinner + title */}
            <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/30 border-t-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
                {subtitle && (
                    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                )}
            </div>

            {/* Step indicators */}
            {steps && steps.length > 0 && (
                <div className="space-y-3">
                    {steps.map((s, i) => {
                        let stepState: 'pending' | 'active' | 'done' = 'pending';
                        if (currentStep) {
                            const currentIdx = steps.findIndex((st) =>
                                currentStep.toLowerCase().includes(st.key.toLowerCase())
                            );
                            if (currentIdx >= 0) {
                                if (i < currentIdx) stepState = 'done';
                                else if (i === currentIdx) stepState = 'active';
                            }
                        }

                        return (
                            <div
                                key={s.key}
                                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                                    stepState === 'active'
                                        ? 'border-primary/30 bg-primary/5 shadow-sm'
                                        : stepState === 'done'
                                        ? 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10'
                                        : 'border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-800/20'
                                }`}
                            >
                                <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all ${
                                        stepState === 'active'
                                            ? 'bg-primary text-white'
                                            : stepState === 'done'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                                    }`}
                                >
                                    {stepState === 'done' ? (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : stepState === 'active' ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    ) : (
                                        <span className="text-xs">{s.icon}</span>
                                    )}
                                </div>
                                <span
                                    className={`text-sm font-medium ${
                                        stepState === 'active'
                                            ? 'text-primary'
                                            : stepState === 'done'
                                            ? 'text-green-700 dark:text-green-400'
                                            : 'text-slate-400'
                                    }`}
                                >
                                    {s.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Progress bar */}
            {progress && progress.total > 0 && (
                <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                    </div>
                    <p className="mt-1 text-center text-xs text-slate-400">
                        {progress.current}/{progress.total}
                    </p>
                </div>
            )}
        </div>
    );

    if (modal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a2234]">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur dark:bg-[#0e1726]/95">
            {content}
        </div>
    );
};

export default SavingOverlay;
