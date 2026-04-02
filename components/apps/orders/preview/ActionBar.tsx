'use client';
import IconDownload from '@/components/icon/icon-download';
import IconEdit from '@/components/icon/icon-edit';
import IconPrinter from '@/components/icon/icon-printer';
import IconSend from '@/components/icon/icon-send';
import IconArrowLeft from '@/components/icon/icon-arrow-left';
import Link from 'next/link';
import React, { useState } from 'react';
import { Order } from '@/lib/api/orders';
import { getBackLink } from './utils';
import { PAPER_SIZES, type PaperSize } from './InvoicePDF';

interface ActionBarProps {
    order: Order;
    isGeneratingPdf: boolean;
    paperSize: PaperSize;
    setPaperSize: (size: PaperSize) => void;
    onPrint: () => void;
    onDownload: () => void;
    onSend: () => void;
}

const ActionBar = ({ order, isGeneratingPdf, paperSize, setPaperSize, onPrint, onDownload, onSend }: ActionBarProps) => {
    const [showSizes, setShowSizes] = useState(false);

    return (
        <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-2 border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-lg dark:border-slate-700/50 dark:bg-[#1a2234]/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={getBackLink()}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                    <IconArrowLeft className="h-4 w-4" />
                    Retour
                </Link>

                <div className="flex items-center gap-2">
                    {/* Paper size selector */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowSizes((p) => !p)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            title="Format papier"
                        >
                            📄 {PAPER_SIZES[paperSize].label}
                            <span className="text-[10px] opacity-60">▾</span>
                        </button>
                        {showSizes && (
                            <div className="absolute right-0 top-10 z-50 min-w-[100px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
                                {Object.entries(PAPER_SIZES).map(([key, val]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setPaperSize(key as PaperSize);
                                            setShowSizes(false);
                                        }}
                                        className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${
                                            paperSize === key ? 'bg-primary/5 text-primary' : 'text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        {val.label}
                                        <span className="ml-1 text-[10px] text-slate-400">
                                            {val.w}×{val.h}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Send */}
                    <button
                        type="button"
                        onClick={onSend}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        title="Envoyer par WhatsApp"
                    >
                        <IconSend className="h-4 w-4" />
                        <span className="hidden sm:inline">Envoyer</span>
                    </button>

                    {/* Print */}
                    <button
                        type="button"
                        onClick={onPrint}
                        disabled={isGeneratingPdf}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10 disabled:opacity-60"
                        title="Imprimer / Aperçu PDF"
                    >
                        {isGeneratingPdf ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-l-transparent" /> : <IconPrinter className="h-4 w-4" />}
                        <span className="hidden sm:inline">{isGeneratingPdf ? 'Génération…' : 'PDF'}</span>
                    </button>

                    {/* Download */}
                    <button
                        type="button"
                        onClick={onDownload}
                        disabled={isGeneratingPdf}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-60"
                        title="Télécharger PDF"
                    >
                        <IconDownload className="h-4 w-4" />
                        <span className="hidden sm:inline">Télécharger</span>
                    </button>

                    {/* Edit */}
                    <Link
                        href={`/apps/orders/edit/${order._id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
                    >
                        <IconEdit className="h-4 w-4" />
                        <span className="hidden sm:inline">Modifier</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ActionBar;
