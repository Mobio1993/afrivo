export function formatDate(value) {
  if (!value || value === "-") {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

export function formatDateTime(value) {
  if (!value || value === "-") {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

export function formatAmount(value) {
  if (value === null || value === undefined || value === "" || value === "-") {
    return "-";
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function buildInitials(fullName) {
  const parts = (fullName || "").split(" ").filter(Boolean).slice(0, 2);
  if (!parts.length) {
    return "CL";
  }
  return parts.map((item) => item[0]?.toUpperCase() || "").join("");
}

export function normalizeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return value;
}

const CLIENT_STATUS_MAP = {
  vip: {
    value: "vip",
    label: "VIP",
    tone: "vip",
  },
  loyal: {
    value: "loyal",
    label: "Fidele",
    tone: "loyal",
  },
  company: {
    value: "company",
    label: "Entreprise",
    tone: "company",
  },
  blacklist: {
    value: "blacklist",
    label: "Blacklist",
    tone: "blacklist",
  },
  inactive: {
    value: "inactive",
    label: "Inactif",
    tone: "standard",
  },
  standard: {
    value: "standard",
    label: "Standard",
    tone: "standard",
  },
};

export function normalizeClientStatus(value) {
  if (typeof value !== "string") {
    return CLIENT_STATUS_MAP.standard;
  }

  const normalizedKey = value.trim().toLowerCase();
  return CLIENT_STATUS_MAP[normalizedKey] || CLIENT_STATUS_MAP.standard;
}
