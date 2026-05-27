import { useCallback, useEffect, useState } from "react";

import { applyThemeVariables, DEFAULT_THEME, getTheme, THEMES, THEME_STORAGE_KEY } from "../config/themes";

export function useTheme() {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  });

  useEffect(() => {
    const appliedThemeId = applyThemeVariables(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, appliedThemeId);
  }, [themeId]);

  const switchTheme = useCallback((nextThemeId) => {
    if (!THEMES[nextThemeId]) return;
    setThemeId(nextThemeId);
  }, []);

  return {
    themeId,
    currentTheme: getTheme(themeId),
    themes: Object.values(THEMES),
    switchTheme,
  };
}
