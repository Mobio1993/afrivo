import { Link } from "react-router-dom";

import "./UnauthorizedState.css";

export function UnauthorizedState({
  title = "Acces non autorise",
  message = "Votre profil ne dispose pas des droits requis pour consulter cette section.",
  actionTo = "/dashboard",
  actionLabel = "Retour au dashboard",
}) {
  return (
    <section className="unauthorized-state" role="alert">
      <div className="unauthorized-state__icon" aria-hidden="true">
        <i className="ti ti-shield-lock" />
      </div>
      <div>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
      {actionTo ? (
        <Link className="unauthorized-state__action" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
