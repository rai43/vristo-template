'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * NavigationProgress - Fires instantly on click, completes when page loads.
 *
 * Listens for clicks on <a> tags (Next.js Link renders <a>) that point to
 * internal routes. Starts the progress bar immediately on click, then
 * completes it when the pathname actually changes.
 */
const NavigationProgress = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isNavigating, setIsNavigating] = useState(false);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevPathRef = useRef(pathname);

    // Start the progress bar
    const start = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        setIsNavigating(true);
        setProgress(15); // Jump to 15% immediately for instant feedback

        intervalRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return prev;
                }
                const increment = prev < 30 ? 8 : prev < 60 ? 4 : prev < 80 ? 2 : 1;
                return Math.min(prev + increment, 90);
            });
        }, 150);
    }, []);

    // Complete the progress bar
    const complete = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setProgress(100);
        setTimeout(() => {
            setIsNavigating(false);
            setProgress(0);
        }, 250);
    }, []);

    // Listen for clicks on internal links — fires INSTANTLY
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            // Skip external links, hash links, new-tab links
            if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
            if (anchor.target === '_blank') return;
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;

            // Skip if it's the same page
            if (href === pathname) return;

            // Start immediately!
            start();
        };

        document.addEventListener('click', handleClick, { capture: true });
        return () => document.removeEventListener('click', handleClick, { capture: true });
    }, [pathname, start]);

    // Complete when pathname actually changes
    useEffect(() => {
        if (prevPathRef.current !== pathname) {
            complete();
            prevPathRef.current = pathname;
        }
    }, [pathname, searchParams, complete]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    if (!isNavigating && progress === 0) return null;

    return (
        <div className="fixed left-0 right-0 top-0 z-[9999] h-[3px] overflow-hidden">
            <div className="absolute inset-0 bg-primary/10" />
            <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary via-primary to-cyan-400"
                style={{
                    width: `${progress}%`,
                    boxShadow: '0 0 10px rgba(67, 97, 238, 0.5)',
                    transition: progress === 100 ? 'width 150ms ease-out' : 'width 300ms ease-out',
                }}
            />
        </div>
    );
};

export default NavigationProgress;
