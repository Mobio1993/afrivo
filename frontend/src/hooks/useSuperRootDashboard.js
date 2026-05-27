import { useCallback, useEffect, useState } from "react";

import { httpClient } from "../shared/api/httpClient";

const ENDPOINTS = {
  dashboard: "/api/super-root/dashboard/",
  platforms: "/api/super-root/platforms/",
  auditLogs: "/api/super-root/audit-logs/",
  security: "/api/super-root/security/",
  maintenance: "/api/super-root/maintenance/",
  monitoring: "/api/super-root/monitoring/",
};

function computeHealthScore({ uptimePct = 100, criticalErrors = 0, pendingAlerts = 0, infraIssues = 0 }) {
  let score = 100;
  if (uptimePct < 99) score -= Math.min(20, Math.round((99 - uptimePct) * 4));
  if (criticalErrors > 0) score -= Math.min(20, criticalErrors * 7);
  if (pendingAlerts > 0) score -= Math.min(15, pendingAlerts * 5);
  if (infraIssues > 0) score -= Math.min(10, infraIssues * 5);
  return Math.max(0, score);
}

function scoreLabel(score) {
  if (score >= 90) return { label: "Excellent", color: "#1D9E75", bg: "#E1F5EE" };
  if (score >= 70) return { label: "Bon", color: "#EF9F27", bg: "#FAEEDA" };
  if (score >= 50) return { label: "Attention", color: "#EF9F27", bg: "#FAEEDA" };
  return { label: "Critique", color: "#A32D2D", bg: "#FCEBEB" };
}

