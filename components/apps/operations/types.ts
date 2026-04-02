// ─── Operation Status ──────────────────────────────────────
export type OperationStatus = 'pending' | 'confirmed' | 'registered' | 'processing' | 'ready_for_delivery' | 'out_for_delivery' | 'not_delivered' | 'delivered' | 'returned' | 'cancelled';

// ─── View Tabs ─────────────────────────────────────────────
export type ViewTab = 'daily' | 'calendar' | 'priority' | 'pickups' | 'deliveries' | 'stock' | 'dashboard' | 'collections' | 'planning' | 'tracking';

// ─── Operation (single pickup or delivery) ─────────────────
export interface Operation {
    orderId: string;
    orderMongoId: string;
    operationType: 'pickup' | 'delivery';
    operationIndex: number;
    date: string;
    scheduledTime?: string;
    preferredTime?: string; // Client-requested preferred time period
    status: OperationStatus;
    city?: string;
    clothesCount?: number;
    clothesDetails?: Array<{ category: string; name: string; quantity: number }>;
    customer: {
        name: string;
        location?: string;
        phone?: string;
        zone?: string;
    };
    packName?: string;
    totalPrice?: number;
    paymentStatus?: string;
    pickupAgent?: string;
    deliveryAgent?: string;
    isOverdue: boolean;
    isReadyForDelivery?: boolean;
    shouldBeInProgress?: boolean;
    isSubscription: boolean;
    subscriptionStatus?: string;
    subscriptionActive?: boolean;
    // Computed fields from backend
    isLate?: boolean;
    isToWash?: boolean;
    daysAfterPickup?: number;
    isTerminal?: boolean;
    // Computed on frontend
    isNew?: boolean;
    note?: string;
    // Lead-based potential operation
    isLead?: boolean;
}

// ─── Daily Operations Grouped ──────────────────────────────
export interface DailyOperations {
    urgentOps: Operation[];
    toWashToday: Operation[];
    toDeliverToday: Operation[];
    toPickupToday: Operation[];
    inProgress: Operation[];
}

// ─── Stats ─────────────────────────────────────────────────
export interface OperationStats {
    total: number;
    awaitingPickup: number;
    overduePickups: number;
    readyForDelivery: number;
    overdueDeliveries: number;
    shouldBeInProgress: number;
    inStock?: number;
    toWashToday?: number;
    lateCount?: number;
}

// ─── Calendar Event ────────────────────────────────────────
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    classNames: string[];
    editable?: boolean;
    extendedProps: Operation;
}
