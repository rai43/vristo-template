import OrderAdd from '@/components/apps/orders/order-add';
import { Metadata } from 'next';
import React, { Suspense } from 'react';

export const metadata: Metadata = {
    title: 'Add Order',
};

const AddOrder = () => {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[400px] items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
            }
        >
            <OrderAdd />
        </Suspense>
    );
};

export default AddOrder;
