import ComponentsAppsPriceCatalog from '@/components/apps/settings/components-apps-price-catalog';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Gestion du Catalogue de Prix',
};

const PriceCatalog = () => {
    return <ComponentsAppsPriceCatalog />;
};

export default PriceCatalog;
