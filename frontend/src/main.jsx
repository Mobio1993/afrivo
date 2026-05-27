import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./app/providers/AuthProvider";
import { PermissionProvider } from "./app/providers/PermissionProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import { applyThemeVariables, DEFAULT_THEME, THEME_STORAGE_KEY } from "./config/themes";
import { ToastProvider } from "./shared/toast/ToastContext";
import "./styles/globals.css";

const savedFontSize = localStorage.getItem("afrivo_font_size");
if (["80%", "90%", "100%", "110%", "120%"].includes(savedFontSize)) {
  document.documentElement.style.fontSize = savedFontSize;
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
applyThemeVariables(savedTheme);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <PermissionProvider>
        <BrowserRouter>
          <ToastProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </ToastProvider>
        </BrowserRouter>
      </PermissionProvider>
    </AuthProvider>
  </React.StrictMode>
);
