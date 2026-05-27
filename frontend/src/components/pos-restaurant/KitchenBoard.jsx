import KitchenTicketCard from "./KitchenTicketCard";

export default function KitchenBoard({ tickets = [], onStart, onReady }) {
  const nouveau = tickets.filter((ticket) => ticket.statut === "nouveau");
  const enPrep = tickets.filter((ticket) => ticket.statut === "en_prep");

  return (
    <div className="pos-kitchen-cols">
      <section>
        <div className="pos-col-head">Nouveaux ({nouveau.length})</div>
        {nouveau.map((ticket) => <KitchenTicketCard key={ticket.id} ticket={ticket} onStart={onStart} onReady={onReady} />)}
      </section>
      <section>
        <div className="pos-col-head">En preparation ({enPrep.length})</div>
        {enPrep.map((ticket) => <KitchenTicketCard key={ticket.id} ticket={ticket} onStart={onStart} onReady={onReady} />)}
      </section>
    </div>
  );
}
