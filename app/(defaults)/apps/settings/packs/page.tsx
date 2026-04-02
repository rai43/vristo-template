import ComponentsAppsPacks from '@/components/apps/settings/components-apps-packs';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Gestion des Packs',
};

const Packs = () => {
    return <ComponentsAppsPacks />;
};

export default Packs;
