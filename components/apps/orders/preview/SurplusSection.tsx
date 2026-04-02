'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Order, SurplusItem, updateSurplus } from '@/lib/api/orders';
import { getPackLimits } from './utils';

interface SurplusSectionProps {
    order: Order;
    onOrderUpdate: (_order: Order) => void;
    packsData?: any[];
}

const EXTRA_ORDINAIRE_PRICE = 400;
const EXTRA_COUETTE_PRICE = 3000;
const EXTRA_VESTE_PRICE = 2500;
const EXTRA_DRAPS_PRICE = 1000;
const EXTRA_SERVIETTES_PRICE = 700;

const SurplusSection = ({ order, onOrderUpdate, packsData }: SurplusSectionProps) => {
    const [items, setItems] = useState<SurplusItem[]>([]);
    const [saving, setSaving] = useState(false);
    // New subscription activation: track which surplus categories will be absorbed by a new sub
    const [newSubMode, setNewSubMode] = useState(false);
    const [newSubAbsorbed, setNewSubAbsorbed] = useState<Record<string, number>>({});
    // Snapshot for rollback
    const [preNewSubItems, setPreNewSubItems] = useState<SurplusItem[] | null>(null);

    const limits = getPackLimits(order.packName, packsData);
    const isSubscription = order.type === 'subscription' && !!order.packName && limits.total > 0;

    // Calculate actual usage from pickups per category (handles both old combined and new separate format)
    const totalUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesCount || 0), 0) || 0;
    const couettesUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesDetails?.find((c: any) => c.name === 'Couettes')?.quantity || 0), 0) || 0;
    const vestesUsed = order.pickupSchedule?.reduce((sum, p) => sum + (p.clothesDetails?.find((c: any) => c.name === 'Vestes')?.quantity || 0), 0) || 0;
    // Support both old combined "Draps & Serviettes" and new separate "Draps" / "Serviettes"
    const drapsUsed =
        order.pickupSchedule?.reduce((sum, p) => {
            const combined = p.clothesDetails?.find((c: any) => c.name === 'Draps & Serviettes')?.quantity || 0;
            const drapsSep = p.clothesDetails?.find((c: any) => c.name === 'Draps')?.quantity || 0;
            return sum + combined + drapsSep;
        }, 0) || 0;
    const serviettesUsed =
        order.pickupSchedule?.reduce((sum, p) => {
            // Old combined format doesn't have separate serviettes — they're included in combined
            const serviettesSep = p.clothesDetails?.find((c: any) => c.name === 'Serviettes')?.quantity || 0;
            return sum + serviettesSep;
        }, 0) || 0;
    const drapsServiettesUsed = drapsUsed + serviettesUsed;
    const ordinairesUsed = Math.max(0, totalUsed - couettesUsed - vestesUsed - drapsServiettesUsed);

    // Per-category overages
    const extraOrdinaires = Math.max(0, ordinairesUsed - limits.ordinaires);
    const extraCouettes = Math.max(0, couettesUsed - limits.couettes);
    const extraVestes = Math.max(0, vestesUsed - limits.vestes);
    // Draps/Serviettes surplus: the pack limit counts them together, but draps are
    // more expensive (1000 FCFA) than serviettes (700 FCFA). To benefit the client,
    // draps get absorbed by the pack first, then remaining slots go to serviettes.
    // Example: limit=5, draps=6, serviettes=3 → pack absorbs 5 draps → surplus = 1 drap + 3 serviettes
    // Example: limit=5, draps=3, serviettes=4 → pack absorbs 3 draps + 2 serviettes → surplus = 2 serviettes
    const drapsAbsorbedByPack = Math.min(drapsUsed, limits.draps_serviettes);
    const remainingPackSlots = Math.max(0, limits.draps_serviettes - drapsAbsorbedByPack);
    const serviettesAbsorbedByPack = Math.min(serviettesUsed, remainingPackSlots);
    const extraDraps = Math.max(0, drapsUsed - drapsAbsorbedByPack);
    const extraServiettes = Math.max(0, serviettesUsed - serviettesAbsorbedByPack);
    const hasExcess = extraOrdinaires > 0 || extraCouettes > 0 || extraVestes > 0 || extraDraps > 0 || extraServiettes > 0;

    // Build auto surplus items from detected overages
    const buildAutoItems = (): SurplusItem[] => {
        const auto: SurplusItem[] = [];
        if (extraOrdinaires > 0) {
            auto.push({
                name: 'Ordinaires (surplus)',
                unitPrice: EXTRA_ORDINAIRE_PRICE,
                quantity: extraOrdinaires,
                category: 'extra_count',
            });
        }
        if (extraCouettes > 0) {
            auto.push({
                name: 'Couettes (surplus)',
                unitPrice: EXTRA_COUETTE_PRICE,
                quantity: extraCouettes,
                category: 'extra_count',
            });
        }
        if (extraVestes > 0) {
            auto.push({
                name: 'Vestes (surplus)',
                unitPrice: EXTRA_VESTE_PRICE,
                quantity: extraVestes,
                category: 'extra_count',
            });
        }
        if (extraDraps > 0) {
            auto.push({
                name: 'Draps (surplus)',
                unitPrice: EXTRA_DRAPS_PRICE,
                quantity: extraDraps,
                category: 'extra_draps',
            });
        }
        if (extraServiettes > 0) {
            auto.push({
                name: 'Serviettes (surplus)',
                unitPrice: EXTRA_SERVIETTES_PRICE,
                quantity: extraServiettes,
                category: 'extra_serviettes',
            });
        }
        return auto;
    };

    // Initialize from order data or auto-compute
    useEffect(() => {
        if (!isSubscription) return;
        if (order.surplus && order.surplus.length > 0) {
            setItems(order.surplus);
        } else {
            setItems(buildAutoItems());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order.surplus, order.pickupSchedule, isSubscription]);

    const surplusTotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items]);
    const hasChanges = useMemo(() => JSON.stringify(order.surplus || []) !== JSON.stringify(items), [items, order.surplus]);

    // ── New subscription activation logic ─────────────────
    const SUBSCRIPTION_CATEGORIES = ['Couettes', 'Vestes', 'Draps & Serviettes', 'Draps', 'Serviettes'];

    const subscriptionEligibleSurplus = useMemo(() => {
        return items.filter((i) => SUBSCRIPTION_CATEGORIES.some((cat) => i.name.toLowerCase().includes(cat.toLowerCase())));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    const hasSubscriptionEligible = subscriptionEligibleSurplus.length > 0;

    const absorbedTotal = useMemo(
        () =>
            Object.entries(newSubAbsorbed).reduce((sum, [name, qty]) => {
                const item = preNewSubItems?.find((i) => i.name === name);
                return sum + (item ? item.unitPrice * qty : 0);
            }, 0),
        [newSubAbsorbed, preNewSubItems]
    );

    if (!isSubscription) return null;

    const addCustomItem = () => {
        setItems((prev) => [...prev, { name: '', unitPrice: 0, quantity: 1, category: 'custom' }]);
    };

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof SurplusItem, value: any) => {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const recalculateAuto = () => {
        const customItems = items.filter((i) => i.category === 'custom');
        setItems([...buildAutoItems(), ...customItems]);
    };

    const activateNewSubMode = () => {
        setPreNewSubItems(JSON.parse(JSON.stringify(items)));
        setNewSubMode(true);

        // Pre-select all subscription-eligible items to absorb
        const absorbed: Record<string, number> = {};
        subscriptionEligibleSurplus.forEach((item) => {
            absorbed[item.name] = item.quantity;
        });
        setNewSubAbsorbed(absorbed);

        // Remove subscription-eligible items from surplus (they'll be covered by new sub)
        setItems((prev) => prev.filter((i) => !SUBSCRIPTION_CATEGORIES.some((cat) => i.name.toLowerCase().includes(cat.toLowerCase()))));
    };

    const rollbackNewSubMode = () => {
        if (preNewSubItems) {
            setItems(preNewSubItems);
        }
        setNewSubMode(false);
        setNewSubAbsorbed({});
        setPreNewSubItems(null);
    };

    const adjustAbsorbed = (name: string, qty: number) => {
        setNewSubAbsorbed((prev) => ({ ...prev, [name]: Math.max(0, qty) }));
        // If qty is reduced from absorbed, add remaining back to surplus
        const originalItem = preNewSubItems?.find((i) => i.name === name);
        if (originalItem) {
            const surplusQty = originalItem.quantity - qty;
            setItems((prev) => {
                const existing = prev.find((i) => i.name === name);
                if (surplusQty > 0) {
                    if (existing) {
                        return prev.map((i) => (i.name === name ? { ...i, quantity: surplusQty } : i));
                    } else {
                        return [...prev, { ...originalItem, quantity: surplusQty }];
                    }
                } else {
                    return prev.filter((i) => i.name !== name);
                }
            });
        }
    };

    const handleSave = async () => {
        const validItems = items.filter((i) => i.name && i.unitPrice > 0 && i.quantity > 0);
        if (items.length > 0 && validItems.length !== items.length) {
            Swal.fire('Attention', 'Veuillez remplir tous les champs (nom, prix, quantité) ou supprimer les lignes vides.', 'warning');
            return;
        }
        setSaving(true);
        try {
            const response = await updateSurplus(order._id, validItems);
            onOrderUpdate(response.data);
            Swal.fire('Succès!', 'Surplus mis à jour', 'success');
        } catch (error: any) {
            Swal.fire('Erreur', error?.response?.data?.message || 'Échec de la mise à jour du surplus', 'error');
        } finally {
            setSaving(false);
        }
    };

    const categoryLabel: Record<string, string> = {
        extra_count: 'Dépassement',
        extra_draps: 'Dépassement draps',
        extra_serviettes: 'Dépassement serv.',
        custom: 'Hors pack',
    };

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                <div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">Surplus & Extras</h5>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                        Ordinaires : {ordinairesUsed}/{limits.ordinaires} · Couettes : {couettesUsed}/{limits.couettes} · Vestes : {vestesUsed}/{limits.vestes} · Draps/Serv. : {drapsUsed}/
                        {limits.draps_serviettes} · Total : {totalUsed}/{limits.total}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={recalculateAuto}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                        title="Recalculer automatiquement les dépassements"
                    >
                        Recalculer
                    </button>
                    <button type="button" onClick={addCustomItem} className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20">
                        + Article
                    </button>
                </div>
            </div>

            <div className="p-5">
                {/* Auto-detected surpluses info */}
                {hasExcess && (
                    <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Dépassements détectés :</strong>
                            {extraOrdinaires > 0 && ` ${extraOrdinaires} ordinaire(s) (${ordinairesUsed}/${limits.ordinaires})`}
                            {extraOrdinaires > 0 && (extraCouettes > 0 || extraVestes > 0 || extraDraps > 0) && ' ·'}
                            {extraCouettes > 0 && ` ${extraCouettes} couette(s) (${couettesUsed}/${limits.couettes})`}
                            {extraCouettes > 0 && (extraVestes > 0 || extraDraps > 0) && ' ·'}
                            {extraVestes > 0 && ` ${extraVestes} veste(s) (${vestesUsed}/${limits.vestes})`}
                            {extraVestes > 0 && extraDraps > 0 && ' ·'}
                            {extraDraps > 0 && ` ${extraDraps} drap(s)/serv. (${drapsUsed}/${limits.draps_serviettes})`}
                        </p>
                    </div>
                )}

                {/* New subscription activation option */}
                {hasExcess && hasSubscriptionEligible && !newSubMode && (
                    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-lg">🔄</span>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Option : Activer un nouvel abonnement</p>
                                <p className="mt-0.5 text-[11px] text-indigo-600/70 dark:text-indigo-400/60">
                                    Les articles éligibles (draps, serviettes, couettes, vestes) peuvent être déduits d&apos;un nouvel abonnement au lieu d&apos;être facturés en surplus.
                                </p>
                                <button
                                    type="button"
                                    onClick={activateNewSubMode}
                                    className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 active:scale-95"
                                >
                                    Appliquer à un nouvel abonnement →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* New subscription mode panel */}
                {newSubMode && (
                    <div className="mb-4 space-y-3 rounded-lg border-2 border-indigo-300 bg-indigo-50/50 p-4 dark:border-indigo-600 dark:bg-indigo-900/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">🔄</span>
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Nouvel abonnement — Articles absorbés</span>
                            </div>
                            <button
                                type="button"
                                onClick={rollbackNewSubMode}
                                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                            >
                                ↩ Annuler / Revenir
                            </button>
                        </div>
                        <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/60">
                            Ces articles seront comptés sur le nouveau pack au lieu d&apos;être facturés en surplus. Ajustez les quantités si nécessaire.
                        </p>
                        <div className="space-y-2">
                            {Object.entries(newSubAbsorbed).map(([name, qty]) => {
                                const originalItem = preNewSubItems?.find((i) => i.name === name);
                                if (!originalItem) return null;
                                return (
                                    <div key={name} className="flex items-center justify-between rounded-lg bg-white p-2.5 dark:bg-slate-800/50">
                                        <div>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{name.replace(' (surplus)', '')}</span>
                                            <span className="ml-2 text-[10px] text-indigo-500">→ nouvel abo.</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => adjustAbsorbed(name, qty - 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-700"
                                            >
                                                −
                                            </button>
                                            <span className="w-8 text-center text-xs font-bold text-indigo-700 dark:text-indigo-300">{qty}</span>
                                            <button
                                                onClick={() => adjustAbsorbed(name, Math.min(qty + 1, originalItem.quantity))}
                                                className="flex h-7 w-7 items-center justify-center rounded bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30"
                                            >
                                                +
                                            </button>
                                            <span className="ml-2 text-[10px] text-slate-400">/{originalItem.quantity}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {absorbedTotal > 0 && (
                            <div className="flex items-center justify-between rounded-lg bg-indigo-100 p-2.5 dark:bg-indigo-900/20">
                                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Économie sur surplus</span>
                                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">−{absorbedTotal.toLocaleString()} FCFA</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Items table */}
                {items.length > 0 ? (
                    <div className="space-y-2">
                        {/* Header row */}
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <div className="col-span-2">Catégorie</div>
                            <div className="col-span-4">Désignation</div>
                            <div className="col-span-2 text-right">Prix unit.</div>
                            <div className="col-span-1 text-center">Qté</div>
                            <div className="col-span-2 text-right">Total</div>
                            <div className="col-span-1" />
                        </div>

                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/30 p-2 dark:border-slate-700/30 dark:bg-slate-800/20">
                                <div className="col-span-2">
                                    <span
                                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                            item.category === 'extra_count'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                : item.category === 'extra_draps'
                                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
                                                : item.category === 'extra_serviettes'
                                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400'
                                                : 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                                        }`}
                                    >
                                        {categoryLabel[item.category]}
                                    </span>
                                </div>
                                <div className="col-span-4">
                                    {item.category === 'custom' ? (
                                        <input
                                            type="text"
                                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                                            value={item.name}
                                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                                            placeholder="Ex: Peluches, Couvertures..."
                                        />
                                    ) : (
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                                    )}
                                </div>
                                <div className="col-span-2 text-right">
                                    {item.category === 'custom' ? (
                                        <input
                                            type="number"
                                            className="w-full rounded border border-slate-200 px-2 py-1 text-right text-xs dark:border-slate-600 dark:bg-slate-800"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                                            min="0"
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-600 dark:text-slate-300">{item.unitPrice.toLocaleString()} F</span>
                                    )}
                                </div>
                                <div className="col-span-1 text-center">
                                    <input
                                        type="number"
                                        className="w-full rounded border border-slate-200 px-1 py-1 text-center text-xs dark:border-slate-600 dark:bg-slate-800"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                        min="0"
                                    />
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{(item.unitPrice * item.quantity).toLocaleString()} F</span>
                                </div>
                                <div className="col-span-1 text-right">
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                        title="Supprimer"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Total row */}
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-800/50">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total Surplus</span>
                            <span className={`text-base font-bold ${surplusTotal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{surplusTotal.toLocaleString()} FCFA</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                        <p className="text-sm text-slate-400">Aucun surplus enregistré</p>
                        {hasExcess && (
                            <button type="button" onClick={recalculateAuto} className="mt-2 text-xs font-medium text-primary hover:underline">
                                Calculer automatiquement
                            </button>
                        )}
                    </div>
                )}

                {/* Save button */}
                {hasChanges && (
                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                            {saving ? 'Enregistrement...' : 'Enregistrer le surplus'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SurplusSection;
