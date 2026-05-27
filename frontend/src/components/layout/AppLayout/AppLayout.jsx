import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { LayoutShell } from "../LayoutShell/LayoutShell";
import { PageContainer } from "../PageContainer/PageContainer";
import { Sidebar } from "../Sidebar/Sidebar";
import { Topbar } from "../Topbar/Topbar";
import { TopbarActionsContext } from "../Topbar/TopbarContext";
import "./AppLayout.css";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [topbarActions, setTopbarActions] = useState(null);

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.warn("Erreur logout ignorée:", error);
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <TopbarActionsContext.Provider value={{ setTopbarActions }}>
      <div className="app-layout">
        <LayoutShell
        sidebar={
          <Sidebar
            user={user}
            onLogout={handleLogout}
          />
        }
        topbar={<Topbar user={user} actions={topbarActions} />}
      >
        <PageContainer>
          <Outlet />
        </PageContainer>
      </LayoutShell>
      </div>
    </TopbarActionsContext.Provider>
  );
}