function normalizeMonitoringSummary(summary, monitoring) {
  if (!summary) return null;
  const system = monitoring?.system || null;
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

async function maybeGet(url) {
  if (!url) return null;
  try {
    return await httpClient.get(url);
  } catch {
    return null;
  }
}

export function useSuperRootDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [dashboardRes, platformsRes, logsRes, securityRes, maintenanceRes, monitoringRes] = await Promise.all([
        maybeGet(ENDPOINTS.dashboard),
        maybeGet(ENDPOINTS.platforms),
        maybeGet(ENDPOINTS.auditLogs),
        maybeGet(ENDPOINTS.security),
        maybeGet(ENDPOINTS.maintenance),
        maybeGet(ENDPOINTS.monitoring),
      ]);

      const dashboard = dashboardRes?.dashboard || {};
      const monitoringSummary = normalizeMonitoringSummary(
        dashboard.monitoring_summary,
        monitoringRes?.monitoring,
      );
      const platforms = buildPlatforms(dashboard, platformsRes);
      const infraStatus = buildInfraStatus(monitoringRes, securityRes, maintenanceRes);
      const events = buildEvents(logsRes, dashboard);
      const kpis = dashboard.kpis || {};

      const totalHotels = kpis.hotels_total ?? platforms.reduce((sum, item) => sum + (item.hotels || 0), 0);
      const totalOrgs = kpis.organizations_total ?? platforms.reduce((sum, item) => sum + (item.orgs || 0), 0);
      const totalAbo = (kpis.subscriptions_active ?? 0) + (kpis.subscriptions_trial ?? 0);
      const totalRevenue = kpis.monthly_revenue ?? platforms.reduce((sum, item) => sum + (item.revenueMois || 0), 0);
      const globalUptime = platforms.length
        ? platforms.reduce((sum, item) => sum + (item.uptime || 100), 0) / platforms.length
        : 100;
      const incidents7d = kpis.incidents_total_7d ?? events.filter((event) => event.severity === "critique").length;
      const apiErrors5xx = kpis.api_errors_5xx ?? monitoringRes?.monitoring?.api?.errors ?? 0;
      const alertCount = (dashboard.urgent_actions || []).filter((item) => item.severity !== "ok").length;
      const infraIssues = infraStatus.filter((item) => item.statut !== "ok").length;
      const pendingAlerts = (dashboard.alerts || []).filter((item) => item.type !== "ok").length;

      const score = dashboard.health_score ?? computeHealthScore({
        uptimePct: globalUptime,
        criticalErrors: incidents7d,
        pendingAlerts,
        infraIssues,
      });

      setData({
        score,
        scoreInfo: scoreLabel(score),
        scoreDescription:
          score >= 90
            ? `Systeme AFRIVO en tres bon etat - ${alertCount} alerte(s) active(s)`
            : score >= 70
              ? `${alertCount} point(s) a surveiller sur le parc`
              : "Actions requises sur le systeme",
        kpis: {
          plateformes: platforms.length,
          hotels: totalHotels,
          organisations: totalOrgs,
          abonnements: totalAbo,
          revenueMois: totalRevenue,
          uptime: Math.round(globalUptime * 10) / 10,
          erreursApi5xx: apiErrors5xx,
          incidents7j: incidents7d,
          alertes: alertCount,
        },
        platforms,
        infraStatus,
        events: events.slice(0, 5),
        systemVersion: monitoringRes?.version || "v2.4.x",
        urgentActions: dashboard.urgent_actions || [],
        monitoringSummary,
        riskCenter: dashboard.risk_center || null,
        criticalIncidents: dashboard.critical_incidents || [],
        securityOverview: dashboard.security_overview || null,
        revenueOverview: dashboard.revenue_overview || null,
        latestCriticalActions: dashboard.latest_critical_actions || [],
        healthTimeline: dashboard.health_timeline || null,
      });
      setLastRefresh(new Date());
    } catch {
      setError("Erreur de chargement du dashboard Super Root Admin");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
    const interval = setInterval(() => fetchAll(true), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { data, loading, error, lastRefresh, refetch: () => fetchAll(false) };
}

function buildPlatforms(dashboard, platformsRes) {
  const rows = platformsRes?.platforms || platformsRes?.results || platformsRes?.items || [];
  if (Array.isArray(rows) && rows.length) {
    return rows.map((item, index) => normalizePlatform(item, index));
  }

  const kpis = dashboard?.kpis || {};
  const suspended = (kpis.subscriptions_suspended || 0) + (kpis.subscriptions_expired || 0);
  return [
    {
      id: "afrivo-default",
      nom: "AFRIVO Default",
      code: "AF",
      url: "",
      statut: "active",
      hotels: kpis.hotels_total ?? 0,
      orgs: kpis.organizations_total ?? 0,
      abonnements: (kpis.subscriptions_active ?? 0) + (kpis.subscriptions_trial ?? 0),
      admins: kpis.platform_admins ?? 0,
      uptime: suspended > 0 ? 98.7 : 99.8,
      revenueMois: Number(kpis.monthly_revenue ?? 0),
      revenueChange: 0,
      sante: suspended > 0 ? "attention" : "sain",
      avatarBg: "#E6F1FB",
      avatarColor: "#185FA5",
    },
  ];
}

function normalizePlatform(item, index) {
  const uptime = Number(item.uptime ?? item.uptime_pct ?? item.availability ?? 99.8);
  return {
    id: item.id ?? index,
    nom: item.name || item.nom || item.label || `Plateforme ${index + 1}`,
    code: item.code || (item.name || item.nom || "AF").slice(0, 2).toUpperCase(),
    url: item.url || item.domain || "",
    statut: item.status || item.statut || "active",
    hotels: item.hotels_count ?? item.hotels ?? item.hotels_total ?? 0,
    orgs: item.organizations_count ?? item.organisations_total ?? item.orgs ?? 0,
    abonnements: item.subscriptions_count ?? item.abonnements ?? item.licenses_active ?? 0,
    admins: item.admins_count ?? item.platform_admins ?? 0,
    uptime,
    revenueMois: Number(item.revenue_month ?? item.revenueMois ?? item.monthly_revenue ?? 0),
    revenueChange: Number(item.revenue_change ?? item.revenueChange ?? 0),
    sante: uptime < 99 ? "attention" : "sain",
    avatarBg: "#E6F1FB",
    avatarColor: "#185FA5",
  };
}

function buildInfraStatus(infra, security, maintenance) {
  if (!infra?.monitoring) {
    const activeSessions = security?.security?.active_super_root_sessions?.length ?? 0;
    const maintenanceStatus = maintenance?.maintenance || {};
    return [
      { id: "api", label: "API Servers", statut: "ok", value: "99.8%", icon: "ti-server" },
      { id: "db", label: "PostgreSQL", statut: maintenanceStatus.database?.ok === false ? "error" : "ok", value: maintenanceStatus.database?.ok === false ? "Erreur" : "Operationnel", icon: "ti-database" },
      { id: "redis", label: "Redis Cache", statut: maintenanceStatus.cache?.ok === false ? "warning" : "ok", value: maintenanceStatus.cache?.ok === false ? "Warning" : "Operationnel", icon: "ti-bolt" },
      { id: "sessions", label: "Sessions Super Root", statut: activeSessions > 3 ? "warning" : "ok", value: `${activeSessions} active(s)`, icon: "ti-shield-lock" },
      { id: "storage", label: "Stockage media", statut: "ok", value: "Nominal", icon: "ti-cloud" },
      { id: "version", label: "Version deployee", statut: "ok", value: "v2.4.x", icon: "ti-tag" },
    ];
  }

  const monitoring = infra.monitoring;
  const system = monitoring.system || {};
  const cpu = Number(system.cpu_pct ?? 0);
  const ram = Number(system.ram_pct ?? 0);
  const disk = Number(system.disk_pct ?? 0);
  return [
    { id: "api", label: "API Servers", statut: monitoring.api?.ok ? "ok" : "warning", value: formatLatency(monitoring.api?.latency_ms), icon: "ti-server" },
    { id: "db", label: "PostgreSQL", statut: monitoring.database?.ok ? "ok" : "error", value: formatLatency(monitoring.database?.latency_ms), icon: "ti-database" },
    { id: "redis", label: "Redis Cache", statut: monitoring.cache?.ok ? "ok" : "warning", value: formatLatency(monitoring.cache?.latency_ms), icon: "ti-bolt" },
    { id: "celery", label: "Celery Queue", statut: monitoring.queue?.ok ? "ok" : "warning", value: `${monitoring.queue?.pending ?? 0} pending`, icon: "ti-loader" },
    { id: "cpu", label: "CPU", statut: cpu >= 80 ? "warning" : "ok", value: formatPct(system.cpu_pct), icon: "ti-cpu" },
    { id: "ram", label: "RAM", statut: ram >= 80 ? "warning" : "ok", value: formatPct(system.ram_pct), icon: "ti-device-desktop-analytics" },
    { id: "disk", label: "Disque", statut: disk >= 85 ? "warning" : "ok", value: formatPct(system.disk_pct), icon: "ti-hard-drive" },
    { id: "websocket", label: "WebSocket", statut: monitoring.websocket?.ok ? "ok" : "warning", value: monitoring.websocket?.status || (monitoring.websocket?.ok ? "OK" : "Non configure"), icon: "ti-plug-connected" },
    { id: "version", label: "Version deployee", statut: "ok", value: infra.version ?? "v2.x", icon: "ti-tag" },
  ];
}

function buildEvents(logs, dashboard) {
  const events = [];
  const rows = logs?.audit_logs || logs?.events || logs?.results || dashboard?.recent_platform_events || [];

  if (Array.isArray(rows)) {
    rows.slice(0, 10).forEach((log, index) => {
      const action = log.action ?? log.event_type ?? log.type ?? "";
      const desc = log.description ?? log.target_label ?? log.object_reference ?? "";
      const ts = log.created_at ?? log.timestamp ?? "";
      events.push({
        id: log.id ?? index,
        title: formatAction(action),
        description: desc,
        platform: log.platform ?? log.target_type ?? "",
        severity: guessSeverity(action, log),
        time: formatEventTime(ts),
        ...getEventStyle(action),
      });
    });
  }

  (dashboard?.alerts || []).forEach((alert, index) => {
    events.push({
      id: `alert-${index}`,
      title: alert.message || "Alerte",
      description: "",
      platform: "AFRIVO",
      severity: alert.type === "critical" ? "critique" : alert.type === "warning" ? "attention" : "ok",
      time: "Recent",
      icon: alert.type === "critical" ? "ti-alert-circle" : "ti-alert-triangle",
      iconBg: alert.type === "critical" ? "#FCEBEB" : "#FAEEDA",
      iconColor: alert.type === "critical" ? "#A32D2D" : "#633806",
    });
  });

  const order = { critique: 0, attention: 1, info: 2, ok: 3 };
  return events.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

function guessSeverity(action, log) {
  const text = `${action || ""} ${log?.severity || ""} ${log?.type || ""}`.toLowerCase();
  if (text.includes("critical") || text.includes("critique") || text.includes("error") || text.includes("erreur")) return "critique";
  if (text.includes("warning") || text.includes("warn") || text.includes("suspend") || text.includes("expired")) return "attention";
  if (text.includes("created") || text.includes("cree") || text.includes("ok")) return "ok";
  return "info";
}

function getEventStyle(action) {
  const text = (action || "").toLowerCase();
  if (text.includes("error") || text.includes("critical")) return { icon: "ti-alert-circle", iconBg: "#FCEBEB", iconColor: "#A32D2D" };
  if (text.includes("hotel") || text.includes("platform")) return { icon: "ti-building-plus", iconBg: "#E1F5EE", iconColor: "#0F6E56" };
  if (text.includes("user") || text.includes("admin")) return { icon: "ti-user-plus", iconBg: "#E6F1FB", iconColor: "#185FA5" };
  if (text.includes("license") || text.includes("subscription")) return { icon: "ti-receipt", iconBg: "#FAEEDA", iconColor: "#633806" };
  return { icon: "ti-info-circle", iconBg: "#F1EFE8", iconColor: "#5F5E5A" };
}

function formatAction(action) {
  if (!action) return "Evenement systeme";
  return action
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 60);
}

function formatEventTime(ts) {
  if (!ts) return "-";
  try {
    const date = new Date(ts);
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 2) return "A l'instant";
    if (diff < 60) return `Il y a ${diff} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`;
    return `${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "-";
  }
}
