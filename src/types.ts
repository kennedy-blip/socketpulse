export type TabId = "websocket" | "sse" | "builder" | "logs";

export type ConnectionState =
  | "demo"
  | "connecting"
  | "connected"
  | "disconnected"
  | "streaming"
  | "simulating"
  | "error";

export type FrameDirection = "sent" | "received";

export interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

export interface Frame {
  id: string;
  direction: FrameDirection;
  payload: string;
  timestamp: number;
  opcode: number | null;
  byteLength?: number;
  source: "demo" | "websocket" | "sse";
  eventType?: string;
  headers?: Record<string, string>;
}

export interface ConnectionLog {
  id: string;
  timestamp: number;
  level: "info" | "success" | "warning" | "error";
  title: string;
  details: string;
}

export type TemplateName = "subscribe" | "ping" | "auth_refresh" | "broadcast";

export const templateNames: TemplateName[] = [
  "subscribe",
  "ping",
  "auth_refresh",
  "broadcast",
];

export function createTemplate(name: TemplateName): string {
  const templates: Record<TemplateName, object> = {
    subscribe: {
      type: "subscribe",
      channel: "market.btc-usd",
      options: { snapshot: true },
    },
    ping: { type: "ping", timestamp: new Date().toISOString() },
    auth_refresh: {
      type: "auth_refresh",
      token: "your-access-token",
    },
    broadcast: {
      type: "broadcast",
      channel: "general",
      data: { message: "Hello, world!" },
    },
  };

  return JSON.stringify(templates[name], null, 2);
}