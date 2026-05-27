import { useEffect, useRef, useState } from "react";

export default function PmItemFormModal({ item, categories, onClose, onSubmit }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    nom: item?.nom || "",
    description: item?.description || "",
    prix: item?.prix || "",
    temps_prep_min: item?.temps_prep_min || 15,
    disponible: item?.disponible ?? true,
    category: item?.category || categories[0]?.id || "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(item?.image_url || null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((current) => ({ ...current, image: "Format non supporte. Utilisez JPG, PNG ou WEBP." }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, image: "Fichier trop volumineux (max 5 Mo)." }));
      return;
    }
    setErrors((current) => ({ ...current, image: "" }));
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validate() {
    const nextErrors = {};
    if (!form.nom.trim()) nextErrors.nom = "Le nom est obligatoire.";
    if (!form.prix || Number(form.prix) <= 0) nextErrors.prix = "Le prix doit etre positif.";
    if (!form.category) nextErrors.category = "Selectionnez une categorie.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("nom", form.nom.trim());
    fd.append("description", form.description.trim());
    fd.append("prix", form.prix);
    fd.append("temps_prep_min", form.temps_prep_min);
    fd.append("disponible", form.disponible ? "true" : "false");
    fd.append("category", form.category);
    if (imageFile) fd.append("image", imageFile);
    try {
      await onSubmit(fd);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pm-modal-overlay">
      <div className="pm-modal">
        <div className="pm-modal-head">
          <span className="pm-modal-title">{isEdit ? `Modifier - ${item.nom}` : "Nouvel article"}</span>
          <button type="button" className="pm-modal-close" onClick={onClose} aria-label="Fermer">x</button>
        </div>
        <div className="pm-modal-body">
          <div className="pm-form-section">
            <div className="pm-form-section-title">Photo du plat <span className="pm-form-optional">- optionnel</span></div>
            <div className="pm-img-upload-zone">
              {imagePreview ? (
                <div className="pm-img-preview-wrap">
                  <img src={imagePreview} alt="Apercu" className="pm-img-preview" />
                  <div className="pm-img-preview-actions">
                    <button type="button" className="pm-img-btn pm-img-btn-change" onClick={() => fileInputRef.current?.click()}>Changer</button>
                    <button type="button" className="pm-img-btn pm-img-btn-remove" onClick={removeImage}>Supprimer</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="pm-img-dropzone" onClick={() => fileInputRef.current?.click()}>
                  <span className="pm-img-dropzone-label">Cliquer pour ajouter une photo</span>
                  <span className="pm-img-dropzone-hint">JPG, PNG ou WEBP - max 5 Mo - 400 x 300 px minimum</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImageChange} />
              {errors.image ? <div className="pm-field-error">{errors.image}</div> : null}
            </div>
          </div>
          <div className="pm-form-section">
            <div className="pm-form-section-title">Informations</div>
            <div className="pm-form-row">
              <div className="pm-fg">
                <label className="pm-form-lbl">Nom de l'article *</label>
                <input className={`pm-form-input ${errors.nom ? "pm-input-error" : ""}`} value={form.nom} onChange={(event) => set("nom", event.target.value)} />
                {errors.nom ? <div className="pm-field-error">{errors.nom}</div> : null}
              </div>
              <div className="pm-fg">
                <label className="pm-form-lbl">Categorie *</label>
                <select className={`pm-form-input ${errors.category ? "pm-input-error" : ""}`} value={form.category} onChange={(event) => set("category", event.target.value)}>
                  <option value="">Choisir une categorie</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.nom}</option>)}
                </select>
                {errors.category ? <div className="pm-field-error">{errors.category}</div> : null}
              </div>
            </div>
            <div className="pm-fg">
              <label className="pm-form-lbl">Description</label>
              <textarea className="pm-form-input pm-form-textarea" rows={2} value={form.description} onChange={(event) => set("description", event.target.value)} />
            </div>
            <div className="pm-form-row">
              <div className="pm-fg">
                <label className="pm-form-lbl">Prix (XOF) *</label>
                <input type="number" min="0" step="50" className={`pm-form-input ${errors.prix ? "pm-input-error" : ""}`} value={form.prix} onChange={(event) => set("prix", event.target.value)} />
                {errors.prix ? <div className="pm-field-error">{errors.prix}</div> : null}
              </div>
              <div className="pm-fg">
                <label className="pm-form-lbl">Temps preparation (min)</label>
                <input type="number" min="0" className="pm-form-input" value={form.temps_prep_min} onChange={(event) => set("temps_prep_min", event.target.value)} />
              </div>
            </div>
            <div className="pm-fg pm-toggle-row">
              <label className="pm-form-lbl">Disponible a la commande</label>
              <label className="pm-toggle-label">
                <input type="checkbox" checked={form.disponible} onChange={(event) => set("disponible", event.target.checked)} hidden />
                <span className={`pm-toggle-track ${form.disponible ? "on" : ""}`}><span className={`pm-toggle-thumb ${form.disponible ? "on" : ""}`} /></span>
                <span className="pm-toggle-text">{form.disponible ? "Disponible" : "Indisponible"}</span>
              </label>
            </div>
          </div>
        </div>
        <div className="pm-modal-footer">
          <button type="button" className="pm-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="pm-btn pm-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Creer l'article"}
          </button>
        </div>
      </div>
    </div>
  );
}
