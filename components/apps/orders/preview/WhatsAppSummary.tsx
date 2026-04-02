'use client';
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { Order } from '@/lib/api/orders';
import { getPackLimits } from './utils';

interface WhatsAppSummaryProps {
    order: Order;
    resolvePackName: (_code?: string) => string;
    packsData?: any[];
}

const WhatsAppSummary = ({ order, resolvePackName, packsData }: WhatsAppSummaryProps) => {
    const [showPreview, setShowPreview] = useState(false);

    if (order.type !== 'subscription' || !order.packName || !order.pickupSchedule?.length) return null;

    const limits = getPackLimits(order.packName, packsData);
    const packDisplayName = resolvePackName(order.packName) || order.packName;
    const clientName = order.customerId?.name || 'N/A';
    const clientPhone = order.customerId?.phones?.[0]?.number || '';

    // Build the summary text
    const buildSummary = (): string => {
        const lines: string[] = [];
        const totalPickups = order.pickupSchedule!.length;

        // ── Header
        lines.push('*📋 RÉSUMÉ DE COMMANDE — MIRAI Services*');
        lines.push('');
        lines.push(`*Cliente :* ${clientName}`);
        lines.push(`*Pack choisi :* ${packDisplayName}`);
        lines.push(`*Montant du pack :* ${order.items?.[0]?.unitPrice?.toLocaleString() || order.totalPrice.toLocaleString()} FCFA`);

        if (order.subscriptionStartDate && order.subscriptionEndDate) {
            const start = new Date(order.subscriptionStartDate).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
            });
            const end = new Date(order.subscriptionEndDate).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
            });
            lines.push(`*Période de validité :* ${start} au ${end}`);
        }

        if (limits.total > 0) {
            const detailParts: string[] = [];
            if (limits.ordinaires > 0) detailParts.push(`${limits.ordinaires} vêtements ordinaires`);
            if (limits.draps_serviettes > 0) detailParts.push(`${limits.draps_serviettes} draps et serviettes maximum`);
            if (limits.vestes > 0) detailParts.push(`${limits.vestes} vestes maximum`);
            if (limits.couettes > 0) detailParts.push(`${limits.couettes} couette(s) maximum`);
            lines.push(`*Nombre d'articles inclus :* ${limits.total} pièces`);
            if (detailParts.length) lines.push(`_(${detailParts.join(', ')})_`);
        }

        lines.push('');
        lines.push('⸻');

        // ── Per-pickup breakdown with cumulative tracking
        let cumulOrdinaires = 0;
        let cumulDraps = 0; // combined draps+serviettes for pack limit comparison
        let cumulDrapsOnly = 0; // draps only for surplus breakdown
        let cumulServiettesOnly = 0; // serviettes only for surplus breakdown
        let cumulVestes = 0;
        let cumulCouettes = 0;
        const cumulOther: Record<string, number> = {};
        let cumulTotal = 0;
        let pickupsWithDataCount = 0;

        order.pickupSchedule!.forEach((pickup, index) => {
            if (!pickup.clothesCount || pickup.clothesCount === 0) return;
            pickupsWithDataCount++;

            const pickupDate = new Date(pickup.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
            });
            const ordinal = index === 0 ? '1ʳᵉ' : `${index + 1}ᵉ`;
            const isLastPickup = index === totalPickups - 1;

            lines.push('');
            lines.push(`*📦 ${ordinal} récupération – ${pickupDate}*`);
            lines.push('');

            const couettes = pickup.clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0;
            const vestes = pickup.clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0;
            // Support both old combined "Draps & Serviettes" and new separate "Draps" / "Serviettes"
            const drapsCombined = pickup.clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
            const drapsSep = pickup.clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
            const serviettesSep = pickup.clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
            const drapsTotal = drapsCombined + drapsSep;
            const serviettesTotal = serviettesSep;
            const drapsServTotal = drapsTotal + serviettesTotal;
            const specialTotal = couettes + vestes + drapsServTotal;
            const ordinaires = Math.max(0, (pickup.clothesCount || 0) - specialTotal);

            const knownNames = ['Couettes', 'Vestes', 'Draps & Serviettes', 'Draps', 'Serviettes'];
            const otherItems = pickup.clothesDetails?.filter((c: any) => !knownNames.includes(c.name)) || [];

            lines.push(`Vêtements : ${ordinaires}`);
            lines.push(`Draps : ${String(drapsTotal).padStart(2, '0')}`);
            lines.push(`Serviettes : ${String(serviettesTotal).padStart(2, '0')}`);
            lines.push(`Vestes : ${String(vestes).padStart(2, '0')}`);
            lines.push(`Couettes : ${String(couettes).padStart(2, '0')}`);

            otherItems.forEach((item: any) => {
                lines.push(`${item.name} : ${String(item.quantity).padStart(2, '0')}`);
                cumulOther[item.name] = (cumulOther[item.name] || 0) + item.quantity;
            });

            lines.push('');
            lines.push(`🧾 *Total : ${pickup.clothesCount} pièces*`);

            // Update cumulative
            cumulOrdinaires += ordinaires;
            cumulDraps += drapsServTotal;
            cumulDrapsOnly += drapsTotal;
            cumulServiettesOnly += serviettesTotal;
            cumulVestes += vestes;
            cumulCouettes += couettes;
            cumulTotal += pickup.clothesCount || 0;

            // Remaining for next pickup or final message
            if (limits.total > 0) {
                lines.push('');
                const remainingTotal = limits.total - cumulTotal;
                const remainingOrdinaires = limits.ordinaires - cumulOrdinaires;
                const remainingDraps = limits.draps_serviettes - cumulDraps;
                const remainingVestes = limits.vestes - cumulVestes;
                const remainingCouettes = limits.couettes - cumulCouettes;

                // Check if pack is exceeded
                const packExceeded = remainingTotal <= 0 || remainingOrdinaires <= 0;

                if (isLastPickup || packExceeded) {
                    if (packExceeded && !isLastPickup) {
                        lines.push('⚠️ *Pack épuisé — les prochaines récupérations seront facturées en surplus.*');
                    } else {
                        lines.push('✅ *Dernière récupération — Pack terminé.*');
                    }
                    if (remainingTotal > 0) {
                        lines.push(`_Restant non utilisé : ${remainingTotal} pièce(s)_`);
                    }
                    if (remainingOrdinaires < 0) {
                        lines.push(`_Dépassement ordinaires : ${Math.abs(remainingOrdinaires)} pièce(s) en surplus_`);
                    }
                } else {
                    // Format end date for display
                    const endDateStr = order.subscriptionEndDate
                        ? new Date(order.subscriptionEndDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                          })
                        : '';

                    lines.push(`*Restant pour prochaine récupération${endDateStr ? ` avant ${endDateStr}` : ''} :*`);
                    lines.push(`\t•\tTotal : ${Math.max(0, remainingTotal)} pièce(s)`);
                    lines.push(`\t•\tOrdinaires : ${Math.max(0, remainingOrdinaires)}`);
                    lines.push(`\t•\tDraps / Serviettes : ${Math.max(0, remainingDraps)}`);
                    lines.push(`\t•\tVestes : ${Math.max(0, remainingVestes)}`);
                    lines.push(`\t•\tCouettes : ${Math.max(0, remainingCouettes)}`);
                }
            }

            lines.push('');
            lines.push('⸻');
        });

        // ── Cumulative summary (only if multiple pickups with data)
        if (pickupsWithDataCount > 1) {
            lines.push('');
            lines.push(`*Cumul des ${pickupsWithDataCount} récupérations*`);
            lines.push('');
            lines.push(`Vêtements : ${cumulOrdinaires}`);
            lines.push(`Draps / Serviettes : ${cumulDraps}`);
            lines.push(`Vestes : ${cumulVestes}`);
            lines.push(`Couettes : ${cumulCouettes}`);
            Object.entries(cumulOther).forEach(([name, qty]) => {
                lines.push(`${name} : ${qty}`);
            });
            lines.push('');
            lines.push(`🧾 *Total cumulé : ${cumulTotal} pièces*`);
            lines.push('');
            lines.push('⸻');
        }

        // ── Surplus analysis
        const surplusItems = order.surplus || [];
        const surplusAmount = order.surplusAmount || 0;

        if (surplusItems.length > 0 && surplusAmount > 0) {
            lines.push('');
            lines.push('*Analyse*');
            lines.push('');

            if (cumulOrdinaires > limits.ordinaires) {
                lines.push(`Le pack donne droit à ${limits.ordinaires} vêtements ordinaires maximum.`);
                lines.push(`Nous avons reçu ${cumulOrdinaires} vêtements ordinaires.`);
                lines.push(`Il y a donc *${cumulOrdinaires - limits.ordinaires} pièce(s) en surplus*.`);
                lines.push('');
            }
            if (cumulCouettes > limits.couettes) {
                lines.push(`Le pack donne droit à ${limits.couettes} couette(s) maximum.`);
                lines.push(`Nous avons reçu ${cumulCouettes} couette(s).`);
                lines.push(`Il y a donc *${cumulCouettes - limits.couettes} couette(s) en surplus*.`);
                lines.push('');
            }
            if (cumulVestes > limits.vestes) {
                lines.push(`Le pack donne droit à ${limits.vestes} veste(s) maximum.`);
                lines.push(`Nous avons reçu ${cumulVestes} veste(s).`);
                lines.push(`Il y a donc *${cumulVestes - limits.vestes} veste(s) en surplus*.`);
                lines.push('');
            }
            if (cumulDraps > limits.draps_serviettes) {
                // Priority logic: draps (more expensive) absorbed first, then serviettes
                const drapsInPack = Math.min(cumulDrapsOnly, limits.draps_serviettes);
                const slotsForServiettes = Math.max(0, limits.draps_serviettes - drapsInPack);
                const surplusDraps = Math.max(0, cumulDrapsOnly - drapsInPack);
                const surplusServiettes = Math.max(0, cumulServiettesOnly - slotsForServiettes);

                lines.push(`Le pack donne droit à ${limits.draps_serviettes} draps et serviettes maximum.`);
                lines.push(`Nous avons reçu ${cumulDrapsOnly} drap(s) et ${cumulServiettesOnly} serviette(s) (${cumulDraps} au total).`);
                if (surplusDraps > 0 && surplusServiettes > 0) {
                    lines.push(`Il y a donc *${surplusDraps} drap(s) + ${surplusServiettes} serviette(s) en surplus*.`);
                } else if (surplusDraps > 0) {
                    lines.push(`Il y a donc *${surplusDraps} drap(s) en surplus*.`);
                } else if (surplusServiettes > 0) {
                    lines.push(`Il y a donc *${surplusServiettes} serviette(s) en surplus*.`);
                }
                lines.push('');
            }

            lines.push('⸻');
            lines.push('');
            lines.push('*Facturation du surplus*');
            surplusItems.forEach((item) => {
                if (item.quantity > 0) {
                    const lineTotal = (item.quantity * item.unitPrice).toLocaleString();
                    lines.push(`\t•\t${item.name} : ${item.quantity} × ${item.unitPrice.toLocaleString()} FCFA = ${lineTotal} FCFA`);
                }
            });
            lines.push('');
            lines.push(`*Total surplus : ${surplusAmount.toLocaleString()} FCFA*`);

            // Check if any subscription-eligible categories have surplus
            const subEligibleExcess = [
                cumulCouettes > limits.couettes ? { name: 'Couettes', qty: cumulCouettes - limits.couettes } : null,
                cumulVestes > limits.vestes ? { name: 'Vestes', qty: cumulVestes - limits.vestes } : null,
                cumulDraps > limits.draps_serviettes
                    ? {
                          name: 'Draps / Serviettes',
                          qty: cumulDraps - limits.draps_serviettes,
                      }
                    : null,
            ].filter(Boolean);

            if (subEligibleExcess.length > 0) {
                lines.push('');
                lines.push('⸻');
                lines.push('');
                lines.push('*💡 Option : Nouvel abonnement*');
                lines.push('');
                lines.push('Vous avez la possibilité de souscrire à un nouvel abonnement pour absorber les articles spéciaux en surplus :');
                subEligibleExcess.forEach((item: any) => {
                    lines.push(`\t•\t${item.name} : ${item.qty} pièce(s) → inclus dans le nouveau pack`);
                });
                lines.push('');
                lines.push('_Les articles seront déduits du nouveau pack et le surplus correspondant sera annulé._');
                lines.push('_Contactez-nous pour choisir le pack adapté à vos besoins._');
            }

            lines.push('');
            lines.push('⸻');
        }

        // ── Financial summary
        const basePrice = order.totalPrice - surplusAmount;
        const totalPaid = order.totalPaid || 0;
        const remaining = order.totalPrice - totalPaid;

        lines.push('');
        lines.push('*Informations financières*');
        lines.push(`\t•\tMontant du pack : ${basePrice.toLocaleString()} FCFA`);
        if (surplusAmount > 0) {
            lines.push(`\t•\tMontant du surplus : ${surplusAmount.toLocaleString()} FCFA`);
        }
        lines.push(`\t•\t*Montant total arrêté : ${order.totalPrice.toLocaleString()} FCFA*`);
        if (totalPaid > 0) {
            lines.push(`\t•\tAvance payée : ${totalPaid.toLocaleString()} FCFA`);
        }
        lines.push(`\t•\t*Reste à payer : ${Math.max(0, remaining).toLocaleString()} FCFA*`);

        lines.push('');
        lines.push('⸻');
        lines.push('');
        lines.push('*Moyens de règlement disponibles :*');
        lines.push('• Wave : https://pay.wave.com/m/M_ci_3tpsoJ4gRGkb/c/ci/?amount');
        lines.push('• ORANGE Money : 07 08 30 92 57');
        lines.push('• MOOV Money : 01 53 17 82 22');
        lines.push('• MTN Money : 05 02 24 06 06');
        lines.push(`*IMPORTANT : Toute validation est conditionnée par l'envoi de la capture du dépôt. Merci de transmettre la preuve du paiement après chaque versement.*`);

        lines.push('');
        lines.push('⸻');
        lines.push('');
        lines.push('_MIRAI Services – Pressing & Entretien Textile_');
        lines.push('_📞 +225 05 01 91 90 80 (WhatsApp & Appel)_');

        return lines.join('\n');
    };

    const handleCopy = async () => {
        const text = buildSummary();
        try {
            await navigator.clipboard.writeText(text);
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 2000 }).fire({
                icon: 'success',
                title: 'Copié dans le presse-papiers !',
            });
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 2000 }).fire({
                icon: 'success',
                title: 'Copié !',
            });
        }
    };

    const handleWhatsApp = () => {
        const text = buildSummary();
        const phone = clientPhone?.replace(/\s+/g, '').replace(/^\+/, '');
        const encoded = encodeURIComponent(text);
        if (phone) {
            window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
        } else {
            window.open(`https://wa.me/?text=${encoded}`, '_blank');
        }
    };

    const summaryText = buildSummary();

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <h5 className="text-sm font-bold text-slate-800 dark:text-white">Résumé WhatsApp</h5>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                        {showPreview ? 'Masquer' : 'Aperçu'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    >
                        <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                            Copier
                        </span>
                    </button>
                    <button type="button" onClick={handleWhatsApp} className="rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#1da851]">
                        <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp
                        </span>
                    </button>
                </div>
            </div>

            {/* Preview */}
            {showPreview && (
                <div className="p-5">
                    <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/50 p-4 font-sans text-xs leading-relaxed text-slate-700 dark:border-slate-700/30 dark:bg-slate-800/30 dark:text-slate-300">
                        {summaryText}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default WhatsAppSummary;
