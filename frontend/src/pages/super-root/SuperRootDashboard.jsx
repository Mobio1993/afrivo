import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperRootDashboard } from "../../hooks/useSuperRootDashboard";
import { superRootMonitoringApi } from "../../features/super-root/monitoring/superRootMonitoringApi";
import SraStatusBanner from "../../components/super-root/SraStatusBanner";
import SraPlatformTile from "../../components/super-root/SraPlatformTile";
import SraEventFeed from "../../components/super-root/SraEventFeed";
import SraInfraPanel from "../../components/super-root/SraInfraPanel";
import {
  SraCriticalActions,
  SraCriticalIncidents,
  SraHealthTimeline,
  SraMonitoringSummary,
  SraRevenueOverview,
  SraRiskCenter,
  SraSecurityOverview,
  SraUrgentActions,
} from "../../components/super-root/SraDashboardWidgets";
import "../../styles/super-root-dashboard.css";

function normalizeLiveMonitoring(payload) {
  const summary = payload?.monitoring_summary || payload?.dashboard?.monitoring_summary || null;
  const system = payload?.monitoring?.system || payload?.dashboard?.monitoring?.system || null;
  if (!summary) return null;

  const items = [...(summary.items || [])];
  const hasItem = (id) => items.some((item) => item.id === id);
  const pushSystemItem = (id, label, value, warningAt) => {
    if (value === undefined || value === null || hasItem(id)) return;
    const numberValue = Number(value);
    items.push({
      id,
      label,
      status: numberValue >= warningAt ? "warning" : "ok",
      value: `${value}%`,
    });
  };

  if (system) {
    pushSystemItem("cpu", "CPU", system.cpu_pct, 80);
    pushSystemItem("ram", "RAM", system.ram_pct, 80);
    pushSystemItem("disk", "Disque", system.disk_pct, 85);
  }

  return { ...summary, items };
}

function formatLatency(value) {
  if (value === undefined || value === null || value === "") return "-";
  return `${value} ms`;
}

function formatPct(value) {
  if (value === undefined || value === null || value === "") return "-";
  return `${value}%`;
}

function infraStatut(ok, fallback = "warning") {
  return ok ? "ok" : fallback;
}

function normalizeLiveInfra(payload) {
  const monitoring = payload?.monitoring || payload?.dashboard?.monitoring || null;
  if (!monitoring) return null;

  const system = monitoring.system || {};
  const api = monitoring.api || {};
  const database = monitoring.database || {};
  const cache = monitoring.cache || {};
  const queue = monitoring.queue || {};
  const websocket = monitoring.websocket || {};
  const cpu = Number(system.cpu_pct ?? 0);
  const ram = Number(system.ram_pct ?? 0);
  const disk = Number(system.disk_pct ?? 0);

  return {
    status: monitoring.status || "warning",
    items: [
      {
        id: "api",
        label: "API Servers",
        statut: infraStatut(api.ok),
        value: formatLatency(api.latency_ms),
        icon: "ti-server",
      },
      {
        id: "db",
        label: "PostgreSQL",
        statut: infraStatut(database.ok, "error"),
        value: formatLatency(database.latency_ms),
        icon: "ti-database",
      },
      {
        id: "redis",
        label: "Redis Cache",
        statut: infraStatut(cache.ok),
        value: formatLatency(cache.latency_ms),
        icon: "ti-bolt",
      },
      {
        id: "queue",
        label: "Queue",
        statut: infraStatut(queue.ok),
        value: `${queue.pending ?? 0} pending`,
        icon: "ti-loader",
      },
      {
        id: "cpu",
        label: "CPU",
        statut: cpu >= 80 ? "warning" : "ok",
        value: formatPct(system.cpu_pct),
        icon: "ti-cpu",
      },
      {
        id: "ram",
        label: "RAM",
        statut: ram >= 80 ? "warning" : "ok",
        value: formatPct(system.ram_pct),
        icon: "ti-device-desktop-analytics",
      },
      {
        id: "disk",
        label: "Disque",
        statut: disk >= 85 ? "warning" : "ok",
        value: formatPct(system.disk_pct),
        icon: "ti-hard-drive",
      },
      {
        id: "websocket",
        label: "WebSocket",
        statut: infraStatut(websocket.ok),
        value: websocket.status || (websocket.ok ? "OK" : "Non configure"),
        icon: "ti-plug-connected",
      },
    ],
  };
}

