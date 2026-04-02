/**
 * InvoicePDF — Professional laundry invoice for MIRAI Services.
 * Pure inline styles for html2pdf rendering. Designed for A4 print.
 */
import React from 'react';
import { Order } from '@/lib/api/orders';
import { Pack } from '@/lib/api/packs';

interface Props {
    order: Order;
    packsMap: Record<string, string>;
    packsData: Pack[];
    resolvePackName: (_code?: string) => string;
}

export const PAPER_SIZES: Record<string, { label: string; w: number; h: number }> = {
    a4: { label: 'A4', w: 210, h: 297 },
    a5: { label: 'A5', w: 148, h: 210 },
    a6: { label: 'A6', w: 105, h: 148 },
    b5: { label: 'B5', w: 176, h: 250 },
    letter: { label: 'Letter', w: 216, h: 279 },
};

export type PaperSize = keyof typeof PAPER_SIZES;

/* ── Helpers ──────────────────────────────────────────────── */
const fmt = (d?: string | Date) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};
const fmtShort = (d?: string | Date) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const money = (n?: number) => ((n ?? 0) === 0 ? '0' : (n ?? 0).toLocaleString('fr-FR'));

/* ── Design tokens ────────────────────────────────────────── */
const C = {
    primary: '#0f766e',
    primaryLight: '#f0fdfa',
    black: '#0f172a',
    dark: '#334155',
    mid: '#64748b',
    light: '#94a3b8',
    line: '#e2e8f0',
    bg: '#f8fafc',
    white: '#ffffff',
    green: '#059669',
    greenBg: '#ecfdf5',
    red: '#dc2626',
    redBg: '#fef2f2',
    amber: '#d97706',
    amberBg: '#fffbeb',
};

const font = "'Inter', 'Segoe UI', -apple-system, sans-serif";
const mono = "'JetBrains Mono', 'SF Mono', 'Courier New', monospace";

