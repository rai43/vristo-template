'use client';
import RegistrationFlow from '@/components/apps/registrations/registration-flow';
import React, { Suspense } from 'react';

const NewRegistrationPage = () => {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
            }
        >
            <RegistrationFlow />
        </Suspense>
    );
};

export default NewRegistrationPage;
