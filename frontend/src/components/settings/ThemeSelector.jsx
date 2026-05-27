import { useThemeContext } from "../../contexts/ThemeContext";
import "./ThemeSelector.css";

export default function ThemeSelector() {
  const { themeId, themes, switchTheme } = useThemeContext();
  const currentTheme = themes.find((theme) => theme.id === themeId);

  return (
    <div className="ts-wrapper">
      <div className="ts-header">
        <div className="ts-label">Theme de l'interface</div>
        <div className="ts-current">{currentTheme?.name}</div>
      </div>

      <div className="ts-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`ts-card${themeId === theme.id ? " ts-card-active" : ""}`}
            onClick={() => switchTheme(theme.id)}
            aria-pressed={themeId === theme.id}
            aria-label={`Theme : ${theme.name}`}
          >
            <div className="ts-preview" aria-hidden="true">
              <div className="ts-prev-sidebar" style={{ background: theme.previewColors.sidebar }}>
                <div className="ts-prev-dot" style={{ background: theme.previewColors.accent }} />
                <div className="ts-prev-lines">
                  <div className="ts-prev-line" />
                  <div
                    className="ts-prev-line ts-prev-line-active"
                    style={{ background: `${theme.previewColors.accent}33` }}
                  />
                  <div className="ts-prev-line" />
                  <div className="ts-prev-line" />
                </div>
              </div>

              <div className="ts-prev-content" style={{ background: theme.previewColors.content }}>
                <div className="ts-prev-title" />
                <div className="ts-prev-kpis">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="ts-prev-kp" />
                  ))}
                </div>
                <div className="ts-prev-btn" style={{ background: theme.previewColors.accent }} />
              </div>
            </div>

            <div className="ts-info">
              <div className="ts-name">{theme.name}</div>
              <div className="ts-desc">{theme.description}</div>
            </div>

            {themeId === theme.id ? (
              <div className="ts-check">
                <i className="ti ti-circle-check" aria-hidden="true" />
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
