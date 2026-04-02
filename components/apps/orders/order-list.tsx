'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import ComponentsAppsOrders from './components-apps-orders';

const OrderList = () => {
    const router = useRouter();

    return (
        <div className="p-4 lg:p-10">
            <ComponentsAppsOrders />
        </div>
    );
};

export default OrderList;