const InvoicePDF = React.forwardRef<HTMLDivElement, Props>(({ order, packsMap: _packsMap, packsData, resolvePackName }, ref) => {
    const client = order.customerId as any;

    const itemsSubtotal = order.items.reduce((s: number, it: any) => s + it.quantity * it.unitPrice, 0);
    const deliveryFee = order.type === 'subscription'
        ? (order.deliverySchedule || []).reduce((s: number, op: any) => s + (op.fee || 0), 0)
        : order.delivery?.enabled ? order.delivery?.fee || 0 : 0;
    const pickupFee = order.type === 'a-la-carte' ? (order.pickup?.enabled ? order.pickup?.fee || 0 : 0) : 0;
    const surplusAmt = order.surplusAmount || 0;
    const total = order.totalPrice ?? itemsSubtotal + deliveryFee + pickupFee + surplusAmt;
    const paid = order.totalPaid || 0;
    const remaining = Math.max(0, total - paid);
    const isSub = order.type === 'subscription';
    const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

    const packLimits = (() => {
        if (!isSub || !order.packName || !packsData?.length) return null;
        const pack = packsData.find((p: any) => p.code === order.packName || p.name === order.packName);
        if (!pack) return null;
        const tot = (pack as any).totalClothes || (pack as any).clothesLimit || 0;
        const couettes = (pack as any).specialItemLimits?.couettes || 0;
        const vestes = (pack as any).specialItemLimits?.vestes || 0;
        const draps = (pack as any).specialItemLimits?.draps_serviettes || 0;
        return { total: tot, ordinaires: Math.max(0, tot - couettes - vestes - draps), couettes, vestes, draps };
    })();

    return (
        <div ref={ref} style={{ fontFamily: font, fontSize: '11px', color: C.dark, background: C.white, padding: '36px 40px', lineHeight: 1.55, maxWidth: '800px', margin: '0 auto' }}>

            {/* ═══ HEADER ═══ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px' }}>
                <tbody><tr>
                    <td style={{ verticalAlign: 'middle', width: '50%' }}>
                        <table style={{ borderCollapse: 'collapse' }}><tbody><tr>
                            <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/mirai-logo-white-bg.png" alt="MIRAI" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px' }} />
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                                <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: C.black, letterSpacing: '-0.3px' }}>MIRAI Services</p>
                                <p style={{ margin: '2px 0 0', fontSize: '9px', color: C.light, letterSpacing: '0.3px' }}>Pressing & Entretien Textile</p>
                            </td>
                        </tr></tbody></table>
                    </td>
                    <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: C.primary, letterSpacing: '-0.5px', lineHeight: 1 }}>FACTURE</p>
                        <p style={{ margin: '6px 0 0', fontSize: '10px', color: C.mid }}>N° <span style={{ fontFamily: mono, fontWeight: 700, color: C.black, fontSize: '11px' }}>{order.orderId}</span></p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: C.mid }}>{fmt(order.createdAt)}</p>
                    </td>
                </tr></tbody>
            </table>

            {/* ═══ CLIENT + ORDER INFO ═══ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <tbody><tr>
                    <td style={{ verticalAlign: 'top', width: '50%', paddingRight: '16px' }}>
                        <div style={{ background: C.bg, borderRadius: '8px', padding: '14px 16px', border: `1px solid ${C.line}` }}>
                            <p style={{ margin: '0 0 6px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.primary }}>Facturé à</p>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: C.black }}>{client?.name || '—'}</p>
                            {client?.location && <p style={{ margin: '4px 0 0', fontSize: '10px', color: C.mid }}>📍 {client.location}</p>}
                            {client?.phones?.[0] && <p style={{ margin: '2px 0 0', fontSize: '10px', color: C.mid }}>📞 {client.phones[0].number}</p>}
                        </div>
                    </td>
                    <td style={{ verticalAlign: 'top', width: '50%' }}>
                        <div style={{ background: C.primaryLight, borderRadius: '8px', padding: '14px 16px', border: `1px solid ${C.line}` }}>
                            <p style={{ margin: '0 0 6px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.primary }}>{isSub ? 'Abonnement' : 'Commande'}</p>
                            {order.packName && <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: C.black }}>{resolvePackName(order.packName)}</p>}
                            {isSub && order.subscriptionStartDate && (
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.dark }}>📅 {fmtShort(order.subscriptionStartDate)}{order.subscriptionEndDate && ` → ${fmtShort(order.subscriptionEndDate)}`}</p>
                            )}
                            {isSub && (order.pickupSchedule || []).length > 0 && <p style={{ margin: 0, fontSize: '10px', color: C.dark }}>🔄 {(order.pickupSchedule || []).length} récupérations</p>}
                            {!isSub && order.pickup?.enabled && <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.dark }}>📦 Récup. {fmtShort(order.pickup?.date)}</p>}
                            {!isSub && order.delivery?.enabled && <p style={{ margin: 0, fontSize: '10px', color: C.dark }}>🚚 Livraison {fmtShort(order.delivery?.date)}</p>}
                        </div>
                    </td>
                </tr></tbody>
            </table>

            {/* ═══ ITEMS TABLE ═══ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
                <thead><tr>
                    {[
                        { text: 'Description', align: 'left' as const, w: undefined },
                        { text: 'Qté', align: 'center' as const, w: '60px' },
                        { text: 'P.U.', align: 'right' as const, w: '80px' },
                        { text: 'Total', align: 'right' as const, w: '90px' },
                    ].map((col) => (
                        <th key={col.text} style={{ padding: '10px 14px', fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: col.align, width: col.w, color: C.mid, borderBottom: `2px solid ${C.primary}` }}>{col.text}</th>
                    ))}
                </tr></thead>
                <tbody>
                    {order.items.map((item: any, i: number) => {
                        const bg = i % 2 === 0 ? C.white : C.bg;
                        return (
                            <tr key={i}>
                                <td style={{ padding: '10px 14px', background: bg, borderBottom: `1px solid ${C.line}` }}>
                                    <span style={{ fontWeight: 600, color: C.black, fontSize: '11px' }}>{item.category === 'package' ? resolvePackName(item.name) : item.name}</span>
                                    {item.serviceType && <span style={{ fontSize: '9px', color: C.light, marginLeft: '6px' }}>· {item.serviceType}</span>}
                                </td>
                                <td style={{ padding: '10px 14px', background: bg, textAlign: 'center', fontWeight: 600, color: C.black, borderBottom: `1px solid ${C.line}` }}>{item.quantity}</td>
                                <td style={{ padding: '10px 14px', background: bg, textAlign: 'right', color: C.mid, borderBottom: `1px solid ${C.line}` }}>{money(item.unitPrice)} F</td>
                                <td style={{ padding: '10px 14px', background: bg, textAlign: 'right', fontWeight: 700, color: C.black, borderBottom: `1px solid ${C.line}` }}>{money(item.quantity * item.unitPrice)} F</td>
                            </tr>
                        );
                    })}
                    {(order.surplus || []).map((si: any, i: number) => (
                        <tr key={`s${i}`}>
                            <td style={{ padding: '10px 14px', background: C.amberBg, borderBottom: `1px solid ${C.line}` }}>
                                <span style={{ fontWeight: 600, color: C.amber, fontSize: '11px' }}>{si.name}</span>
                                <span style={{ fontSize: '8px', color: C.amber, marginLeft: '6px', opacity: 0.7 }}>(surplus)</span>
                            </td>
                            <td style={{ padding: '10px 14px', background: C.amberBg, textAlign: 'center', fontWeight: 600, color: C.amber, borderBottom: `1px solid ${C.line}` }}>{si.quantity}</td>
                            <td style={{ padding: '10px 14px', background: C.amberBg, textAlign: 'right', color: C.amber, borderBottom: `1px solid ${C.line}` }}>{money(si.unitPrice)} F</td>
                            <td style={{ padding: '10px 14px', background: C.amberBg, textAlign: 'right', fontWeight: 700, color: C.amber, borderBottom: `1px solid ${C.line}` }}>{money(si.quantity * si.unitPrice)} F</td>
                        </tr>
                    ))}
                    {deliveryFee > 0 && (
                        <tr>
                            <td colSpan={3} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.line}`, fontSize: '10px', color: C.mid }}>🚚 Livraison{isSub ? ` (${(order.deliverySchedule || []).length} op.)` : ''}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: C.dark, borderBottom: `1px solid ${C.line}` }}>{money(deliveryFee)} F</td>
                        </tr>
                    )}
                    {pickupFee > 0 && (
                        <tr>
                            <td colSpan={3} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.line}`, fontSize: '10px', color: C.mid }}>📦 Récupération</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: C.dark, borderBottom: `1px solid ${C.line}` }}>{money(pickupFee)} F</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* ═══ TOTALS ═══ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <tbody><tr>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '16px', paddingTop: '12px' }}>
                        <div style={{ display: 'inline-block', background: remaining === 0 ? C.greenBg : C.amberBg, border: `1px solid ${remaining === 0 ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px' }}>
                            <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: remaining === 0 ? C.green : C.amber }}>
                                {remaining === 0 ? '✅ Entièrement payé' : `⏳ ${paidPct}% payé`}
                            </p>
                            {remaining > 0 && paid > 0 && (
                                <div style={{ marginTop: '6px', height: '4px', borderRadius: '2px', background: '#fde68a', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '2px', background: C.amber, width: `${paidPct}%` }} />
                                </div>
                            )}
                        </div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px 14px', fontSize: '11px', color: C.mid }}>Sous-total</td>
                                    <td style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 600, color: C.dark, textAlign: 'right' }}>{money(itemsSubtotal)} F</td>
                                </tr>
                                {surplusAmt > 0 && (
                                    <tr>
                                        <td style={{ padding: '6px 14px', fontSize: '11px', color: C.amber }}>Surplus</td>
                                        <td style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, color: C.amber, textAlign: 'right' }}>{money(surplusAmt)} F</td>
                                    </tr>
                                )}
                                <tr>
                                    <td colSpan={2} style={{ padding: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.primary, color: C.white, padding: '12px 14px', borderRadius: '8px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 800 }}>TOTAL</span>
                                            <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: mono }}>{money(total)} FCFA</span>
                                        </div>
                                    </td>
                                </tr>
                                {paid > 0 && (
                                    <tr>
                                        <td style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 600, color: C.green }}>Payé</td>
                                        <td style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 700, color: C.green, textAlign: 'right' }}>− {money(paid)} F</td>
                                    </tr>
                                )}
                                {remaining > 0 && (
                                    <tr>
                                        <td colSpan={2} style={{ padding: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.redBg, border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: C.red }}>Reste à payer</span>
                                                <span style={{ fontSize: '14px', fontWeight: 800, color: C.red, fontFamily: mono }}>{money(remaining)} FCFA</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </td>
                </tr></tbody>
            </table>

            {/* ═══ SCHEDULE (subscription) ═══ */}
            {isSub && (order.pickupSchedule || []).length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.primary }}>Planning des opérations</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                            {['Op.', 'Récupération', 'Livraison', 'Articles', 'Statut'].map((h, idx) => (
                                <th key={h} style={{ padding: '6px 10px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.light, borderBottom: `1px solid ${C.line}`, textAlign: idx === 0 ? 'center' as const : 'left' as const }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {(order.pickupSchedule || []).map((p: any, i: number) => {
                                const d = order.deliverySchedule?.[i];
                                const statusLabels: Record<string, string> = { pending: 'En attente', registered: 'Enregistré', processing: 'Traitement', ready_for_delivery: 'Prêt', out_for_delivery: 'En livraison', delivered: 'Livré' };
                                return (
                                    <tr key={i}>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: C.primary, borderBottom: `1px solid ${C.line}` }}>{i + 1}</td>
                                        <td style={{ padding: '6px 10px', fontSize: '10px', color: C.dark, borderBottom: `1px solid ${C.line}` }}>{fmtShort(p.date)}</td>
                                        <td style={{ padding: '6px 10px', fontSize: '10px', color: C.dark, borderBottom: `1px solid ${C.line}` }}>{d ? fmtShort(d.date) : '—'}</td>
                                        <td style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 600, color: p.clothesCount ? C.black : C.light, borderBottom: `1px solid ${C.line}` }}>{p.clothesCount || '—'}</td>
                                        <td style={{ padding: '6px 10px', fontSize: '9px', color: C.mid, borderBottom: `1px solid ${C.line}` }}>{statusLabels[p.status] || p.status || 'En attente'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ PACK LIMITS ═══ */}
            {packLimits && packLimits.total > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.primary }}>Limites du pack — {resolvePackName(order.packName)}</p>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px 0' }}>
                        <tbody><tr>
                            {[
                                { l: 'Total', v: packLimits.total, accent: true },
                                { l: 'Ordinaires', v: packLimits.ordinaires },
                                { l: 'Couettes', v: packLimits.couettes },
                                { l: 'Vestes', v: packLimits.vestes },
                                { l: 'Draps/Serv.', v: packLimits.draps },
                            ].map((x) => (
                                <td key={x.l} style={{ textAlign: 'center', padding: '8px 4px', background: x.accent ? C.primary : C.primaryLight, borderRadius: '6px' }}>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: x.accent ? C.white : C.black }}>{x.v}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.5px', color: x.accent ? 'rgba(255,255,255,.7)' : C.light }}>{x.l}</p>
                                </td>
                            ))}
                        </tr></tbody>
                    </table>
                </div>
            )}

            {/* ═══ PAYMENTS ═══ */}
            {(order.payments || []).length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: C.primary }}>Paiements</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            {(order.payments || []).map((p: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ padding: '6px 12px', fontSize: '10px', color: C.mid, borderBottom: `1px solid ${C.line}` }}>{fmtShort(p.paidAt)}</td>
                                    <td style={{ padding: '6px 12px', fontSize: '10px', color: C.dark, borderBottom: `1px solid ${C.line}` }}>{p.method}</td>
                                    <td style={{ padding: '6px 12px', fontSize: '9px', fontFamily: mono, color: C.light, borderBottom: `1px solid ${C.line}` }}>{p.reference || ''}</td>
                                    <td style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: C.green, textAlign: 'right', borderBottom: `1px solid ${C.line}` }}>+{money(p.amount)} F</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ NOTES ═══ */}
            {order.note && (
                <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.primary }}>Notes</p>
                    <p style={{ margin: 0, fontSize: '10px', color: C.dark, lineHeight: 1.6 }}>{order.note}</p>
                </div>
            )}

            {/* ═══ PAYMENT METHODS ═══ */}
            {remaining > 0 && (
                <div style={{ background: C.primaryLight, border: `1px solid ${C.line}`, borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.primary }}>Moyens de paiement</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', color: C.dark }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '3px 0', width: '50%' }}>💙 <strong>Wave</strong> : pay.wave.com/m/M_ci_3tpsoJ4gRGkb</td>
                                <td style={{ padding: '3px 0' }}>🟠 <strong>Orange Money</strong> : 07 08 30 92 57</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 0' }}>🔵 <strong>MOOV Money</strong> : 01 53 17 82 22</td>
                                <td style={{ padding: '3px 0' }}>🟡 <strong>MTN Money</strong> : 05 02 24 06 06</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══ TERMS ═══ */}
            <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 5px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.primary }}>Conditions générales</p>
                <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '8px', color: C.light, lineHeight: 1.8 }}>
                    <li>Les articles seront livrés après paiement intégral.</li>
                    <li>Ce montant ne peut être remboursé une fois le paiement effectué.</li>
                    <li>Toute réclamation doit être signalée dans les 24h suivant la livraison.</li>
                    <li>Responsabilité limitée à 5× le prix du traitement par article endommagé.</li>
                    {isSub && <li>Abonnement non remboursable après démarrage.</li>}
                </ul>
            </div>

            {/* ═══ FOOTER ═══ */}
            <div style={{ borderTop: `2px solid ${C.primary}`, paddingTop: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', color: C.light }}>
                    <tbody><tr>
                        <td>
                            <strong style={{ color: C.primary }}>MIRAI Services</strong> · Pressing & Entretien Textile<br />
                            Angré Djorogobité 2, Cocody, Abidjan · +225 05 01 91 90 80 · infomiraisrv@gmail.com
                        </td>
                        <td style={{ textAlign: 'right' }}>
                            Facture <span style={{ fontFamily: mono, fontWeight: 600, color: C.mid }}>{order.orderId}</span><br />
                            Générée le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </td>
                    </tr></tbody>
                </table>
            </div>
        </div>
    );
});

InvoicePDF.displayName = 'InvoicePDF';
export default InvoicePDF;
