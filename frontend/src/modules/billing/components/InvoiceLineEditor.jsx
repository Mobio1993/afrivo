export function InvoiceLineEditor({ lines, onChange, readOnly = false }) {
  function updateLine(index, field, value) {
    const updated = lines.map((line, i) => {
      if (i !== index) return line;
      const newLine = { ...line, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        const qty = parseFloat(field === "quantity" ? value : newLine.quantity) || 0;
        const price = parseFloat(field === "unit_price" ? value : newLine.unit_price) || 0;
        newLine.line_total = (qty * price).toFixed(2);
      }
      return newLine;
    });
    onChange(updated);
  }

  function addLine() {
    onChange([
      ...lines,
      { label: "", description: "", quantity: "1.00", unit_price: "0.00", line_total: "0.00", notes: "" },
    ]);
  }

  function removeLine(index) {
    onChange(lines.filter((_, i) => i !== index));
  }

  const subtotal = lines.reduce((acc, l) => acc + (parseFloat(l.line_total) || 0), 0);

  return (
    <div className="billing-line-editor">
      <div className="billing-line-editor-head">
        <strong>Lignes de facturation</strong>
        {!readOnly && (
          <button type="button" className="secondary-button billing-add-line-btn" onClick={addLine}>
            + Ajouter une ligne
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="billing-line-empty">
          {readOnly ? "Aucune ligne." : "Ajoutez au moins une ligne."}
        </div>
      ) : (
        <div className="billing-lines-table">
          <div className="billing-lines-header">
            <span>Libellé</span>
            <span>Qté</span>
            <span>P.U.</span>
            <span>Total</span>
            {!readOnly && <span />}
          </div>
          {lines.map((line, index) => (
            <div key={index} className="billing-line-row">
              <div className="billing-line-label-col">
                {readOnly ? (
                  <span className="billing-line-label">{line.label}</span>
                ) : (
                  <input
                    type="text"
                    className="billing-line-input"
                    placeholder="Libellé *"
                    value={line.label || ""}
                    onChange={(e) => updateLine(index, "label", e.target.value)}
                    required
                  />
                )}
                {(line.description || !readOnly) && (
                  readOnly ? (
                    line.description ? <span className="billing-line-desc">{line.description}</span> : null
                  ) : (
                    <input
                      type="text"
                      className="billing-line-input billing-line-desc-input"
                      placeholder="Description (optionnel)"
                      value={line.description || ""}
                      onChange={(e) => updateLine(index, "description", e.target.value)}
                    />
                  )
                )}
              </div>
              <div className="billing-line-num-col">
                {readOnly ? (
                  <span>{line.quantity}</span>
                ) : (
                  <input
                    type="number"
                    className="billing-line-input billing-line-num"
                    min="0.01"
                    step="0.01"
                    value={line.quantity || "1.00"}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                  />
                )}
              </div>
              <div className="billing-line-num-col">
                {readOnly ? (
                  <span>{parseFloat(line.unit_price || 0).toLocaleString("fr-FR")}</span>
                ) : (
                  <input
                    type="number"
                    className="billing-line-input billing-line-num"
                    min="0"
                    step="0.01"
                    value={line.unit_price || "0.00"}
                    onChange={(e) => updateLine(index, "unit_price", e.target.value)}
                  />
                )}
              </div>
              <div className="billing-line-num-col billing-line-total">
                {parseFloat(line.line_total || 0).toLocaleString("fr-FR")}
              </div>
              {!readOnly && (
                <div className="billing-line-actions">
                  <button
                    type="button"
                    className="billing-line-remove"
                    onClick={() => removeLine(index)}
                    aria-label="Supprimer la ligne"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="billing-lines-subtotal">
            <span>Sous-total</span>
            <span>{subtotal.toLocaleString("fr-FR")} XOF</span>
          </div>
        </div>
      )}
    </div>
  );
}
