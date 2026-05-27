import { SrTable } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelInvoices({ invoices = [] }) {
  return <SrTable columns={[{ key: "reference", label: "Reference" }, { key: "amount", label: "Montant" }, { key: "status", label: "Statut" }]} rows={invoices} empty="Aucune facture exposee pour cet hotel." />;
}
