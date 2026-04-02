'use client';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { IRootState } from '@/store';
import { toggleSidebar, toggleTheme } from '@/store/themeConfigSlice';
import { useAuth } from '@/hooks/useAuth';
import Dropdown from '@/components/dropdown';
import IconMenu from '@/components/icon/icon-menu';
import IconSun from '@/components/icon/icon-sun';
import IconMoon from '@/components/icon/icon-moon';
import IconLaptop from '@/components/icon/icon-laptop';
import IconUser from '@/components/icon/icon-user';
import IconLogout from '@/components/icon/icon-logout';
import IconMenuCalendar from '@/components/icon/menu/icon-menu-calendar';
import IconMenuInvoice from '@/components/icon/menu/icon-menu-invoice';
import IconMenuContacts from '@/components/icon/menu/icon-menu-contacts';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    super_admin: { label: 'Super Admin', color: 'bg-danger/10 text-danger' },
    admin: { label: 'Admin', color: 'bg-primary/10 text-primary' },
    manager: { label: 'Manager', color: 'bg-info/10 text-info' },
    operator: { label: 'Opérateur', color: 'bg-success/10 text-success' },
};

const Header = () => {
    const dispatch = useDispatch();
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass) === 'rtl';
    const { user, logout, role } = useAuth();

    const initials = user?.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : '?';
    const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.operator;

    return (
        <header className={`z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}>
            <div className="shadow-sm">
                <div className="relative flex w-full items-center bg-white px-5 py-2.5 dark:bg-black">
                    {/* Mobile logo + hamburger */}
                    <div className="horizontal-logo flex items-center justify-between lg:hidden ltr:mr-2 rtl:ml-2">
                        <Link href="/dashboard" className="main-logo flex shrink-0 items-center">
                            <img className="inline w-8" src="/mirai-logo.png" alt="MIRAI" />
                            <span className="hidden align-middle text-2xl font-semibold dark:text-white-light md:inline ltr:ml-1.5">MIRAI</span>
                        </Link>
                        <button
                            type="button"
                            className="collapse-icon flex flex-none rounded-full bg-white-light/40 p-2 hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:text-[#d0d2d6] dark:hover:bg-dark/60 dark:hover:text-primary lg:hidden ltr:ml-2"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconMenu className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Quick links (desktop) */}
                    <div className="hidden sm:block ltr:mr-2 rtl:ml-2">
                        <ul className="flex items-center space-x-1 dark:text-[#d0d2d6]">
                            <li>
                                <Link
                                    href="/apps/operations"
                                    className="flex items-center gap-1.5 rounded-lg bg-white-light/40 px-3 py-1.5 text-sm font-medium hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                >
                                    <IconMenuCalendar className="h-4 w-4" />
                                    <span className="hidden xl:inline">Opérations</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/apps/orders/list"
                                    className="flex items-center gap-1.5 rounded-lg bg-white-light/40 px-3 py-1.5 text-sm font-medium hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                >
                                    <IconMenuInvoice className="h-4 w-4" />
                                    <span className="hidden xl:inline">Commandes</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/apps/customers"
                                    className="flex items-center gap-1.5 rounded-lg bg-white-light/40 px-3 py-1.5 text-sm font-medium hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                >
                                    <IconMenuContacts className="h-4 w-4" />
                                    <span className="hidden xl:inline">Clients</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/apps/orders/add" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
                                    + Commande
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center space-x-2 dark:text-[#d0d2d6] ltr:ml-auto rtl:mr-auto">
                        {/* Theme toggle */}
                        <div>
                            {themeConfig.theme === 'light' && (
                                <button
                                    className="flex items-center rounded-full bg-white-light/40 p-2 hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('dark'))}
                                >
                                    <IconSun />
                                </button>
                            )}
                            {themeConfig.theme === 'dark' && (
                                <button
                                    className="flex items-center rounded-full bg-white-light/40 p-2 hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('system'))}
                                >
                                    <IconMoon />
                                </button>
                            )}
                            {themeConfig.theme === 'system' && (
                                <button
                                    className="flex items-center rounded-full bg-white-light/40 p-2 hover:bg-white-light/90 hover:text-primary dark:bg-dark/40 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('light'))}
                                >
                                    <IconLaptop />
                                </button>
                            )}
                        </div>

                        {/* User menu */}
                        <div className="dropdown flex shrink-0">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName="relative group block"
                                button={
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-white shadow-sm ring-2 ring-primary/20 transition-all group-hover:ring-primary/40">
                                        {initials}
                                    </div>
                                }
                            >
                                <ul className="w-[220px] !py-0 font-semibold text-dark dark:text-white-dark dark:text-white-light/90">
                                    {/* User info */}
                                    <li>
                                        <div className="flex items-center gap-3 border-b border-white-light px-4 py-4 dark:border-white-light/10">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-base font-bold text-white">
                                                {initials}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{user?.name || '—'}</p>
                                                <p className="truncate text-xs text-slate-400">{user?.email || ''}</p>
                                                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleInfo.color}`}>{roleInfo.label}</span>
                                            </div>
                                        </div>
                                    </li>
                                    {/* Profile */}
                                    <li>
                                        <Link href="/users/user-account-settings" className="dark:hover:text-white">
                                            <IconUser className="h-4.5 w-4.5 shrink-0 ltr:mr-2 rtl:ml-2" />
                                            Mon profil
                                        </Link>
                                    </li>
                                    {/* Sign out */}
                                    <li className="border-t border-white-light dark:border-white-light/10">
                                        <button type="button" onClick={logout} className="w-full !py-3 text-left text-danger">
                                            <IconLogout className="h-4.5 w-4.5 shrink-0 rotate-90 ltr:mr-2 rtl:ml-2" />
                                            Déconnexion
                                        </button>
                                    </li>
                                </ul>
                            </Dropdown>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
