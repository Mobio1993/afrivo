import { ClientSelectModal } from "../../../components/ClientSelectModal";
import { ClientListRow } from "./ClientListRow";
import { ClientsPagination } from "./ClientsPagination";
import { EmptyStateCard } from "./EmptyStateCard";

export function ClientsListPanel({
  clients,
  loading,
  search,
  totalCount,
  canCreate,
  selectedClient,
  selectedClientId,
  pagination,
  onSearchChange,
  onClearSearch,
  onCreate,
  onSelectFromModal,
  onCreateFromModal,
  onSelectClient,
  onPreviousPage,
  onNextPage,
}) {
  return (
    <section className="list-panel dashboard-panel clients-list-panel">
      <div className="panel-head">
        <div>
          <h3>Repertoire clients</h3>
          <p>Liste compacte optimisee pour retrouver rapidement un client.</p>
        </div>
      </div>

      {canCreate ? (
        <div className="clients-list-action-row">
          <button type="button" className="primary-button clients-list-create-button" onClick={onCreate}>
            <span className="clients-list-create-button__icon" aria-hidden="true">
              +
            </span>
            <span className="clients-list-create-button__label">Nouveau client</span>
          </button>
        </div>
      ) : null}

      <div className="clients-modal-picker">
        <ClientSelectModal
          clients={clients}
          selectedClient={selectedClient}
          onSelect={onSelectFromModal}
          onCreateClient={canCreate ? onCreateFromModal : undefined}
          loading={loading}
          buttonLabel="Choisir un client"
          title="Selectionner un client"
          subtitle="Retrouve rapidement une fiche client par nom, telephone ou numero de piece."
        />
      </div>

      <div className="clients-toolbar">
        <input
          className="filter-input"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Nom, telephone ou piece"
          aria-label="Rechercher un client"
        />
        {search ? (
          <button type="button" className="secondary-button" onClick={onClearSearch}>
            Effacer
          </button>
        ) : null}
      </div>

      <div className="clients-list-meta">
        <span>{totalCount} resultat(s)</span>
        <span>{search ? "Filtre dynamique actif" : "Vue complete disponible"}</span>
      </div>

      <div className="table-like">
        {clients.map((client) => (
          <ClientListRow
            key={client.id}
            client={client}
            isActive={selectedClientId === client.id}
            onSelect={() => onSelectClient(client.id)}
          />
        ))}

        {!clients.length ? (
          <EmptyStateCard
            title="Aucun client a afficher"
            description={
              search
                ? "Aucun client ne correspond a cette recherche."
                : "Les clients crees apparaitront ici."
            }
            action={
              !search && canCreate ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={onCreate}
                >
                  Creer le premier client
                </button>
              ) : null
            }
          />
        ) : null}
      </div>

      <ClientsPagination
        hasClients={clients.length > 0}
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        hasPrevious={Boolean(pagination.previous)}
        hasNext={Boolean(pagination.next)}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />
    </section>
  );
}
