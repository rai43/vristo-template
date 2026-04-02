'use client';
import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {usePathname, useRouter} from 'next/navigation';
import {IRootState} from '@/store';
import {getCurrentUser, restoreSession} from '@/store/authSlice';
import Loading from '@/components/layouts/loading';

/**
 * AuthProvider Component
 *
 * Wraps the application to handle authentication state restoration,
 * session validation, and route protection.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useDispatch();
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isLoading } = useSelector((state: IRootState) => state.auth);

    // Public routes that don't require authentication
    const publicRoutes = ['/management/auth', '/register', '/portal'];

    const isPublicRoute = publicRoutes.some((route) => pathname?.startsWith(route));

    useEffect(() => {
        // Restore session from localStorage on mount
        dispatch(restoreSession() as any);

        // Validate session with backend if we have a session
        const isAuth = localStorage.getItem('isAuthenticated');
        if (isAuth === 'true') {
            dispatch(getCurrentUser() as any);
        }
    }, [dispatch]);

    useEffect(() => {
        // Redirect logic after authentication state is determined
        if (!isLoading) {
            if (!isAuthenticated && !isPublicRoute) {
                // Not authenticated and trying to access protected route
                router.push('/management/auth');
            } else if (isAuthenticated && pathname === '/management/auth') {
                // Authenticated and trying to access login page - redirect to dashboard
                router.push('/');
            }
        }
    }, [isAuthenticated, isLoading, isPublicRoute, router, pathname]);

    // Show loading screen while checking authentication
    if (isLoading && !isPublicRoute) {
        return <Loading />;
    }

    return <>{children}</>;
}
