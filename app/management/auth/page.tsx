import MiraiLoginForm from '@/components/auth/mirai-login-form';
import { Metadata } from 'next';
import Image from 'next/image';
import React from 'react';

export const metadata: Metadata = {
    title: 'Login | Mirai Services – Les Laveries',
    description: 'Sign in to your Mirai Services account',
};

const ManagementAuthPage = () => {
    return (
        <div>
            <div className="absolute inset-0">
                <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" />
            </div>

            <div className="relative flex min-h-screen items-center justify-center bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-10 dark:bg-[#060818] sm:px-16">
                <img src="/assets/images/auth/coming-soon-object1.png" alt="decoration" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <img src="/assets/images/auth/coming-soon-object2.png" alt="decoration" className="absolute left-24 top-0 h-40 md:left-[30%]" />
                <img src="/assets/images/auth/coming-soon-object3.png" alt="decoration" className="absolute right-0 top-0 h-[300px]" />
                <img src="/assets/images/auth/polygon-object.svg" alt="decoration" className="absolute bottom-0 end-[28%]" />

                <div className="relative w-full max-w-[870px] rounded-md bg-[linear-gradient(45deg,#fff9f9_0%,rgba(255,255,255,0)_25%,rgba(255,255,255,0)_75%,_#fff9f9_100%)] p-2 dark:bg-[linear-gradient(52.22deg,#0E1726_0%,rgba(14,23,38,0)_18.66%,rgba(14,23,38,0)_51.04%,rgba(14,23,38,0)_80.07%,#0E1726_100%)]">
                    <div className="relative flex flex-col justify-center rounded-md bg-white/60 px-6 py-20 backdrop-blur-lg dark:bg-black/50 lg:min-h-[758px]">
                        <div className="mx-auto w-full max-w-[440px]">
                            {/* Logo */}
                            <div className="mb-10 flex justify-center">
                                <div className="relative">
                                    <Image src="/mirai-logo.png" alt="Mirai Services" width={100} height={100} className="rounded-xl shadow-lg" priority />
                                </div>
                            </div>

                            {/* Header */}
                            <div className="mb-10 text-center">
                                <h1 className="text-3xl font-extrabold uppercase !leading-snug md:text-4xl" style={{ color: '#8B4513' }}>
                                    Mirai Services
                                </h1>
                                <h2 className="mt-2 text-2xl font-bold leading-snug text-dark dark:text-white">Les Laveries</h2>
                                <p className="mt-3 text-base font-semibold leading-normal text-white-dark">Sign in to your account</p>
                            </div>

                            {/* Login Form */}
                            <MiraiLoginForm />

                            {/* Footer Note */}
                            <div className="mt-8 text-center text-sm text-white-dark">
                                <p>Professional Laundry Management System</p>
                                <p className="mt-2">© {new Date().getFullYear()} Mirai Services. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagementAuthPage;
