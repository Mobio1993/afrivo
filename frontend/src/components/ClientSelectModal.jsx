import { useEffect, useMemo, useRef, useState } from "react";

import "./ClientSelectModal.css";

function buildInitials(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).slice(0, 2);
  if (!parts.length || !parts[0]) {
    return "CL";
  }
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function normalizeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return value;
}

function clientMatchesSearch(client, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    client.full_name,
    client.phone,
    client.identity_document_number,
    client.email,
    client.client_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function ClientCard({ client, isActive, onClick }) {
  const hasEmail = Boolean(client.email && client.email !== "-");
  const hasClientCode = Boolean(client.client_code || client.clientCode);

  return (
    <button
      type="button"
      className={`client-select-modal__result-card ${isActive ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <div className="client-select-modal__result-top">
        <div className="client-select-modal__avatar" aria-hidden="true">
          {buildInitials(client.full_name)}
        </div>

        <div className="client-select-modal__identity">
          <strong>{normalizeValue(client.full_name)}</strong>
          <span>{normalizeValue(client.phone)}</span>
        </div>

        {hasEmail ? (
          <span className="client-select-modal__badge subtle">Email disponible</span>
        ) : null}
      </div>

      <div className="client-select-modal__meta">
        <div className="client-select-modal__meta-row">
          <strong>Piece</strong>
          <span>{normalizeValue(client.identity_document_number)}</span>
        </div>

        <div className="client-select-modal__meta-row">
          <strong>Type</strong>
          <span>{normalizeValue(client.identity_document_type_label)}</span>
        </div>

        {hasClientCode ? (
          <div className="client-select-modal__meta-row">
            <strong>Code client</strong>
            <span>{normalizeValue(client.client_code || client.clientCode)}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function ClientSelectModal({
  clients = [],
  selectedClient = null,
  onSelect,
  onCreateClient,
  buttonLabel = "Choisir un client",
  title = "Selectionner un client",
  subtitle = "Retrouve rapidement un client par nom, telephone, piece ou code client.",
  loading = false,
  disabled = false,
  maxResults = 15,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const canCreateClient = typeof onCreateClient === "function";

  const debouncedSearch = useDebouncedValue(search, 300);

  const filteredClients = useMemo(() => {
    const result = clients.filter((client) => clientMatchesSearch(client, debouncedSearch));
    return result.slice(0, maxResults);
  }, [clients, debouncedSearch, maxResults]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveIndex(0);

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (!filteredClients.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((previous) => Math.min(previous + 1, filteredClients.length - 1));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((previous) => Math.max(previous - 1, 0));
      }

      if (event.key === "Enter") {
        const targetClient = filteredClients[activeIndex];
        if (!targetClient) {
          return;
        }
        event.preventDefault();
        handleSelect(targetClient);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredClients, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!dialogRef.current) {
        return;
      }
      if (dialogRef.current.contains(event.target)) {
        return;
      }
      handleClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  function handleOpen() {
    if (disabled) {
      return;
    }
    setSearch("");
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setSearch("");
    setActiveIndex(0);
  }

  function handleSelect(client) {
    if (typeof onSelect === "function") {
      onSelect(client);
    }
    handleClose();
  }

  return (
    <>
      <div className="client-select-modal__trigger-wrap">
        <button
          type="button"
          className="client-select-modal__trigger"
          onClick={handleOpen}
          disabled={disabled}
        >
          <span>{buttonLabel}</span>
          {selectedClient ? (
            <span className="client-select-modal__trigger-selected">
              {selectedClient.full_name}
            </span>
          ) : (
            <span className="client-select-modal__trigger-placeholder">
              Aucun client selectionne
            </span>
          )}
        </button>
      </div>

      {isOpen ? (
        <div className="client-select-modal__overlay" role="presentation">
          <div
            ref={dialogRef}
            className="client-select-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-select-modal-title"
          >
            <div className="client-select-modal__header">
              <div className="client-select-modal__header-copy">
                <span className="client-select-modal__eyebrow">Reception</span>
                <h3 id="client-select-modal-title">{title}</h3>
                <p>{subtitle}</p>
              </div>

              <button
                type="button"
                className="client-select-modal__close"
                onClick={handleClose}
                aria-label="Fermer la fenetre"
              >
                ×
              </button>
            </div>

            <div className="client-select-modal__toolbar">
              <input
                ref={inputRef}
                type="search"
                className="client-select-modal__search"
                placeholder="Rechercher un client..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Rechercher un client"
              />

              {canCreateClient ? (
                <button
                  type="button"
                  className="client-select-modal__create"
                  onClick={onCreateClient}
                >
                  Creer un nouveau client
                </button>
              ) : null}
            </div>

            <div className="client-select-modal__content">
              {loading ? (
                <div className="client-select-modal__state">
                  <div className="client-select-modal__loader" aria-hidden="true" />
                  <strong>Chargement des clients...</strong>
                  <p>Veuillez patienter pendant la recuperation des fiches.</p>
                </div>
              ) : filteredClients.length ? (
                <div className="client-select-modal__results" role="listbox">
                  {filteredClients.map((client, index) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      isActive={index === activeIndex}
                      onClick={() => handleSelect(client)}
                    />
                  ))}
                </div>
              ) : (
                <div className="client-select-modal__state">
                  <strong>Aucun client trouve</strong>
                  <p>
                    {canCreateClient
                      ? "Aucun client trouve, cree un nouveau client."
                      : "Aucun client ne correspond a cette recherche avec votre niveau d'acces actuel."}
                  </p>
                  {canCreateClient ? (
                    <button
                      type="button"
                      className="client-select-modal__empty-action"
                      onClick={onCreateClient}
                    >
                      Creer un nouveau client
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
