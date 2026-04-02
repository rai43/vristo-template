'use client';
import { IRootState } from '@/store';
import { usePathname } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

const ContentAnimation = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const [animation, setAnimation] = useState(themeConfig.animation);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setAnimation(themeConfig.animation);
    }, [themeConfig.animation]);

    useEffect(() => {
        // Start transition
        setIsTransitioning(true);
        setAnimation(themeConfig.animation);

        // End transition after animation completes
        const timeout = setTimeout(() => {
            setAnimation('');
            setIsTransitioning(false);
        }, 400);

        return () => clearTimeout(timeout);
    }, [pathname, themeConfig.animation]);

    return (
        <div
            ref={containerRef}
            className={`${animation} animate__animated p-6 transition-opacity duration-200 ${isTransitioning ? 'animate__faster' : ''}`}
            style={{ minHeight: isTransitioning ? containerRef.current?.offsetHeight : undefined }}
        >
            {children}
        </div>
    );
};

export default ContentAnimation;
