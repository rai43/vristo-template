'use client';
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import type { Order } from '@/lib/api/orders';
import { respondToComment } from '@/lib/api/orders';

const STARS = [1, 2, 3, 4, 5];

const RatingStars = ({ value }: { value?: number }) => {
    if (!value) return <span className="text-xs text-slate-300">Pas encore noté</span>;
    return (
        <span className="inline-flex items-center gap-0.5">
            {STARS.map((s) => (
                <svg key={s} className={`h-4 w-4 ${s <= value ? 'text-amber-400' : 'text-slate-200 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
            <span className="ml-1 text-xs font-semibold text-amber-600 dark:text-amber-400">{value}/5</span>
        </span>
    );
};

const fmtDate = (d?: Date | string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ─── Comment with admin reply ─── */
const CommentWithReply = ({ comment, index, orderId }: { comment: any; index: number; orderId: string }) => {
    const queryClient = useQueryClient();
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState(comment.adminResponse || '');

    const replyMutation = useMutation({
        mutationFn: () => respondToComment(orderId, index, replyText),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['order'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setShowReply(false);
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Réponse enregistrée' });
        },
        onError: () => {
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000 }).fire({ icon: 'error', title: 'Erreur' });
        },
    });

    return (
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-700 dark:text-slate-200">{comment.text}</p>
                <span className="shrink-0 text-[10px] text-slate-400">{fmtDate(comment.createdAt)}</span>
            </div>
            {comment.operationType && (
                <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {comment.operationType === 'pickup' ? 'Récupération' : 'Livraison'} {comment.operationIndex != null ? `#${comment.operationIndex + 1}` : ''}
                </span>
            )}
            {/* Existing admin response */}
            {comment.adminResponse && !showReply && (
                <div className="mt-2 rounded-md border-l-2 border-primary bg-primary/5 p-2">
                    <p className="text-[10px] font-semibold text-primary">Réponse MIRAI :</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{comment.adminResponse}</p>
                    {comment.adminRespondedAt && (
                        <p className="mt-0.5 text-[9px] text-slate-400">{fmtDate(comment.adminRespondedAt)}</p>
                    )}
                    <button type="button" onClick={() => { setShowReply(true); setReplyText(comment.adminResponse); }} className="mt-1 text-[10px] font-medium text-primary hover:underline">
                        Modifier
                    </button>
                </div>
            )}
            {/* Reply input */}
            {showReply ? (
                <div className="mt-2 space-y-2">
                    <textarea
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                        rows={2}
                        placeholder="Répondre au commentaire..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => replyMutation.mutate()} disabled={!replyText.trim() || replyMutation.isPending} className="rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                            {replyMutation.isPending ? '...' : 'Envoyer'}
                        </button>
                        <button type="button" onClick={() => { setShowReply(false); setReplyText(comment.adminResponse || ''); }} className="rounded border border-slate-200 px-2.5 py-1 text-[10px] text-slate-500 dark:border-slate-600">
                            Annuler
                        </button>
                    </div>
                </div>
            ) : !comment.adminResponse && (
                <button type="button" onClick={() => setShowReply(true)} className="mt-2 text-[10px] font-medium text-primary hover:underline">
                    💬 Répondre
                </button>
            )}
        </div>
    );
};

interface Props {
    order: Order;
}

const ClientFeedbackSection = ({ order }: Props) => {
    const pickupSchedule = order.pickupSchedule || [];
    const deliverySchedule = order.deliverySchedule || [];
    const clientComments = (order as any).clientComments || [];

    // Collect per-operation ratings
    const operationRatings: Array<{
        label: string;
        rating?: number;
        comment?: string;
        adminResponse?: string;
    }> = [];

    if (order.type === 'subscription') {
        pickupSchedule.forEach((p: any, i: number) => {
            if (p.clientRating || p.clientComment) {
                operationRatings.push({
                    label: `Opération ${i + 1} — Récupération`,
                    rating: p.clientRating,
                    comment: p.clientComment,
                    adminResponse: p.adminResponse,
                });
            }
        });
        deliverySchedule.forEach((d: any, i: number) => {
            if (d.clientRating || d.clientComment) {
                operationRatings.push({
                    label: `Opération ${i + 1} — Livraison`,
                    rating: d.clientRating,
                    comment: d.clientComment,
                    adminResponse: d.adminResponse,
                });
            }
        });
    } else {
        // à la carte
        const p = order.pickup as any;
        const d = order.delivery as any;
        if (p?.clientRating || p?.clientComment) {
            operationRatings.push({ label: 'Récupération', rating: p.clientRating, comment: p.clientComment, adminResponse: p.adminResponse });
        }
        if (d?.clientRating || d?.clientComment) {
            operationRatings.push({ label: 'Livraison', rating: d.clientRating, comment: d.clientComment, adminResponse: d.adminResponse });
        }
    }

    // Don't show section if no feedback at all
    if (operationRatings.length === 0 && clientComments.length === 0) return null;

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                    <span className="text-lg">💬</span>
                    Avis & Commentaires du Client
                </h5>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    {operationRatings.length} avis · {clientComments.length} commentaire{clientComments.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {/* Operation Ratings */}
                {operationRatings.length > 0 && (
                    <div className="px-5 py-4">
                        <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Notes par opération</h6>
                        <div className="space-y-3">
                            {operationRatings.map((r, i) => (
                                <div key={i} className="flex flex-col gap-1 rounded-lg border border-slate-100 p-3 dark:border-slate-700/30">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.label}</span>
                                        <RatingStars value={r.rating} />
                                    </div>
                                    {r.comment && (
                                        <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">« {r.comment} »</p>
                                    )}
                                    {r.adminResponse && (
                                        <div className="mt-1.5 rounded-md border-l-2 border-primary bg-primary/5 p-2">
                                            <p className="text-[10px] font-semibold text-primary">Réponse MIRAI :</p>
                                            <p className="text-xs text-slate-700 dark:text-slate-300">{r.adminResponse}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Global Comments */}
                {clientComments.length > 0 && (
                    <div className="px-5 py-4">
                        <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Commentaires</h6>
                        <div className="space-y-2">
                            {clientComments.map((c: any, i: number) => (
                                <CommentWithReply key={i} comment={c} index={i} orderId={order._id} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientFeedbackSection;
