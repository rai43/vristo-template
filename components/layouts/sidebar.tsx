'use client';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import { toggleSidebar } from '@/store/themeConfigSlice';
import AnimateHeight from 'react-animate-height';
import { IRootState } from '@/store';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import IconCaretsDown from '@/components/icon/icon-carets-down';
import IconMenuDashboard from '@/components/icon/menu/icon-menu-dashboard';
import IconCaretDown from '@/components/icon/icon-caret-down';
import IconMinus from '@/components/icon/icon-minus';
import IconMenuChat from '@/components/icon/menu/icon-menu-chat';
import IconMenuContacts from '@/components/icon/menu/icon-menu-contacts';
import IconMenuInvoice from '@/components/icon/menu/icon-menu-invoice';
import IconMenuCalendar from '@/components/icon/menu/icon-menu-calendar';
import IconMenuComponents from '@/components/icon/menu/icon-menu-components';
import IconMenuUsers from '@/components/icon/menu/icon-menu-users';
import IconMenuNotes from '@/components/icon/menu/icon-menu-notes';

const Sidebar = () => {
    const dispatch = useDispatch();
    const pathname = usePathname();
    const [currentMenu, setCurrentMenu] = useState<string>('');
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const chatUnreadTotal = useSelector((state: IRootState) => state.chatNotification.totalUnread);
    const { isAdmin, isManager, isSuperAdmin, role } = useAuth();

    const toggleMenu = (value: string) => setCurrentMenu((old) => (old === value ? '' : value));

    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                const menuLi = ul.closest('li.menu');
                let ele: any = menuLi?.querySelectorAll('.nav-link') || [];
                if (ele.length) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele.click();
                    });
                }
            }
        }
    }, []);

    useEffect(() => {
        setActiveRoute();
        if (window.innerWidth < 1024 && themeConfig.sidebar) dispatch(toggleSidebar());
    }, [pathname]);

    const setActiveRoute = () => {
        document.querySelectorAll('.sidebar ul a.active').forEach((el) => el.classList.remove('active'));
        document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]')?.classList.add('active');
    };

    const ROLE_LABELS: Record<string, { label: string; color: string }> = {
        super_admin: { label: 'Super Admin', color: 'bg-danger/10 text-danger' },
        admin: { label: 'Admin', color: 'bg-primary/10 text-primary' },
        manager: { label: 'Manager', color: 'bg-info/10 text-info' },
        operator: { label: 'Opérateur', color: 'bg-success/10 text-success' },
    };
    const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.operator;

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed bottom-0 top-0 z-50 h-full min-h-screen w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="h-full bg-white dark:bg-black">
                    {/* Logo */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <Link href="/dashboard" className="main-logo flex shrink-0 items-center">
                            <img className="ml-[5px] w-8 flex-none" src="/mirai-logo.png" alt="MIRAI" />
                            <span className="align-middle text-2xl font-semibold dark:text-white-light lg:inline ltr:ml-1.5">MIRAI</span>
                        </Link>
                        <button
                            type="button"
                            className="collapse-icon flex h-8 w-8 items-center rounded-full transition duration-300 hover:bg-gray-500/10 dark:text-white-light dark:hover:bg-dark-light/10 rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>

                    <PerfectScrollbar className="relative h-[calc(100vh-80px)]">
                        <ul className="relative space-y-0.5 p-4 py-0 font-semibold">
                            {/* ── TABLEAU DE BORD ── */}
                            {isAdmin && (
                                <li className="menu nav-item">
                                    <button type="button" className={`${currentMenu === 'dashboard' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('dashboard')}>
                                        <div className="flex items-center">
                                            <IconMenuDashboard className="shrink-0 group-hover:!text-primary" />
                                            <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Tableau de Bord</span>
                                        </div>
                                        <div className={currentMenu !== 'dashboard' ? '-rotate-90 rtl:rotate-90' : ''}>
                                            <IconCaretDown />
                                        </div>
                                    </button>
                                    <AnimateHeight duration={300} height={currentMenu === 'dashboard' ? 'auto' : 0}>
                                        <ul className="sub-menu text-gray-500">
                                            <li>
                                                <Link href="/dashboard">Vue d&apos;Ensemble</Link>
                                            </li>
                                            {isManager && (
                                                <li>
                                                    <Link href="/dashboard/commercial">Gestion Commerciale</Link>
                                                </li>
                                            )}
                                            {isAdmin && (
                                                <li>
                                                    <Link href="/dashboard/finance">Finance</Link>
                                                </li>
                                            )}
                                            <li>
                                                <Link href="/dashboard/operations">Opérations</Link>
                                            </li>
                                        </ul>
                                    </AnimateHeight>
                                </li>
                            )}

                            {/* ── GESTION COMMERCIALE ── */}
                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>Gestion Commerciale</span>
                            </h2>

                            <li className="nav-item">
                                <ul>
                                    {/* Commandes */}
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'orders' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('orders')}>
                                            <div className="flex items-center">
                                                <IconMenuInvoice className="shrink-0 group-hover:!text-primary" />
                                                <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Commandes</span>
                                            </div>
                                            <div className={currentMenu !== 'orders' ? '-rotate-90 rtl:rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>
                                        <AnimateHeight duration={300} height={currentMenu === 'orders' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <Link href="/apps/orders/list">Liste</Link>
                                                </li>
                                                <li>
                                                    <Link href="/apps/orders/add">Nouvelle commande</Link>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>

                                    {/* Prospects (Leads) */}
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'leads' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('leads')}>
                                            <div className="flex items-center">
                                                <IconMenuContacts className="shrink-0 group-hover:!text-primary" />
                                                <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Prospects</span>
                                            </div>
                                            <div className={currentMenu !== 'leads' ? '-rotate-90 rtl:rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>
                                        <AnimateHeight duration={300} height={currentMenu === 'leads' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <Link href="/apps/leads">Liste</Link>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>

                                    {/* Opérations */}
                                    <li className="nav-item">
                                        <Link href="/apps/operations" className="group">
                                            <div className="flex items-center">
                                                <IconMenuCalendar className="shrink-0 group-hover:!text-primary" />
                                                <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Opérations</span>
                                            </div>
                                        </Link>
                                    </li>

                                    {/* Enregistrements */}
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'registrations' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('registrations')}>
                                            <div className="flex items-center">
                                                <IconMenuNotes className="shrink-0 group-hover:!text-primary" />
                                                <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Enregistrements</span>
                                            </div>
                                            <div className={currentMenu !== 'registrations' ? '-rotate-90 rtl:rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>
                                        <AnimateHeight duration={300} height={currentMenu === 'registrations' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <Link href="/apps/registrations">Liste</Link>
                                                </li>
                                                <li>
                                                    <Link href="/apps/registrations/new">Nouvel enregistrement</Link>
                                                </li>
                                                <li>
                                                    <Link href="/apps/registrations/non-found">Articles introuvables</Link>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>

                                    {/* Livreurs — manager+ */}
                                    {isManager && (
                                        <li className="nav-item">
                                            <Link href="/apps/livreurs" className="group">
                                                <div className="flex items-center">
                                                    <IconMenuChat className="shrink-0 group-hover:!text-primary" />
                                                    <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Livreurs</span>
                                                </div>
                                            </Link>
                                        </li>
                                    )}
                                </ul>
                            </li>

                            {/* ── CLIENTS ── */}
                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>Clients</span>
                            </h2>

                            <li className="nav-item">
                                <Link href="/apps/customers" className="group">
                                    <div className="flex items-center">
                                        <IconMenuContacts className="shrink-0 group-hover:!text-primary" />
                                        <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Clients</span>
                                    </div>
                                </Link>
                            </li>

                            {/* ── COMMUNICATION ── */}
                            <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                <IconMinus className="hidden h-5 w-4 flex-none" />
                                <span>Communication</span>
                            </h2>

                            {/* Messagerie interne */}
                            <li className="nav-item">
                                <Link href="/apps/chat" className="group">
                                    <div className="flex items-center">
                                        <IconMenuChat className="shrink-0 group-hover:!text-primary" />
                                        <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Messagerie</span>
                                        {chatUnreadTotal > 0 && (
                                            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                                                {chatUnreadTotal > 99 ? '99+' : chatUnreadTotal}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            </li>

                            {/* ── CONFIGURATION — admin+ ── */}
                            {isAdmin && (
                                <>
                                    <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                        <IconMinus className="hidden h-5 w-4 flex-none" />
                                        <span>Configuration</span>
                                    </h2>
                                    <li className="nav-item">
                                        <ul>
                                            <li className="menu nav-item">
                                                <button type="button" className={`${currentMenu === 'settings' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('settings')}>
                                                    <div className="flex items-center">
                                                        <IconMenuComponents className="shrink-0 group-hover:!text-primary" />
                                                        <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Paramètres</span>
                                                    </div>
                                                    <div className={currentMenu !== 'settings' ? '-rotate-90 rtl:rotate-90' : ''}>
                                                        <IconCaretDown />
                                                    </div>
                                                </button>
                                                <AnimateHeight duration={300} height={currentMenu === 'settings' ? 'auto' : 0}>
                                                    <ul className="sub-menu text-gray-500">
                                                        <li>
                                                            <Link href="/apps/settings/packs">Packs</Link>
                                                        </li>
                                                        <li>
                                                            <Link href="/apps/settings/price-catalog">Catalogue de Prix</Link>
                                                        </li>
                                                        <li>
                                                            <Link href="/apps/settings/zones">Zones</Link>
                                                        </li>
                                                        <li>
                                                            <Link href="/apps/settings/operational-periods">Périodes d&apos;Opération</Link>
                                                        </li>
                                                    </ul>
                                                </AnimateHeight>
                                            </li>
                                        </ul>
                                    </li>
                                </>
                            )}

                            {/* ── ADMINISTRATION — super_admin only ── */}
                            {isSuperAdmin && (
                                <>
                                    <h2 className="-mx-4 mb-1 mt-4 flex items-center bg-white-light/30 px-7 py-3 font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                                        <IconMinus className="hidden h-5 w-4 flex-none" />
                                        <span>Administration</span>
                                    </h2>
                                    <li className="nav-item">
                                        <Link href="/management/users" className="group">
                                            <div className="flex items-center">
                                                <IconMenuUsers className="shrink-0 group-hover:!text-primary" />
                                                <span className="text-black dark:text-[#506690] dark:group-hover:text-white-dark ltr:pl-3">Utilisateurs</span>
                                            </div>
                                        </Link>
                                    </li>
                                </>
                            )}

                            {/* Role badge at bottom */}
                            <li className="!mt-6 pb-4">
                                <div className={`mx-2 rounded-lg px-3 py-2 text-center text-xs font-semibold ${roleInfo.color}`}>{roleInfo.label}</div>
                            </li>
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
