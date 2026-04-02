import OrderList from '@/components/apps/orders/order-list';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Orders List',
};

const OrdersList = () => {
    return <OrderList />;
};

export default OrdersList;
