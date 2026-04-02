import ComponentsAppsOrderPreview from '@/components/apps/orders/preview';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Order Preview',
};

const OrderPreview = ({ params }: { params: { id: string } }) => {
    return <ComponentsAppsOrderPreview orderId={params.id} />;
};

export default OrderPreview;
