'use client';
import IconLock from '@/components/icon/icon-lock';
import IconUser from '@/components/icon/icon-user';
import IconBell from '@/components/icon/icon-bell';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { IRootState } from '@/store';
import Swal from 'sweetalert2';
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const ComponentsUsersAccountSettingsTabs = () => {
    const [tabs, setTabs] = useState<string>('profile');
    const authState = useSelector((state: IRootState) => state.auth);
    const currentUser = authState.user;

    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
        phone: '',
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [notificationSettings, setNotificationSettings] = useState({
        emailNotifications: true,
        browserNotifications: true,
        chatNotifications: true,
    });

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setProfileData({
                name: currentUser.name || '',
                email: currentUser.email || '',
                phone: '',
            });
        }
    }, [currentUser]);

    const toggleTabs = (name: string) => {
        setTabs(name);
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await axios.patch(
                `${API_BASE}/auth/profile`,
                {
                    name: profileData.name,
                },
                { withCredentials: true }
            );
            Swal.fire({
                icon: 'success',
                title: 'Profil mis à jour',
                text: 'Vos informations ont été enregistrées avec succès.',
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error.response?.data?.message || 'Une erreur est survenue',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Les mots de passe ne correspondent pas.',
            });
            return;
        }

        if (passwordData.newPassword.length < 8) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Le mot de passe doit contenir au moins 8 caractères.',
            });
            return;
        }

        setIsLoading(true);
        try {
            await axios.post(
                `${API_BASE}/auth/change-password`,
                {
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                },
                { withCredentials: true }
            );
            Swal.fire({
                icon: 'success',
                title: 'Mot de passe modifié',
                text: 'Votre mot de passe a été changé avec succès.',
                timer: 2000,
                showConfirmButton: false,
            });
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error.response?.data?.message || 'Mot de passe actuel incorrect',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const ROLE_LABELS: Record<string, { label: string; color: string }> = {
        super_admin: { label: 'Super Administrateur', color: 'bg-danger text-white' },
        admin: { label: 'Administrateur', color: 'bg-primary text-white' },
        manager: { label: 'Gestionnaire', color: 'bg-info text-white' },
        operator: { label: 'Employé', color: 'bg-success text-white' },
    };

    const roleInfo = ROLE_LABELS[currentUser?.role || 'operator'] || ROLE_LABELS.operator;

    return (
        <div className="pt-5">
            <div className="mb-5 flex items-center justify-between">
                <h5 className="text-lg font-semibold dark:text-white-light">Paramètres du compte</h5>
            </div>
            <div>
                <ul className="mb-5 overflow-y-auto whitespace-nowrap border-b border-[#ebedf2] font-semibold dark:border-[#191e3a] sm:flex">
                    <li className="inline-block">
                        <button
                            onClick={() => toggleTabs('profile')}
                            className={`flex gap-2 border-b border-transparent p-4 hover:border-primary hover:text-primary ${tabs === 'profile' ? '!border-primary text-primary' : ''}`}
                        >
                            <IconUser className="h-5 w-5" />
                            Mon Profil
                        </button>
                    </li>
                    <li className="inline-block">
                        <button
                            onClick={() => toggleTabs('security')}
                            className={`flex gap-2 border-b border-transparent p-4 hover:border-primary hover:text-primary ${tabs === 'security' ? '!border-primary text-primary' : ''}`}
                        >
                            <IconLock className="h-5 w-5" />
                            Sécurité
                        </button>
                    </li>
                    <li className="inline-block">
                        <button
                            onClick={() => toggleTabs('notifications')}
                            className={`flex gap-2 border-b border-transparent p-4 hover:border-primary hover:text-primary ${tabs === 'notifications' ? '!border-primary text-primary' : ''}`}
                        >
                            <IconBell className="h-5 w-5" />
                            Notifications
                        </button>
                    </li>
                </ul>
            </div>

            {/* Profile Tab */}
            {tabs === 'profile' && (
                <div>
                    <form onSubmit={handleProfileSubmit} className="mb-5 rounded-md border border-[#ebedf2] bg-white p-6 dark:border-[#191e3a] dark:bg-black">
                        <h6 className="mb-5 text-lg font-bold">Informations personnelles</h6>
                        <div className="flex flex-col sm:flex-row">
                            <div className="mb-5 w-full sm:w-2/12 ltr:sm:mr-4 rtl:sm:ml-4">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white md:h-32 md:w-32">
                                    {profileData.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="mt-3 text-center">
                                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${roleInfo.color}`}>{roleInfo.label}</span>
                                </div>
                            </div>
                            <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="name" className="mb-2 block font-semibold">
                                        Nom complet
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={profileData.name}
                                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                        className="form-input"
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="mb-2 block font-semibold">
                                        Email
                                    </label>
                                    <input id="email" type="email" value={profileData.email} disabled className="form-input cursor-not-allowed bg-gray-100" placeholder="votre@email.com" />
                                    <p className="mt-1 text-xs text-gray-500">L&apos;email ne peut pas être modifié</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <button type="submit" disabled={isLoading} className="btn btn-primary">
                                        {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Security Tab */}
            {tabs === 'security' && (
                <div>
                    <form onSubmit={handlePasswordSubmit} className="rounded-md border border-[#ebedf2] bg-white p-6 dark:border-[#191e3a] dark:bg-black">
                        <h6 className="mb-5 text-lg font-bold">Changer le mot de passe</h6>
                        <div className="grid max-w-md grid-cols-1 gap-5">
                            <div>
                                <label htmlFor="currentPassword" className="mb-2 block font-semibold">
                                    Mot de passe actuel
                                </label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) =>
                                        setPasswordData({
                                            ...passwordData,
                                            currentPassword: e.target.value,
                                        })
                                    }
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newPassword" className="mb-2 block font-semibold">
                                    Nouveau mot de passe
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                                <p className="mt-1 text-xs text-gray-500">Minimum 8 caractères</p>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="mb-2 block font-semibold">
                                    Confirmer le nouveau mot de passe
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) =>
                                        setPasswordData({
                                            ...passwordData,
                                            confirmPassword: e.target.value,
                                        })
                                    }
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div>
                                <button type="submit" disabled={isLoading} className="btn btn-primary">
                                    {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Notifications Tab */}
            {tabs === 'notifications' && (
                <div>
                    <div className="rounded-md border border-[#ebedf2] bg-white p-6 dark:border-[#191e3a] dark:bg-black">
                        <h6 className="mb-5 text-lg font-bold">Préférences de notifications</h6>
                        <div className="max-w-md space-y-4">
                            <label className="flex cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={notificationSettings.browserNotifications}
                                    onChange={(e) =>
                                        setNotificationSettings({
                                            ...notificationSettings,
                                            browserNotifications: e.target.checked,
                                        })
                                    }
                                />
                                <div>
                                    <span className="font-semibold">Notifications du navigateur</span>
                                    <p className="text-xs text-gray-500">Recevoir des alertes sur le bureau</p>
                                </div>
                            </label>
                            <label className="flex cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={notificationSettings.chatNotifications}
                                    onChange={(e) =>
                                        setNotificationSettings({
                                            ...notificationSettings,
                                            chatNotifications: e.target.checked,
                                        })
                                    }
                                />
                                <div>
                                    <span className="font-semibold">Notifications de messagerie</span>
                                    <p className="text-xs text-gray-500">Alertes pour les nouveaux messages</p>
                                </div>
                            </label>
                            <label className="flex cursor-pointer items-center gap-3">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={notificationSettings.emailNotifications}
                                    onChange={(e) =>
                                        setNotificationSettings({
                                            ...notificationSettings,
                                            emailNotifications: e.target.checked,
                                        })
                                    }
                                />
                                <div>
                                    <span className="font-semibold">Notifications par email</span>
                                    <p className="text-xs text-gray-500">Résumés et alertes importantes</p>
                                </div>
                            </label>
                            <div className="pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        Swal.fire({
                                            icon: 'success',
                                            title: 'Préférences enregistrées',
                                            timer: 1500,
                                            showConfirmButton: false,
                                        });
                                    }}
                                    className="btn btn-primary"
                                >
                                    Enregistrer les préférences
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComponentsUsersAccountSettingsTabs;
