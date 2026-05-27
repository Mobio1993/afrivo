/* Génère et imprime un ticket thermique à partir d'un objet facture ClientInvoice.
   Module JS pur — pas de React, pas de hooks. */

const METHOD_LABELS = {
  cash:         "Espèces",
  card:         "Carte bancaire",
  transfer:     "Virement",
  bank_transfer:"Virement",
  mobile_money: "Mobile Money",
  cheque:       "Chèque",
  other:        "Autre",
};

const STATUS_LABELS = {
  draft:          "BROUILLON",
  issued:         "ÉMISE",
  partially_paid: "PARTIELLE",
  paid:           "PAYÉE",
  cancelled:      "ANNULÉE",
};

function formatAmount(n, currency) {
  return Number(n || 0).toLocaleString("fr-FR") + " " + currency;
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status) {
  return STATUS_LABELS[status] || (status || "").toUpperCase();
}

function methodLabel(method) {
  return METHOD_LABELS[method] || method || "-";
}

function buildHtml(invoice, hotelConfig, currency) {
  const {
    hotelName    = "AFRIVO Hotel",
    hotelAddress = "",
    hotelPhone   = "",
    hotelEmail   = "",
    footerNote   = "Merci de votre visite !",
  } = hotelConfig;

  /* ── Lignes de facturation (invoice.items) ── */
  const linesHTML = (invoice.items || []).map((line) => `
    <tr>
      <td class="th-label">${line.label || line.description || "-"}</td>
      <td class="th-qty">${line.quantity ?? 1}</td>
      <td class="th-price">${formatAmount(line.unit_price, currency)}</td>
      <td class="th-total">${formatAmount(line.line_total, currency)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" style="text-align:center;font-size:10px;padding:4px 0">Aucune ligne</td></tr>`;

  /* ── Paiements ── */
  const payments = invoice.payments || [];
  const paymentsHTML = payments.map((p) => `
    <div class="th-payment-row">
      <span class="th-payment-ref">${p.reference || p.id || "-"}</span>
      <span class="th-payment-mode">${methodLabel(p.method)}</span>
      <span class="th-payment-amount">${formatAmount(p.amount, currency)}</span>
    </div>
  `).join("");

  const remaining = Number(invoice.balance_due ?? 0);
  const now = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Facture ${invoice.reference || ""}</title>
  <style>
    /* ── Reset ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page thermique 80mm ── */
    @page {
      size: 80mm auto;
      margin: 0;
    }

    body {
      width: 80mm;
      max-width: 80mm;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
      padding: 4mm 4mm 8mm;
    }

    /* ── En-tête hôtel ── */
    .th-hotel {
      text-align: center;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #000;
    }
    .th-hotel-name {
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .th-hotel-info {
      font-size: 10px;
      line-height: 1.4;
      color: #333;
      margin-top: 2px;
    }

    /* ── Titre FACTURE ── */
    .th-title-block {
      text-align: center;
      margin: 6px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #000;
    }
    .th-title {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .th-ref {
      font-size: 10px;
      color: #333;
      margin-top: 2px;
      font-family: monospace;
    }
    .th-status {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 1px 6px;
      margin-top: 3px;
      letter-spacing: 1px;
    }

    /* ── Infos client ── */
    .th-client-block {
      margin: 6px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #000;
      font-size: 11px;
      line-height: 1.5;
    }
    .th-client-label {
      font-size: 9px;
      text-transform: uppercase;
      color: #555;
      letter-spacing: .5px;
    }
    .th-client-name {
      font-weight: bold;
      font-size: 12px;
    }

    /* ── Tableau des lignes ── */
    .th-lines-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: #555;
      margin-bottom: 3px;
      margin-top: 6px;
    }
    .th-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .th-table thead th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .4px;
      color: #555;
      border-bottom: 1px solid #000;
      padding: 2px 0;
      text-align: left;
    }
    .th-table thead th.th-qty,
    .th-table thead th.th-price,
    .th-table thead th.th-total { text-align: right; }
    .th-table tbody td {
      padding: 3px 0;
      font-size: 11px;
      vertical-align: top;
      border-bottom: 1px dotted #ccc;
    }
    td.th-label { width: 42%; word-break: break-word; }
    td.th-qty   { width: 8%;  text-align: right; }
    td.th-price { width: 22%; text-align: right; }
    td.th-total { width: 28%; text-align: right; font-weight: bold; }

    /* ── Totaux ── */
    .th-totals {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #000;
    }
    .th-total-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 2px;
    }
    .th-total-row--grand {
      font-size: 14px;
      font-weight: bold;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #000;
    }
    .th-total-row--paid  { color: #006600; }
    .th-total-row--remaining        { font-weight: bold; font-size: 13px; }
    .th-total-row--remaining.zero   { color: #006600; }
    .th-total-row--remaining.nonzero{ color: #000; }

    /* ── Paiements ── */
    .th-payments-title {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: #555;
      margin: 8px 0 3px;
    }
    .th-payment-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 10px;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px dotted #ccc;
      gap: 4px;
    }
    .th-payment-ref    { font-family: monospace; font-size: 9px; color: #444; flex: 1; word-break: break-all; }
    .th-payment-mode   { font-size: 10px; text-align: center; flex-shrink: 0; }
    .th-payment-amount { font-weight: bold; text-align: right; flex-shrink: 0; }

    /* ── Pied de ticket ── */
    .th-footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px dashed #000;
      font-size: 10px;
      line-height: 1.5;
      color: #333;
    }
    .th-footer-note {
      font-size: 12px;
      font-weight: bold;
      color: #000;
      margin-bottom: 4px;
    }
    .th-barcode-area {
      margin-top: 8px;
      font-size: 9px;
      color: #555;
      font-family: monospace;
      text-align: center;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>

  <!-- En-tête hôtel -->
  <div class="th-hotel">
    <div class="th-hotel-name">${hotelName}</div>
    <div class="th-hotel-info">
      ${hotelAddress ? hotelAddress + "<br>" : ""}
      ${hotelPhone   ? "Tél : " + hotelPhone + "<br>" : ""}
      ${hotelEmail   ? hotelEmail : ""}
    </div>
  </div>

  <!-- Titre + référence -->
  <div class="th-title-block">
    <div class="th-title">FACTURE</div>
    <div class="th-ref">${invoice.reference || "-"}</div>
    <div class="th-status">${statusLabel(invoice.status)}</div>
  </div>

  <!-- Infos client + date -->
  <div class="th-client-block">
    <div class="th-client-label">Client</div>
    <div class="th-client-name">${invoice.client_name || "-"}</div>
    <div style="font-size:10px;color:#444;margin-top:2px">
      Émise le ${formatDate(invoice.issued_at || invoice.created_at)}
      ${invoice.issued_by_name ? " · Par " + invoice.issued_by_name : ""}
    </div>
  </div>

  <!-- Lignes de facturation -->
  <div class="th-lines-title">Lignes de facturation</div>
  <table class="th-table">
    <thead>
      <tr>
        <th class="th-label">Libellé</th>
        <th class="th-qty">Qté</th>
        <th class="th-price">P.U.</th>
        <th class="th-total">Total</th>
      </tr>
    </thead>
    <tbody>${linesHTML}</tbody>
  </table>

  <!-- Totaux -->
  <div class="th-totals">
    <div class="th-total-row">
      <span>Sous-total</span>
      <span>${formatAmount(invoice.subtotal_amount, currency)}</span>
    </div>
    ${Number(invoice.discount_amount) > 0 ? `
    <div class="th-total-row">
      <span>Remise</span>
      <span>- ${formatAmount(invoice.discount_amount, currency)}</span>
    </div>` : ""}
    ${Number(invoice.tax_amount) > 0 ? `
    <div class="th-total-row">
      <span>Taxes</span>
      <span>${formatAmount(invoice.tax_amount, currency)}</span>
    </div>` : ""}
    <div class="th-total-row th-total-row--grand">
      <span>TOTAL</span>
      <span>${formatAmount(invoice.total_amount, currency)}</span>
    </div>
    <div class="th-total-row th-total-row--paid">
      <span>Encaissé</span>
      <span>${formatAmount(invoice.amount_paid, currency)}</span>
    </div>
    <div class="th-total-row th-total-row--remaining ${remaining === 0 ? "zero" : "nonzero"}">
      <span>Solde restant</span>
      <span>${formatAmount(invoice.balance_due, currency)}</span>
    </div>
  </div>

  <!-- Paiements reçus -->
  ${payments.length > 0 ? `
  <div class="th-payments-title">Paiements reçus</div>
  ${paymentsHTML}` : ""}

  <!-- Pied de ticket -->
  <div class="th-footer">
    <div class="th-footer-note">${footerNote}</div>
    <div>Imprimé le ${now}</div>
    <div class="th-barcode-area">${invoice.reference || ""}</div>
  </div>

</body>
</html>`;
}

export function printThermalReceipt(invoice, hotelConfig = {}) {
  if (!invoice) return;

  const currency = invoice.currency || hotelConfig.currency || "XOF";
  const html = buildHtml(invoice, hotelConfig, currency);

  const popup = window.open("", "_blank", "width=420,height=700");
  if (!popup) {
    alert("Autorisez les popups pour imprimer le ticket thermique.");
    return;
  }

  popup.document.write(html);
  popup.document.close();

  popup.onload = () => {
    popup.focus();
    popup.print();
    popup.onafterprint = () => popup.close();
  };

  /* Fallback — onload n'est pas garanti sur tous les navigateurs */
  setTimeout(() => {
    try {
      popup.focus();
      popup.print();
    } catch (_) {}
  }, 500);
}
