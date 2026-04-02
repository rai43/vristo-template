/**
 * Shared constants for order creation and editing
 */

export const ADD_ONS: Record<number, { name: string; price: number; vetements: number; pickups: number }> = {
    0: { name: 'Aucun', price: 0, vetements: 0, pickups: 0 },
    1: { name: '+1 récupération', price: 5000, vetements: 20, pickups: 1 },
    2: { name: '+2 récupérations', price: 10000, vetements: 40, pickups: 2 },
    3: { name: '+3 récupérations', price: 15000, vetements: 60, pickups: 3 },
    4: { name: '+4 récupérations', price: 20000, vetements: 80, pickups: 4 },
};

export const WHITE_SURCHARGE = 250;
