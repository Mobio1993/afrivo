import UserListItem from "./UserListItem";

export default function UserList({
  users,
  totalCount,
  loading,
  search,
  selectedId,
  onSearch,
  onSelect,
  onNew,
  canCreate = false,
}) {
  return (
    <section className="um-panel um-list-panel">
      <header className="um-panel-header">
        <strong>{totalCount} utilisateur{totalCount > 1 ? "s" : ""}</strong>
        {canCreate ? (
          <button type="button" className="um-primary-btn" onClick={onNew}>
            <span aria-hidden="true">+</span>
            Nouveau utilisateur
          </button>
        ) : null}
      </header>

      <div className="um-search">
        <input
          id="user-search"
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Rechercher par nom, username, role..."
        />
      </div>

      <div className="um-list-body">
        {loading ? (
          <div className="um-list-state">Chargement...</div>
        ) : users.length ? (
          users.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              isSelected={user.id === selectedId}
              onClick={() => onSelect(user)}
            />
          ))
        ) : (
          <div className="um-list-state">Aucun utilisateur trouve</div>
        )}
      </div>
    </section>
  );
}
