'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface PageTransitionProps {
    children: React.ReactNode;
}

/**
 * PageTransition - Smooth fade transition between pages
 * Prevents layout shifting with fixed minimum height
 */
const PageTransition = ({ children }: PageTransitionProps) => {
    const pathname = usePathname();
    const [displayChildren, setDisplayChildren] = useState(children);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        // Capture current height before transition to prevent layout shift
        if (containerRef.current) {
            setMinHeight(containerRef.current.offsetHeight);
        }

        // Start fade out
        setIsTransitioning(true);

        // After fade out, swap content
        const swapTimeout = setTimeout(() => {
            setDisplayChildren(children);
            // Small delay before fade in
            requestAnimationFrame(() => {
                setIsTransitioning(false);
                // Reset min height after transition completes
                setTimeout(() => setMinHeight(undefined), 300);
            });
        }, 150);

        return () => clearTimeout(swapTimeout);
    }, [pathname, children]);

    return (
        <div
            ref={containerRef}
            className={`transition-opacity duration-200 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
            style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
        >
            {displayChildren}
        </div>
    );
};

export default PageTransition;
