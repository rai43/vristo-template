import React, { Suspense } from 'react';
import NavigationProgress from '@/components/layouts/navigation-progress';

const ManagementLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <Suspense fallback={null}>
                <NavigationProgress />
            </Suspense>
            <div className="min-h-screen text-black dark:text-white-dark">{children}</div>
        </>
    );
};

export default ManagementLayout;
