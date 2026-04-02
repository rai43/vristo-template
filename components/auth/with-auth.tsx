'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { IRootState } from '@/store';
import Loading from '@/components/layouts/loading';

/**
 * Higher-Order Component for Route Protection
 *
 * Wraps page components to ensure only authenticated users can access them.
 * Redirects to login page if user is not authenticated.
 *
 * @example
 * ```tsx
 * const ProtectedPage = withAuth(MyPageComponent);
 * export default ProtectedPage;
 * ```
 */
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
    return function WithAuthComponent(props: P) {
        const router = useRouter();
        const { isAuthenticated, isLoading } = useSelector((state: IRootState) => state.auth);

        useEffect(() => {
            if (!isLoading && !isAuthenticated) {
                router.push('/management/auth');
            }
        }, [isAuthenticated, isLoading, router]);

        // Show loading while checking authentication
        if (isLoading) {
            return <Loading />;
        }

        // Don't render component if not authenticated
        if (!isAuthenticated) {
            return null;
        }

        return <Component {...props} />;
    };
}
