import OrderView from '@/components/apps/orders/order-view';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'View Order',
};

const ViewOrder = () => {
    return <OrderView />;
};

export default ViewOrder;
