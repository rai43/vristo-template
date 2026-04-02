'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import Swal from 'sweetalert2';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, AdminRole, type AdminUser, type CreateAdminUserDto, type UpdateAdminUserDto } from '@/lib/api/users';

const AdminUsersManagement = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'createdAt',
        direction: 'desc',
    });

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: AdminRole.OPERATOR,
        phone: '',
    });

    // Fetch users
    const { data: users, isLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: getAdminUsers,
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: CreateAdminUserDto) => createAdminUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            Swal.fire('Créé!', "L'utilisateur a été créé avec succès.", 'success');
            setShowModal(false);
            resetForm();
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Une erreur est survenue',
            });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateAdminUserDto }) => updateAdminUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            Swal.fire('Modifié!', "L'utilisateur a été modifié avec succès.", 'success');
            setShowModal(false);
            resetForm();
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Une erreur est survenue',
            });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteAdminUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            Swal.fire('Supprimé!', "L'utilisateur a été supprimé.", 'success');
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Impossible de supprimer cet utilisateur',
            });
        },
    });

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            name: '',
            role: AdminRole.OPERATOR,
            phone: '',
        });
        setSelectedUser(null);
    };

    const handleAddUser = () => {
        resetForm();
        setShowModal(true);
    };

    const handleEditUser = (user: AdminUser) => {
        setSelectedUser(user);
        setFormData({
            email: user.email,
            password: '',
            name: user.name,
            role: user.role,
            phone: user.phone || '',
        });
        setShowModal(true);
    };

    const handleDeleteUser = (user: AdminUser) => {
        Swal.fire({
            icon: 'warning',
            title: 'Êtes-vous sûr?',
            text: `Voulez-vous supprimer ${user.name}? Cette action est irréversible!`,
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e7515a',
        }).then((result) => {
            if (result.isConfirmed) {
                deleteMutation.mutate(user._id);
            }
        });
    };

    const handleToggleActive = (user: AdminUser) => {
        const newStatus = !user.isActive;
        Swal.fire({
            title: newStatus ? "Activer l'utilisateur" : "Désactiver l'utilisateur",
            text: `Voulez-vous ${newStatus ? 'activer' : 'désactiver'} ${user.name}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui',
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.email || !formData.name || !formData.role) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez remplir tous les champs requis',
            });
            return;
        }

        if (!selectedUser && !formData.password) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Le mot de passe est requis pour un nouvel utilisateur',
            });
            return;
        }

        if (selectedUser) {
            // Update
            const updateData: UpdateAdminUserDto = {
                email: formData.email,
                name: formData.name,
                role: formData.role,
                phone: formData.phone || undefined,
            };
            updateMutation.mutate({ id: selectedUser._id, data: updateData });
        } else {
            // Create
            const createData: CreateAdminUserDto = {
                email: formData.email,
                password: formData.password,
                name: formData.name,
                role: formData.role,
                phone: formData.phone || undefined,
            };
            createMutation.mutate(createData);
        }
    };

    const getRoleBadgeClass = (role: AdminRole) => {
        switch (role) {
            case AdminRole.SUPER_ADMIN:
                return 'badge-outline-danger';
            case AdminRole.ADMIN:
                return 'badge-outline-warning';
            case AdminRole.MANAGER:
                return 'badge-outline-info';
            case AdminRole.OPERATOR:
                return 'badge-outline-success';
            default:
                return 'badge-outline-secondary';
        }
    };

    const getRoleLabel = (role: AdminRole) => {
        switch (role) {
            case AdminRole.SUPER_ADMIN:
                return 'Super Admin';
            case AdminRole.ADMIN:
                return 'Admin';
            case AdminRole.MANAGER:
                return 'Manager';
            case AdminRole.OPERATOR:
                return 'Opérateur';
            default:
                return role;
        }
    };

    const paginatedUsers = users ? users.slice((page - 1) * pageSize, page * pageSize) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="panel">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Utilisateurs du Back-Office</h2>
                    <button onClick={handleAddUser} className="btn btn-primary">
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5V19M5 12H19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Ajouter un utilisateur
                    </button>
                </div>

                {/* DataTable */}
                <div className="datatables">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={paginatedUsers}
                        columns={[
                            {
                                accessor: 'name',
                                title: 'Nom',
                                sortable: true,
                                render: (user: AdminUser) => (
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">{user.name.charAt(0).toUpperCase()}</div>
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
                                render: (user: AdminUser) => <span className={`badge ${getRoleBadgeClass(user.role)}`}>{getRoleLabel(user.role)}</span>,
                            },
                            {
                                accessor: 'phone',
                                title: 'Téléphone',
                                render: (user: AdminUser) => user.phone || '-',
                            },
                            {
                                accessor: 'isActive',
                                title: 'Statut',
                                sortable: true,
                                render: (user: AdminUser) => <span className={`badge ${user.isActive ? 'badge-outline-success' : 'badge-outline-danger'}`}>{user.isActive ? 'Actif' : 'Inactif'}</span>,
                            },
                            {
                                accessor: 'lastLogin',
                                title: 'Dernière connexion',
                                sortable: true,
                                render: (user: AdminUser) => (user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : '-'),
                            },
                            {
                                accessor: 'actions',
                                title: 'Actions',
                                textAlignment: 'center',
                                render: (user: AdminUser) => (
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEditUser(user)} className="btn btn-sm btn-outline-primary" title="Modifier">
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={`btn btn-sm ${user.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                            title={user.isActive ? 'Désactiver' : 'Activer'}
                                        >
                                            {user.isActive ? (
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            ) : (
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path d="M5 13L9 17L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </button>
                                        <button onClick={() => handleDeleteUser(user)} className="btn btn-sm btn-outline-danger" title="Supprimer">
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ),
                            },
                        ]}
                        totalRecords={users?.length || 0}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={setPage}
                        recordsPerPageOptions={[10, 20, 30, 50]}
                        onRecordsPerPageChange={(newPageSize) => {
                            setPageSize(newPageSize);
                            setPage(1);
                        }}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        paginationText={({ from, to, totalRecords }) => `Affichage de ${from} à ${to} sur ${totalRecords} utilisateurs`}
                        highlightOnHover
                    />
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-[black]/60" onClick={() => setShowModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="panel my-8 w-full max-w-lg overflow-hidden rounded-lg border-0 p-0">
                            <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                <h5 className="text-lg font-bold">{selectedUser ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}</h5>
                                <button type="button" className="text-white-dark hover:text-dark" onClick={() => setShowModal(false)}>
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-5">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="name">Nom complet *</label>
                                        <input id="name" type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label htmlFor="email">Email *</label>
                                        <input id="email" type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                                    </div>
                                    {!selectedUser && (
                                        <div>
                                            <label htmlFor="password">Mot de passe *</label>
                                            <input
                                                id="password"
                                                type="password"
                                                className="form-input"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                required={!selectedUser}
                                                minLength={8}
                                                placeholder="Minimum 8 caractères"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="role">Rôle *</label>
                                        <select id="role" className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })} required>
                                            <option value={AdminRole.OPERATOR}>Opérateur</option>
                                            <option value={AdminRole.MANAGER}>Manager</option>
                                            <option value={AdminRole.ADMIN}>Admin</option>
                                            <option value={AdminRole.SUPER_ADMIN}>Super Admin</option>
                                        </select>
                                        <small className="text-white-dark">
                                            {formData.role === AdminRole.SUPER_ADMIN && 'Accès complet incluant la gestion des utilisateurs'}
                                            {formData.role === AdminRole.ADMIN && 'Accès complet sauf gestion des utilisateurs'}
                                            {formData.role === AdminRole.MANAGER && 'Gestion des clients, opérations, commandes'}
                                            {formData.role === AdminRole.OPERATOR && 'Accès limité aux opérations quotidiennes'}
                                        </small>
                                    </div>
                                    <div>
                                        <label htmlFor="phone">Téléphone</label>
                                        <input id="phone" type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="mt-8 flex items-center justify-end gap-4">
                                        <button type="button" className="btn btn-outline-danger" onClick={() => setShowModal(false)}>
                                            Annuler
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                                            {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : selectedUser ? 'Mettre à jour' : 'Créer'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsersManagement;


