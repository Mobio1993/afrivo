import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import ConfirmModal from "../../components/users/ConfirmModal";
import PasswordModal from "../../components/users/PasswordModal";
import RoleChangeModal from "../../components/users/RoleChangeModal";
import StatsBar from "../../components/users/StatsBar";
import UserDetail from "../../components/users/UserDetail";
import UserForm from "../../components/users/UserForm";
import UserList from "../../components/users/UserList";
import { useUsers } from "../../hooks/useUsers";
import { useToast } from "../../shared/toast/ToastContext";
import "./UsersPage.css";

const MODAL = {
  CREATE: "create",
  EDIT: "edit",
  ROLE: "role",
  PASSWORD: "password",
  DEACTIVATE: "deactivate",
};

function getErrorMessage(error, fallback) {
  if (error?.payload?.detail) return error.payload.detail;
  if (error?.payload?.error) return error.payload.error;
  return error?.message || fallback;
}

export function UsersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiErrors, setApiErrors] = useState({});

  const filters = useMemo(() => ({ search }), [search]);
  const {
    users,
    stats,
    loading,
    error,
    refetch,
    createUser,
    updateUser,
    deactivateUser,
    setPassword,
  } = useUsers(filters);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) || null,
    [selectedUserId, users],
  );
  const canCreateUsers = hasPermission(user, "users", "create");
  const canEditUsers = hasPermission(user, "users", "update");
  const canChangeUserRole = canPerformAction(user, "users.change_role");
  const canResetUserPassword = canPerformAction(user, "users.reset_password");
  const canDeactivateUsers = canPerformAction(user, "users.deactivate");

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }
    if (selectedUserId && !users.some((user) => String(user.id) === String(selectedUserId))) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId && !search.trim()) {
      setSelectedUserId(users[0].id);
    }
  }, [search, selectedUserId, users]);

  function openModal(name) {
    setApiErrors({});
    setActiveModal(name);
  }

  function closeModal() {
    if (saving) return;
    setApiErrors({});
    setActiveModal(null);
  }

  async function handleCreate(payload) {
    setSaving(true);
    setApiErrors({});
    try {
      const created = await createUser(payload);
      await refetch();
      setSelectedUserId(created.id);
      setActiveModal(null);
      toast.success("Utilisateur cree.");
    } catch (submitError) {
      setApiErrors(submitError.payload || {});
      toast.error(getErrorMessage(submitError, "Creation impossible."));
      throw submitError;
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(payload) {
    if (!selectedUser) return;
    setSaving(true);
    setApiErrors({});
    try {
      const updated = await updateUser(selectedUser.id, payload);
      await refetch();
      setSelectedUserId(updated.id);
      setActiveModal(null);
      toast.success("Profil utilisateur mis a jour.");
    } catch (submitError) {
      setApiErrors(submitError.payload || {});
      toast.error(getErrorMessage(submitError, "Mise a jour impossible."));
      throw submitError;
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(role) {
    if (!selectedUser) return;
    setSaving(true);
    setApiErrors({});
    try {
      const updated = await updateUser(selectedUser.id, { role });
      await refetch();
      setSelectedUserId(updated.id);
      setActiveModal(null);
      toast.success("Role utilisateur mis a jour.");
    } catch (submitError) {
      setApiErrors(submitError.payload || {});
      toast.error(getErrorMessage(submitError, "Changement de role impossible."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(password) {
    if (!selectedUser) return;
    setSaving(true);
    setApiErrors({});
    try {
      await setPassword(selectedUser.id, password);
      setActiveModal(null);
      toast.success("Mot de passe mis a jour.");
    } catch (submitError) {
      setApiErrors(submitError.payload || {});
      toast.error(getErrorMessage(submitError, "Reinitialisation impossible."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedUser) return;
    setSaving(true);
    setApiErrors({});
    try {
      await deactivateUser(selectedUser.id);
      await refetch();
      setActiveModal(null);
      toast.success("Compte desactive.");
    } catch (submitError) {
      setApiErrors(submitError.payload || {});
      toast.error(getErrorMessage(submitError, "Desactivation impossible."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="users-page um-page">
      {error ? <div className="um-page-error">{error}</div> : null}

      <StatsBar stats={stats} />

      <div className="um-split">
        <UserList
          users={users}
          totalCount={stats.total || users.length}
          loading={loading}
          search={search}
          selectedId={selectedUserId}
          onSearch={setSearch}
          onSelect={(user) => setSelectedUserId(user.id)}
          onNew={() => openModal(MODAL.CREATE)}
          canCreate={canCreateUsers}
        />

        <UserDetail
          user={selectedUser}
          onEdit={() => openModal(MODAL.EDIT)}
          onChangeRole={() => openModal(MODAL.ROLE)}
          onPassword={() => openModal(MODAL.PASSWORD)}
          onDeactivate={() => openModal(MODAL.DEACTIVATE)}
          canEdit={canEditUsers}
          canChangeRole={canChangeUserRole}
          canResetPassword={canResetUserPassword}
          canDeactivate={canDeactivateUsers}
        />
      </div>

      {activeModal === MODAL.CREATE && canCreateUsers ? (
        <UserForm
          mode="create"
          saving={saving}
          apiErrors={apiErrors}
          onClose={closeModal}
          onSubmit={handleCreate}
        />
      ) : null}

      {activeModal === MODAL.EDIT && selectedUser && canEditUsers ? (
        <UserForm
          mode="edit"
          user={selectedUser}
          saving={saving}
          apiErrors={apiErrors}
          onClose={closeModal}
          onSubmit={handleUpdate}
        />
      ) : null}

      {activeModal === MODAL.ROLE && selectedUser && canChangeUserRole ? (
        <RoleChangeModal
          user={selectedUser}
          saving={saving}
          error={apiErrors.detail || apiErrors.error || ""}
          onClose={closeModal}
          onSubmit={handleRoleChange}
        />
      ) : null}

      {activeModal === MODAL.PASSWORD && selectedUser && canResetUserPassword ? (
        <PasswordModal
          user={selectedUser}
          saving={saving}
          error={apiErrors.detail || apiErrors.error || ""}
          onClose={closeModal}
          onSubmit={handlePassword}
        />
      ) : null}

      {activeModal === MODAL.DEACTIVATE && selectedUser && canDeactivateUsers ? (
        <ConfirmModal
          title="Desactiver le compte"
          message={`Cette action desactivera l'acces de ${selectedUser.username} immediatement.`}
          confirmLabel="Desactiver"
          saving={saving}
          onCancel={closeModal}
          onConfirm={handleDeactivate}
        />
      ) : null}
    </div>
  );
}
