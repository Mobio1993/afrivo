import { useEffect, useState } from "react";

import { fetchJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import "./HomePage.css";

export function HomePage() {
  const [health, setHealth] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchJson("/api/health/")
      .then(setHealth)
      .catch(() => {
        setHealth({ status: "error", name: "API indisponible" });
      });
  }, []);

  return (
    <div className="page-stack home-page">
      <section className="hero-panel">
        <span className="eyebrow">Nouveau frontend</span>
        <h2>React devient la couche d'interface principale.</h2>
        <p>
          Cette base separe maintenant clairement le frontend et le backend.
          Django reste le moteur metier et l'authentification, React devient la SPA.
        </p>
      </section>

      <section className="card-grid">
        <article className="info-card">
          <strong>Etat API</strong>
          <div className="metric">{health?.status || "..."}</div>
          <p>{health?.name || "Verification backend en cours."}</p>
        </article>

        <article className="info-card">
          <strong>Session</strong>
          <div className="metric">Connecte</div>
          <p>
            {user
              ? `${user.first_name || user.username} - ${user.role}`
              : "Verification session en cours."}
          </p>
        </article>

        <article className="info-card">
          <strong>Operations React</strong>
          <div className="metric">Actif</div>
          <p>Reservations, day use et paiements peuvent maintenant etre crees depuis la SPA.</p>
        </article>

        <article className="info-card">
          <strong>Module Clients</strong>
          <div className="metric">Pret</div>
          <p>Recherche rapide, fiche detaillee et historique hotelier depuis le frontend React.</p>
        </article>
      </section>
    </div>
  );
}
