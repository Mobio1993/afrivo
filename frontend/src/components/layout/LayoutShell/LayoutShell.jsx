import { cloneElement, isValidElement, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import "./LayoutShell.css";

export function LayoutShell({ sidebar, topbar, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const isMobile = window.matchMedia("(max-width: 920px)").matches;
    const previousOverflow = document.body.style.overflow;

    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

  const sidebarElement = isValidElement(sidebar) ? sidebar : null;
  const topbarElement = isValidElement(topbar) ? topbar : null;

  return (
    <div className={`app-shell ${isSidebarOpen ? "sidebar-open" : ""}`}>
      <div className="layout-shell-sidebar">
        {sidebarElement}
      </div>

      <div className="layout-shell-main">
        {topbarElement
          ? cloneElement(topbarElement, {
              isSidebarOpen,
              onMenuClick: () => setIsSidebarOpen(true),
            })
          : topbar}
        {children}
      </div>

      <div
        className={`layout-shell-overlay ${isSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden={!isSidebarOpen}
      />

      <div
        className={`layout-shell-drawer ${isSidebarOpen ? "is-open" : ""}`}
        aria-hidden={!isSidebarOpen}
      >
        {sidebarElement
          ? cloneElement(sidebarElement, {
              isDrawer: true,
              isSidebarOpen,
              onClose: () => setIsSidebarOpen(false),
            })
          : sidebar}
      </div>
    </div>
  );
}
