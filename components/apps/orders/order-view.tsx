'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import ComponentsAppsOrderPreview from './preview';

const OrderView = () => {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');

    if (!orderId) {
        return (
            <div className="p-4 lg:p-10">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-2xl font-bold">View Order</h2>
                </div>
                <div className="panel p-5">
                    <div className="flex flex-col items-center justify-center py-10">
                        <div className="mb-5 text-lg">No order selected</div>
                    </div>
                </div>
            </div>
        );
    }

    return <ComponentsAppsOrderPreview orderId={orderId} />;
};

export default OrderView;