export default function SuperRootDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, lastRefresh, refetch } = useSuperRootDashboard();
  const [notice, setNotice] = useState(null);
  const [liveMonitoring, setLiveMonitoring] = useState(null);
  const [liveInfra, setLiveInfra] = useState(null);
  const [liveApiErrors5xx, setLiveApiErrors5xx] = useState(null);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const handleBannerAction = (actionId) => {
    const routes = {
      create: "/super-root/platforms",
      maintenance: "/super-root/maintenance",
      admins: "/super-root/users",
      billing: "/super-root/licenses",
    };

    if (routes[actionId]) {
      navigate(routes[actionId]);
    }
  };

  const handlePlatformAction = (actionId) => {
    if (actionId === "view") {
      navigate("/super-root/platforms");
      return;
    }

    if (actionId === "admins") {
      navigate("/super-root/users");
      return;
    }

    if (actionId === "manage") {
      navigate("/super-root/platforms");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchLiveMonitoring() {
      try {
        const payload = await superRootMonitoringApi.getMonitoringLive();
        if (!cancelled) {
          setLiveMonitoring(normalizeLiveMonitoring(payload));
          setLiveInfra(normalizeLiveInfra(payload));
          setLiveApiErrors5xx(payload?.monitoring?.api?.errors ?? null);
        }
      } catch {
        if (!cancelled) {
          setLiveMonitoring(null);
          setLiveInfra(null);
          setLiveApiErrors5xx(null);
        }
      }
    }

    fetchLiveMonitoring();
    const timer = window.setInterval(fetchLiveMonitoring, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="sra-page">
      <div className="sra-page-header">
        <div>
          <div className="sra-breadcrumb">
            <i
              className="ti ti-shield-lock"
              style={{ fontSize: 11, color: "#1D9E75" }}
              aria-hidden="true"
            ></i>
            SUPER ROOT ADMIN
          </div>
          <h1 className="sra-title">War Room</h1>
          <p className="sra-subtitle">
            Supervision globale AFRIVO - Multi-tenant, infrastructure et facturation SaaS.
          </p>
        </div>
        <div className="sra-header-right">
          {lastRefresh && (
            <span className="sra-refresh-time">
              Actualise a{" "}
              {lastRefresh.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button className="sra-refresh-btn" onClick={refetch} title="Actualiser">
            <i className="ti ti-refresh" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {loading && (
        <div className="sra-loading">
          <i className="ti ti-loader sra-loading-spin" aria-hidden="true"></i>
          Chargement du War Room...
        </div>
      )}

      {error && <div className="sra-error">{error}</div>}
      {notice && <div className="sra-notice">{notice}</div>}

      {data && (
        <>
          <section className="sra-zone sra-zone-global">
            <div className="sra-zone-head">
              <div>
                <span className="sra-zone-kicker">Niveau global</span>
                <h2 className="sra-zone-title">Supervision systeme</h2>
              </div>
              <span className="sra-zone-note">Score, KPIs et actions critiques</span>
            </div>
            <SraStatusBanner
              data={{
                ...data,
                lastRefresh,
                kpis: {
                  ...data.kpis,
                  ...(liveApiErrors5xx !== null ? { erreursApi5xx: liveApiErrors5xx } : {}),
                },
              }}
              onAction={handleBannerAction}
            />
          </section>

          <section className="sra-zone sra-zone-live">
            <SraMonitoringSummary summary={liveMonitoring || data.monitoringSummary} />
          </section>

          <section className="sra-zone sra-zone-priorities">
            <div className="sra-zone-head">
              <div>
                <span className="sra-zone-kicker">Priorites</span>
                <h2 className="sra-zone-title">Actions et risques immediats</h2>
              </div>
              <span className="sra-zone-note">Ce que le Super Root doit traiter en premier</span>
            </div>
            <div className="sra-dashboard-grid sra-dashboard-grid-priority">
              <SraUrgentActions actions={data.urgentActions} navigate={navigate} />
              <SraRiskCenter riskCenter={data.riskCenter} navigate={navigate} />
            </div>
          </section>

          <section className="sra-zone sra-zone-control">
            <div className="sra-dashboard-grid sra-dashboard-grid-three">
              <SraSecurityOverview security={data.securityOverview} navigate={navigate} />
              <SraRevenueOverview revenue={data.revenueOverview} navigate={navigate} />
              <SraHealthTimeline timeline={data.healthTimeline} />
            </div>
          </section>

          <section className="sra-zone sra-zone-business">
            <div className="sra-zone-head">
              <div>
                <span className="sra-zone-kicker">Niveau business</span>
                <h2 className="sra-zone-title">Plateformes actives</h2>
              </div>
              <span className="sra-section-count">{data.platforms.length}</span>
            </div>
            <div className="sra-platforms-section">
              {data.platforms.length === 0 ? (
                <div className="sra-empty-card sra-empty-platforms">
                  <div className="sra-empty-ico">
                    <i className="ti ti-building-off" aria-hidden="true"></i>
                  </div>
                  <div>
                    <div className="sra-empty-title">Aucune plateforme detectee</div>
                    <div className="sra-empty-desc">
                      Les donnees plateforme apparaitront ici des qu'une instance sera disponible.
                    </div>
                  </div>
                  <button
                    className="sra-empty-action"
                    onClick={() => navigate("/super-root/platforms")}
                    type="button"
                  >
                    Ouvrir les plateformes
                  </button>
                </div>
              ) : (
                <div
                  className="sra-platforms-grid"
                  style={{
                    gridTemplateColumns:
                      data.platforms.length > 0 && data.platforms.length <= 2
                        ? `repeat(${data.platforms.length}, 1fr)`
                        : "repeat(3, 1fr)",
                  }}
                >
                  {data.platforms.map((platform) => (
                    <SraPlatformTile
                      key={platform.id}
                      platform={platform}
                      onAction={handlePlatformAction}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="sra-zone sra-zone-ops">
            <div className="sra-zone-head">
              <div>
                <span className="sra-zone-kicker">Niveau operationnel</span>
                <h2 className="sra-zone-title">Alertes live & infrastructure</h2>
              </div>
              <span className="sra-zone-note">Evenements recents et etat technique</span>
            </div>
            <div className="sra-bottom-row">
              <SraEventFeed events={data.events} />
              <SraInfraPanel
                infraStatus={liveInfra?.items || data.infraStatus}
                status={liveInfra?.status}
              />
            </div>
          </section>

          <section className="sra-zone sra-zone-audit">
            <div className="sra-dashboard-grid sra-dashboard-grid-priority">
              <SraCriticalIncidents incidents={data.criticalIncidents} navigate={navigate} />
              <SraCriticalActions actions={data.latestCriticalActions} navigate={navigate} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
