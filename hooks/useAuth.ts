import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { IRootState } from '@/store';
import { logoutUser } from '@/store/authSlice';
import { UserRole } from '@/types/auth';
import Swal from 'sweetalert2';

const ROLE_RANK: Record<UserRole, number> = {
    super_admin: 4,
    admin: 3,
    manager: 2,
    operator: 1,
};

/**
 * Custom hook for authentication operations
 *
 * Provides convenient access to auth state and operations like logout
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, logout } = useAuth();
 * ```
 */
export function useAuth() {
    const dispatch = useDispatch();
    const router = useRouter();
    const auth = useSelector((state: IRootState) => state.auth);

    const role = (auth.user?.role ?? 'operator') as UserRole;

    /** true if user has at least the given role level */
    const hasRole = (...roles: UserRole[]): boolean => roles.some((r) => ROLE_RANK[role] >= ROLE_RANK[r]);

    const isSuperAdmin = role === 'super_admin';
    const isAdmin = hasRole('admin');
    const isManager = hasRole('manager');
    const isOperator = hasRole('operator');

    const logout = async () => {
        const result = await Swal.fire({
            title: 'Déconnexion',
            text: 'Voulez-vous vous déconnecter ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui, déconnecter',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#d33',
        });

        if (result.isConfirmed) {
            try {
                await dispatch(logoutUser() as any);

                Swal.fire({
                    icon: 'success',
                    title: 'Déconnecté',
                    timer: 1500,
                    showConfirmButton: false,
                });

                router.push('/management/auth');
            } catch {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: 'Échec de la déconnexion.',
                });
            }
        }
    };

    return {
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        error: auth.error,
        role,
        isSuperAdmin,
        isAdmin,
        isManager,
        isOperator,
        hasRole,
        logout,
    };
}
