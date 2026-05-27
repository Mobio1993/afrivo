import { FONT_SIZES, useFontSize } from "../../hooks/useFontSize";
import "./FontSizeControl.css";

const LETTER_SIZES = {
  "80%": "11px",
  "90%": "13px",
  "100%": "15px",
  "110%": "17px",
  "120%": "19px",
};

export default function FontSizeControl() {
  const {
    fontSize,
    currentOption,
    applyFontSize,
    resetFontSize,
  } = useFontSize();

  return (
    <div className="fsc-wrapper">
      <div className="fsc-header">
        <div className="fsc-label">Taille de la police</div>
        <div className="fsc-current">{currentOption.label} · {fontSize}</div>
      </div>

      <div className="fsc-options" role="group" aria-label="Taille de police globale">
        {FONT_SIZES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`fsc-btn${fontSize === option.value ? " fsc-btn-active" : ""}`}
            onClick={() => applyFontSize(option.value)}
            aria-label={`Taille : ${option.label}`}
            aria-pressed={fontSize === option.value}
          >
            <span className="fsc-btn-letter" style={{ fontSize: LETTER_SIZES[option.value] }}>
              A
            </span>
            <span className="fsc-btn-label">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="fsc-preview">
        <div className="fsc-preview-label">Apercu</div>
        <div className="fsc-preview-box">
          <div className="fsc-preview-title">COMPLEXE HOTELIER EMMANUELLA</div>
          <div className="fsc-preview-sub">Dashboard · Vue d'ensemble</div>
          <div className="fsc-preview-body">
            Pilotez votre hotel en temps reel. Clients actifs · Reservations · Paiements.
          </div>
        </div>
      </div>

      {fontSize !== "100%" ? (
        <button type="button" className="fsc-reset" onClick={resetFontSize}>
          <i className="ti ti-refresh" aria-hidden="true" />
          Revenir a la taille normale (100%)
        </button>
      ) : null}
    </div>
  );
}
