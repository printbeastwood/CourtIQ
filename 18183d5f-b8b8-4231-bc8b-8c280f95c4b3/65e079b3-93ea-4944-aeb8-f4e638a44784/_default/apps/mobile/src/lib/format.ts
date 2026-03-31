export function formatPrice(cents: number, currency: string = "THB"): string {
  const amount = cents / 100;
  if (currency === "THB") {
    return `฿${amount.toLocaleString()}`;
  }
  return `${currency} ${amount.toFixed(2)}`;
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateShort(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export function surfaceLabel(surface: string): string {
  const labels: Record<string, string> = {
    glass: "Glass",
    panoramic: "Panoramic",
    concrete: "Concrete",
    turf: "Turf",
  };
  return labels[surface] ?? surface;
}

export function surfaceColor(surface: string): string {
  const colors: Record<string, string> = {
    glass: "#06B6D4",
    panoramic: "#8B5CF6",
    concrete: "#6B7280",
    turf: "#22C55E",
  };
  return colors[surface] ?? "#6B7280";
}
