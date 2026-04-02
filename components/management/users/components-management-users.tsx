'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import type { DataTableColumn } from 'mantine-datatable';
import Swal from 'sweetalert2';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import sortBy from 'lodash/sortBy';
import {
    getUsers,
    getCurrentUser,
    createUser,
    updateUser,
    deleteUser,
    changePassword,
    getRoleLabel,
    getRoleColor,
    type BackofficeUser,
    type CreateUserDto,
    type UpdateUserDto,
    type ChangePasswordDto,
} from '@/lib/api/users';
import IconUserPlus from '@/components/icon/icon-user-plus';
import IconX from '@/components/icon/icon-x';
import IconPencil from '@/components/icon/icon-pencil';
import IconTrash from '@/components/icon/icon-trash';
import IconLock from '@/components/icon/icon-lock';
import IconChecks from '@/components/icon/icon-checks';
import IconXCircle from '@/components/icon/icon-x-circle';

const ComponentsManagementUsers = () => {
    const queryClient = useQueryClient();
    const [addUserModal, setAddUserModal] = useState(false);
    const [changePasswordModal, setChangePasswordModal] = useState(false);
    const [editingUser, setEditingUser] = useState<BackofficeUser | null>(null);

    const PAGE_SIZES = [10, 20, 30, 50];
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'name',
        direction: 'asc',
    });
    const [recordsData, setRecordsData] = useState<BackofficeUser[]>([]);

    const defaultFormData: CreateUserDto = {
        email: '',
        password: '',
        name: '',
        role: 'operator',
        phone: '',
        isActive: true,
    };

    const [formData, setFormData] = useState<CreateUserDto>(defaultFormData);
    const [passwordData, setPasswordData] = useState<ChangePasswordDto>({
        currentPassword: '',
        newPassword: '',
    });
    const [confirmPassword, setConfirmPassword] = useState('');

    // Fetch current user
    const {
        data: currentUserData,
        isLoading: isLoadingCurrentUser,
        error: currentUserError,
    } = useQuery({
        queryKey: ['currentUser'],
        queryFn: getCurrentUser,
    });

    const currentUser = currentUserData?.data;
    const isSuperAdmin = currentUser?.role === 'super_admin';

    // Fetch users
    const {
        data: usersData,
        isLoading: isLoadingUsers,
        error: usersError,
    } = useQuery({
        queryKey: ['backofficeUsers'],
        queryFn: getUsers,
        enabled: isSuperAdmin,
    });

    const users = useMemo(() => usersData?.data || [], [usersData?.data]);

    // Error handling
    useEffect(() => {
        if (currentUserError) {
            console.error('Error loading current user:', currentUserError);
        }
        if (usersError) {
            console.error('Error loading users:', usersError);
        }
    }, [currentUserError, usersError]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backofficeUsers'] });
            Swal.fire('Créé!', "L'utilisateur a été créé avec succès.", 'success');
            setAddUserModal(false);
            setFormData(defaultFormData);
            setEditingUser(null);
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue', 'error');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backofficeUsers'] });
            Swal.fire('Modifié!', "L'utilisateur a été modifié avec succès.", 'success');
            setAddUserModal(false);
            setFormData(defaultFormData);
            setEditingUser(null);
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue', 'error');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backofficeUsers'] });
            Swal.fire('Supprimé!', "L'utilisateur a été supprimé.", 'success');
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue', 'error');
        },
    });

    const changePasswordMutation = useMutation({
        mutationFn: changePassword,
        onSuccess: () => {
            Swal.fire('Succès!', 'Votre mot de passe a été changé avec succès.', 'success');
            setChangePasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '' });
            setConfirmPassword('');
        },
        onError: (error: any) => {
            Swal.fire('Erreur!', error?.response?.data?.message || 'Une erreur est survenue', 'error');
        },
    });

    // Sort and paginate users
    useEffect(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        let sortedData = sortBy(users, sortStatus.columnAccessor);
        if (sortStatus.direction === 'desc') {
            sortedData = sortedData.reverse();
        }
        setRecordsData(sortedData.slice(from, to));
    }, [users, page, pageSize, sortStatus]);

    const handleAddUser = () => {
        setEditingUser(null);
        setFormData(defaultFormData);
        setAddUserModal(true);
    };

    const handleEditUser = (user: BackofficeUser) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            name: user.name,
            role: user.role,
            phone: user.phone || '',
            isActive: user.isActive,
        });
        setAddUserModal(true);
    };

    const handleDeleteUser = (user: BackofficeUser) => {
        Swal.fire({
            icon: 'warning',
            title: 'Êtes-vous sûr?',
            text: `Voulez-vous vraiment supprimer ${user.name}?`,
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer!',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e7515a',
        }).then((result) => {
            if (result.isConfirmed) {
                deleteMutation.mutate(user._id);
            }
        });
    };

    const handleToggleActive = (user: BackofficeUser) => {
        const newStatus = !user.isActive;
        Swal.fire({
            icon: 'question',
            title: newStatus ? "Activer l'utilisateur?" : "Désactiver l'utilisateur?",
            text: `${user.name} sera ${newStatus ? 'activé' : 'désactivé'}`,
            showCancelButton: true,
            confirmButtonText: 'Oui, confirmer',
            cancelButtonText: 'Annuler',
        }).then((result) => {
            if (result.isConfirmed) {
                updateMutation.mutate({
                    id: user._id,
                    data: { isActive: newStatus },
                });
            }
        });
    };

    const handleSubmit = () => {
        // Validate form
        if (!formData.name.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Le nom est requis',
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        if (!formData.email.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: "L'email est requis",
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: "Format d'email invalide",
                confirmButtonColor: '#4361ee',
            });
            return;
        }

        if (editingUser) {
            // Update user (don't send password unless it's provided)
            const updateData: UpdateUserDto = {
                email: formData.email,
                name: formData.name,
                role: formData.role,
                phone: formData.phone || undefined,
                isActive: formData.isActive,
            };
            updateMutation.mutate({ id: editingUser._id, data: updateData });
        } else {
            // Create user - password is required
            if (!formData.password) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur!',
                    text: 'Le mot de passe est requis',
                    confirmButtonColor: '#4361ee',
                });
                return;
            }
            if (formData.password.length < 8) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur!',
                    text: 'Le mot de passe doit contenir au moins 8 caractères',
                    confirmButtonColor: '#4361ee',
                });
                return;
            }
            createMutation.mutate(formData);
        }
    };

    const handleChangePassword = () => {
        if (!passwordData.currentPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Le mot de passe actuel est requis',
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        if (!passwordData.newPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Le nouveau mot de passe est requis',
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        if (passwordData.newPassword.length < 8) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Le mot de passe doit contenir au moins 8 caractères',
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        if (passwordData.newPassword !== confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Les mots de passe ne correspondent pas',
                confirmButtonColor: '#4361ee',
            });
            return;
        }
        changePasswordMutation.mutate(passwordData);
    };

    const columns: DataTableColumn<BackofficeUser>[] = [
        {
            accessor: 'name',
            title: 'Nom',
            sortable: true,
            render: (user) => (
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-semibold text-white">{user.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-xs text-white-dark">{user.email}</div>
                    </div>
                </div>
            ),
        },
        {
            accessor: 'role',
            title: 'Rôle',
            sortable: true,
            render: (user) => <span className={`badge badge-outline-${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>,
        },
        {
            accessor: 'phone',
            title: 'Téléphone',
            render: (user) => user.phone || '-',
        },
        {
            accessor: 'isActive',
            title: 'Statut',
            sortable: true,
            render: (user) => <span className={`badge ${user.isActive ? 'badge-outline-success' : 'badge-outline-danger'}`}>{user.isActive ? 'Actif' : 'Inactif'}</span>,
        },
        {
            accessor: 'lastLogin',
            title: 'Dernière Connexion',
            render: (user) => (user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'),
        },
        {
            accessor: '_id',
            title: 'Actions',
            render: (user) => (
                <div className="flex items-center gap-2">
                    {isSuperAdmin && (
                        <>
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleEditUser(user)} title="Modifier">
                                <IconPencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${user.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                onClick={() => handleToggleActive(user)}
                                title={user.isActive ? 'Désactiver' : 'Activer'}
                            >
                                {user.isActive ? <IconXCircle className="h-4 w-4" /> : <IconChecks className="h-4 w-4" />}
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUser(user)} title="Supprimer">
                                <IconTrash className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    // Loading state
    if (isLoadingCurrentUser) {
        return (
            <div className="panel">
                <div className="flex h-64 items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-l-transparent"></div>
                </div>
            </div>
        );
    }

    // Error state for current user
    if (currentUserError) {
        return (
            <div className="panel">
                <div className="rounded bg-danger-light p-4 text-danger">
                    <strong>Erreur de chargement:</strong> {currentUserError instanceof Error ? currentUserError.message : 'Impossible de charger les informations utilisateur'}
                </div>
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="panel">
                <div className="mb-5 flex items-center justify-between">
                    <h5 className="text-lg font-semibold dark:text-white-light">Mon Profil</h5>
                    <button type="button" className="btn btn-primary" onClick={() => setChangePasswordModal(true)}>
                        <IconLock className="mr-2 h-4 w-4" />
                        Changer le mot de passe
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                        <div className="font-semibold">Nom</div>
                        <div>{currentUser?.name}</div>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                        <div className="font-semibold">Email</div>
                        <div>{currentUser?.email}</div>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#ebedf2] pb-3 dark:border-[#1b2e4b]">
                        <div className="font-semibold">Rôle</div>
                        <div>
                            <span className={`badge badge-outline-${getRoleColor(currentUser?.role || '')}`}>{getRoleLabel(currentUser?.role || '')}</span>
                        </div>
                    </div>
                </div>

                {/* Change Password Modal */}
                <Transition appear show={changePasswordModal} as={Fragment}>
                    <Dialog as="div" open={changePasswordModal} onClose={() => setChangePasswordModal(false)}>
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0" />
                        </Transition.Child>
                        <div className="fixed inset-0 z-[999] overflow-y-auto bg-[black]/60">
                            <div className="flex min-h-screen items-center justify-center px-4">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-out duration-300"
                                    enterFrom="opacity-0 scale-95"
                                    enterTo="opacity-100 scale-100"
                                    leave="ease-in duration-200"
                                    leaveFrom="opacity-100 scale-100"
                                    leaveTo="opacity-0 scale-95"
                                >
                                    <Dialog.Panel className="panel w-full max-w-lg overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                        <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                            <h5 className="text-lg font-bold">Changer le mot de passe</h5>
                                            <button type="button" onClick={() => setChangePasswordModal(false)} className="text-white-dark hover:text-dark">
                                                <IconX />
                                            </button>
                                        </div>
                                        <div className="p-5">
                                            <div className="space-y-4">
                                                <div>
                                                    <label htmlFor="currentPassword">Mot de passe actuel</label>
                                                    <input
                                                        id="currentPassword"
                                                        type="password"
                                                        className="form-input"
                                                        value={passwordData.currentPassword}
                                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="newPassword">Nouveau mot de passe</label>
                                                    <input
                                                        id="newPassword"
                                                        type="password"
                                                        className="form-input"
                                                        value={passwordData.newPassword}
                                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
                                                    <input id="confirmPassword" type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="mt-8 flex items-center justify-end gap-3">
                                                <button type="button" onClick={() => setChangePasswordModal(false)} className="btn btn-outline-danger">
                                                    Annuler
                                                </button>
                                                <button type="button" onClick={handleChangePassword} className="btn btn-primary" disabled={changePasswordMutation.isPending}>
                                                    {changePasswordMutation.isPending ? 'Changement...' : 'Changer'}
                                                </button>
                                            </div>
                                        </div>
                                    </Dialog.Panel>
                                </Transition.Child>
                            </div>
                        </div>
                    </Dialog>
                </Transition>
            </div>
        );
    }

    return (
        <div>
            <div className="panel">
                <div className="mb-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <h5 className="text-lg font-semibold dark:text-white-light">Gestion des Utilisateurs</h5>
                    <div className="flex gap-2">
                        <button type="button" className="btn btn-outline-primary" onClick={() => setChangePasswordModal(true)}>
                            <IconLock className="mr-2 h-4 w-4" />
                            Changer mon mot de passe
                        </button>
                        <button type="button" className="btn btn-primary gap-2" onClick={handleAddUser}>
                            <IconUserPlus />
                            Ajouter un utilisateur
                        </button>
                    </div>
                </div>
                <div className="datatables">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={recordsData}
                        columns={columns}
                        totalRecords={users.length}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        minHeight={200}
                        paginationText={({ from, to, totalRecords }) => `Affichage de ${from} à ${to} sur ${totalRecords} utilisateurs`}
                        fetching={isLoadingUsers}
                        noRecordsText="Aucun utilisateur trouvé"
                    />
                </div>

                {/* Error message for users loading */}
                {usersError && (
                    <div className="mt-4 rounded bg-danger-light p-4 text-danger">
                        <strong>Erreur de chargement des utilisateurs:</strong> {usersError instanceof Error ? usersError.message : 'Une erreur est survenue lors du chargement des utilisateurs'}
                    </div>
                )}
            </div>

            {/* Add/Edit User Modal */}
            <Transition appear show={addUserModal} as={Fragment}>
                <Dialog as="div" open={addUserModal} onClose={() => setAddUserModal(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0" />
                    </Transition.Child>
                    <div className="fixed inset-0 z-[999] overflow-y-auto bg-[black]/60">
                        <div className="flex min-h-screen items-center justify-center px-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="panel w-full max-w-2xl overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                    <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                        <h5 className="text-lg font-bold">{editingUser ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}</h5>
                                        <button type="button" onClick={() => setAddUserModal(false)} className="text-white-dark hover:text-dark">
                                            <IconX />
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="name">Nom complet *</label>
                                                <input
                                                    id="name"
                                                    type="text"
                                                    placeholder="Entrez le nom"
                                                    className="form-input"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="email">Email *</label>
                                                <input
                                                    id="email"
                                                    type="email"
                                                    placeholder="Entrez l'email"
                                                    className="form-input"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                />
                                            </div>
                                            {!editingUser && (
                                                <div className="sm:col-span-2">
                                                    <label htmlFor="password">Mot de passe *</label>
                                                    <input
                                                        id="password"
                                                        type="password"
                                                        placeholder="Entrez le mot de passe (min. 8 caractères)"
                                                        className="form-input"
                                                        value={formData.password}
                                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    />
                                                    <small className="text-white-dark">Le mot de passe doit contenir au moins 8 caractères</small>
                                                </div>
                                            )}
                                            <div>
                                                <label htmlFor="role">Rôle *</label>
                                                <select id="role" className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}>
                                                    <option value="operator">Employé</option>
                                                    <option value="manager">Gestionnaire</option>
                                                    <option value="admin">Administrateur</option>
                                                    <option value="super_admin">Super Admin</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="phone">Téléphone</label>
                                                <input
                                                    id="phone"
                                                    type="tel"
                                                    placeholder="Entrez le téléphone"
                                                    className="form-input"
                                                    value={formData.phone}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="inline-flex cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="form-checkbox"
                                                        checked={formData.isActive}
                                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    />
                                                    <span className="relative text-white-dark">Compte actif</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="mt-8 flex items-center justify-end gap-3">
                                            <button type="button" onClick={() => setAddUserModal(false)} className="btn btn-outline-danger">
                                                Annuler
                                            </button>
                                            <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                                                {editingUser ? 'Modifier' : 'Ajouter'}
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* Change Password Modal */}
            <Transition appear show={changePasswordModal} as={Fragment}>
                <Dialog as="div" open={changePasswordModal} onClose={() => setChangePasswordModal(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0" />
                    </Transition.Child>
                    <div className="fixed inset-0 z-[999] overflow-y-auto bg-[black]/60">
                        <div className="flex min-h-screen items-center justify-center px-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="panel w-full max-w-lg overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                    <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                        <h5 className="text-lg font-bold">Changer le mot de passe</h5>
                                        <button type="button" onClick={() => setChangePasswordModal(false)} className="text-white-dark hover:text-dark">
                                            <IconX />
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="currentPassword">Mot de passe actuel</label>
                                                <input
                                                    id="currentPassword"
                                                    type="password"
                                                    className="form-input"
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="newPassword">Nouveau mot de passe</label>
                                                <input
                                                    id="newPassword"
                                                    type="password"
                                                    className="form-input"
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
                                                <input id="confirmPassword" type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="mt-8 flex items-center justify-end gap-3">
                                            <button type="button" onClick={() => setChangePasswordModal(false)} className="btn btn-outline-danger">
                                                Annuler
                                            </button>
                                            <button type="button" onClick={handleChangePassword} className="btn btn-primary" disabled={changePasswordMutation.isPending}>
                                                {changePasswordMutation.isPending ? 'Changement...' : 'Changer'}
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default ComponentsManagementUsers;
