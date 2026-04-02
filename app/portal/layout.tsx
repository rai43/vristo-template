'use client';
import React from 'react';
import { useClientPushNotifications } from '@/hooks/useClientPushNotifications';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    useClientPushNotifications();
    return <>{children}</>;
}
