import ComponentsAppsZones from '@/components/apps/settings/components-apps-zones';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Gestion des Zones | MIRAI Services',
};

const ZonesPage = () => {
    return <ComponentsAppsZones />;
};

export default ZonesPage;
