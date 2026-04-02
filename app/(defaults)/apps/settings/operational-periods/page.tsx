import ComponentsAppsOperationalPeriods from '@/components/apps/settings/components-apps-operational-periods';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Périodes Opérationnelles | MIRAI Services',
};

const OperationalPeriodsPage = () => {
    return <ComponentsAppsOperationalPeriods />;
};

export default OperationalPeriodsPage;

