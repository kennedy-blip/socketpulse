import type { Frame } from "../types";

export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function byteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function formatBytes(value: string): string {
  return formatByteCount(byteSize(value));
}

export function formatByteCount(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatFrameBytes(frame: Frame): string {
  return formatByteCount(frame.byteLength ?? byteSize(frame.payload));
}

export function payloadLabel(payload: string): string {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const label = record.event ?? record.type ?? record.action ?? record.op;
      if (typeof label === "string") return label;
    }
  } catch {
    // Plain text frames do not have an event label.
  }
  return "text frame";
}

export function framePreview(frame: Frame): string {
  try {
    return JSON.stringify(JSON.parse(frame.payload));
  } catch {
    return frame.payload.replace(/\s+/g, " ");
  }
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}