import { useRef } from "react";

import { ClientListRow } from "./ClientListRow";
import { ClientsPagination } from "./ClientsPagination";
import { EmptyStateCard } from "./EmptyStateCard";

export function ClientsListPanel({
  clients,
  search,
  totalCount,
  pageCount,
  activeFilter,
  filters,
  filterCounts,
  canCreate,
  selectedClientId,
  pagination,
  onSearchChange,
  onClearSearch,
  onFilterChange,
  onCreate,
  onSelectClient,
  onPreviousPage,
  onNextPage,
  onGoToPage,
}) {
  const filtersRailRef = useRef(null);
  const filtersDragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    scrollLeft: 0,
  });
  const filtersDraggedRef = useRef(false);

  function handleFiltersPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const rail = filtersRailRef.current;
    if (!rail) {
      return;
    }

    filtersDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: rail.scrollLeft,
    };
    filtersDraggedRef.current = false;
    rail.classList.add("is-dragging");
    rail.setPointerCapture?.(event.pointerId);
  }

  function handleFiltersPointerMove(event) {
    const rail = filtersRailRef.current;
    const drag = filtersDragRef.current;
    if (!rail || !drag.active) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      filtersDraggedRef.current = true;
      event.preventDefault();
    }

    rail.scrollLeft = drag.scrollLeft - deltaX;
  }

  function handleFiltersPointerEnd(event) {
    const rail = filtersRailRef.current;
    const drag = filtersDragRef.current;
    if (!drag.active) {
      return;
    }

    const wasDragged = filtersDraggedRef.current;
    filtersDragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      scrollLeft: 0,
    };

    if (rail) {
      rail.classList.remove("is-dragging");
      if (drag.pointerId !== null) {
        rail.releasePointerCapture?.(drag.pointerId);
      }
    }

    if (wasDragged) {
      window.setTimeout(() => {
        filtersDraggedRef.current = false;
      }, 0);
    }
  }

  function handleFiltersClickCapture(event) {
    if (!filtersDraggedRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <section className="list-panel dashboard-panel clients-list-panel">
      {/* Search — always visible at top */}
      <div className="clients-list-search">
        <input
          className="filter-input"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Nom, téléphone ou pièce"
          aria-label="Rechercher un client"
        />
        {search ? (
          <button type="button" className="secondary-button" onClick={onClearSearch}>
            ×
          </button>
        ) : null}
      </div>

      {filters?.length ? (
        <div className="clients-list-filters-shell">
          <div
            ref={filtersRailRef}
            className="clients-list-filters"
            aria-label="Filtres rapides clients"
            onClickCapture={handleFiltersClickCapture}
            onPointerDown={handleFiltersPointerDown}
            onPointerMove={handleFiltersPointerMove}
            onPointerUp={handleFiltersPointerEnd}
            onPointerCancel={handleFiltersPointerEnd}
            onPointerLeave={handleFiltersPointerEnd}
            onDragStart={(event) => event.preventDefault()}
          >
            {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`clients-list-filter-chip ${activeFilter === filter.key ? "active" : ""}`}
              onClick={() => onFilterChange(filter.key)}
              aria-pressed={activeFilter === filter.key}
            >
              <span>{filter.label}</span>
              <small>{filterCounts?.[filter.key] ?? 0}</small>
            </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Count meta */}
      <div className="clients-list-meta">
        <span>
          {activeFilter && activeFilter !== "all"
            ? `${clients.length} / ${pageCount} affiché(s)`
            : `${totalCount} client(s)`}
        </span>
        {search || (activeFilter && activeFilter !== "all") ? (
          <span className="clients-list-meta-filter">Filtre actif</span>
        ) : null}
      </div>

      {/* Scrollable rows */}
      <div className="clients-list-rows">
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
            title="Aucun client à afficher"
            description={
              search
                ? "Aucun client ne correspond à cette recherche."
                : activeFilter && activeFilter !== "all"
                  ? "Aucun client de cette page ne correspond à ce filtre."
                : "Les clients créés apparaîtront ici."
            }
            action={
              !search && (!activeFilter || activeFilter === "all") && canCreate ? (
                <button type="button" className="primary-button" onClick={onCreate}>
                  Créer le premier client
                </button>
              ) : null
            }
          />
        ) : null}
      </div>

      {/* Pagination + footer actions */}
      <div className="clients-list-footer">
        <ClientsPagination
          hasClients={clients.length > 0}
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          hasPrevious={Boolean(pagination.previous)}
          hasNext={Boolean(pagination.next)}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
          onGoToPage={onGoToPage}
        />

        {canCreate ? (
          <div className="clients-list-footer-create">
            <button type="button" className="primary-button" onClick={onCreate}>
              + Nouveau client
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
