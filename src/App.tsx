import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Braces,
  Check,
  Download,
  RefreshCw,
  Radio,
  ScrollText,
  Waves,
  X,
} from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import ConnectionLogs from "./components/ConnectionLogs";
import FrameInspector from "./components/FrameInspector";
import FrameStream from "./components/FrameStream";
import PayloadBuilder from "./components/PayloadBuilder";
import PayloadSender from "./components/PayloadSender";
import SSEStreamer from "./components/SSEStreamer";
import type { ConnectionLog, ConnectionState, Frame, HeaderEntry, TabId } from "./types";
import { createTemplate } from "./types";
import { byteSize, downloadJson, formatByteCount, formatBytes, makeId } from "./lib/utils";

const startedAt = Date.now();
const initialFrames: Frame[] = [
  {
    id: "sample-7", direction: "received", timestamp: startedAt - 5000, opcode: 1, source: "demo",
    payload: JSON.stringify({ event: "trade.update", channel: "market.btc-usd", data: { price: 67482.3, volume: 0.482, side: "buy" } }),
  },
  {
    id: "sample-6", direction: "received", timestamp: startedAt - 13000, opcode: 1, source: "demo",
    payload: JSON.stringify({ type: "pong", timestamp: new Date(startedAt - 13000).toISOString(), latency_ms: 18 }),
  },
  {
    id: "sample-5", direction: "sent", timestamp: startedAt - 13018, opcode: 1, source: "demo",
    payload: JSON.stringify({ type: "ping", timestamp: new Date(startedAt - 13018).toISOString() }),
  },
  {
    id: "sample-4", direction: "received", timestamp: startedAt - 27000, opcode: 1, source: "demo",
    payload: JSON.stringify({ event: "subscribed", channel: "market.btc-usd", status: "ok" }),
  },
  {
    id: "sample-3", direction: "sent", timestamp: startedAt - 27180, opcode: 1, source: "demo",
    payload: JSON.stringify({ type: "subscribe", channel: "market.btc-usd", options: { snapshot: true } }),
  },
  {
    id: "sample-2", direction: "received", timestamp: startedAt - 38000, opcode: 1, source: "demo",
    payload: JSON.stringify({ event: "connected", connection_id: "sp_8f21c4", message: "Demo session ready" }),
  },
  {
    id: "sample-1", direction: "sent", timestamp: startedAt - 40000, opcode: 1, source: "demo",
    payload: JSON.stringify({ type: "auth_refresh", token: "demo-token" }),
  },
];

const initialLogs: ConnectionLog[] = [
  { id: "log-3", timestamp: startedAt - 5000, level: "info", title: "Example traffic loaded", details: "Sample incoming and outgoing frames are ready to inspect." },
  { id: "log-2", timestamp: startedAt - 38000, level: "success", title: "Demo session ready", details: "Local echo simulation is active. Connect live to open a real WebSocket." },
  { id: "log-1", timestamp: startedAt - 40000, level: "info", title: "Workspace initialized", details: "SocketPulse is ready for real-time debugging." },
];

const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "websocket", label: "WebSocket Inspector", icon: ArrowLeftRight },
  { id: "sse", label: "SSE Streamer", icon: Waves },
  { id: "builder", label: "Payload Builder", icon: Braces },
  { id: "logs", label: "Connection Logs", icon: ScrollText },
];

const pageCopy: Record<TabId, { eyebrow: string; title: string; description: string }> = {
  websocket: { eyebrow: "WORKSPACE / 01", title: "WebSocket Inspector", description: "A clear view into every connection, frame, and payload." },
  sse: { eyebrow: "WORKSPACE / 02", title: "SSE Streamer", description: "Watch server-sent events unfold in real time." },
  builder: { eyebrow: "WORKSPACE / 03", title: "Payload Builder", description: "Build, validate, and send exactly the JSON you need." },
  logs: { eyebrow: "WORKSPACE / 04", title: "Connection Logs", description: "Follow the complete story of your real-time session." },
};

function makeDemoReply(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (parsed.type === "ping") return JSON.stringify({ type: "pong", timestamp: new Date().toISOString(), latency_ms: 18 });
    if (parsed.type === "subscribe") return JSON.stringify({ event: "subscribed", channel: parsed.channel ?? "default", status: "ok" });
    if (parsed.type === "auth_refresh") return JSON.stringify({ event: "auth.refreshed", expires_in: 3600, status: "ok" });
    if (parsed.type === "broadcast") return JSON.stringify({ event: "broadcast.received", channel: parsed.channel ?? "general", data: parsed.data ?? {} });
    return JSON.stringify({ event: "echo", data: parsed });
  } catch {
    return payload;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("websocket");
  const [protocol, setProtocol] = useState("wss://");
  const [endpoint, setEndpoint] = useState("echo.websocket.events");
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState<"query" | "message">("query");
  const [queryKey, setQueryKey] = useState("token");
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [wsStatus, setWsStatus] = useState<ConnectionState>("demo");
  const [sseStatus, setSseStatus] = useState<ConnectionState>("disconnected");
  const [sseEndpointLabel, setSseEndpointLabel] = useState("https://stream.wikimedia.org/v2/stream/recentchange");
  const [latency, setLatency] = useState<number | null>(18);
  const [frames, setFrames] = useState<Frame[]>(initialFrames);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(initialFrames[0].id);
  const [payload, setPayload] = useState(createTemplate("subscribe"));
  const [logs, setLogs] = useState<ConnectionLog[]>(initialLogs);
  const [toast, setToast] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const pendingEchoesRef = useRef<Map<string, number>>(new Map());
  const demoTimersRef = useRef<number[]>([]);

  const notify = useCallback((message: string) => setToast(message), []);
  const addLog = useCallback((level: ConnectionLog["level"], title: string, details: string) => {
    setLogs((current) => [{ id: makeId(), timestamp: Date.now(), level, title, details }, ...current].slice(0, 200));
  }, []);
  const addFrame = useCallback((frameData: Omit<Frame, "id" | "timestamp">, select = false) => {
    const frame: Frame = { ...frameData, id: makeId(), timestamp: Date.now() };
    setFrames((current) => [frame, ...current].slice(0, 150));
    if (select) setSelectedFrameId(frame.id);
    return frame;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (wsStatus !== "demo") return;
    const timer = window.setInterval(() => {
      const price = Number((67400 + Math.random() * 200).toFixed(2));
      addFrame({ direction: "received", payload: JSON.stringify({ event: "trade.update", channel: "market.btc-usd", data: { price, volume: Number((Math.random() * 1.5).toFixed(3)), side: Math.random() > 0.5 ? "buy" : "sell" } }), opcode: 1, source: "demo" });
    }, 16000);
    return () => window.clearInterval(timer);
  }, [addFrame, wsStatus]);

  useEffect(() => () => {
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
    }
    demoTimersRef.current.forEach(window.clearTimeout);
  }, []);

  function clearDemoTimers() {
    demoTimersRef.current.forEach(window.clearTimeout);
    demoTimersRef.current = [];
  }

  const connectSocket = useCallback(() => {
    const cleanEndpoint = endpoint.trim().replace(/^\/+/, "");
    if (!cleanEndpoint) {
      notify("Enter a WebSocket endpoint URL first.");
      return;
    }

    let url: URL;
    try {
      url = new URL(`${protocol}${cleanEndpoint}`);
      if (!(["ws:", "wss:"].includes(url.protocol))) throw new Error("Use ws:// or wss:// for WebSockets");
      if (token.trim() && authMode === "query") url.searchParams.set(queryKey.trim() || "token", token.trim());
    } catch {
      notify("Enter a valid ws:// or wss:// endpoint URL.");
      return;
    }

    clearDemoTimers();
    if (socketRef.current) {
      const previous = socketRef.current;
      previous.onopen = null;
      previous.onmessage = null;
      previous.onerror = null;
      previous.onclose = null;
      previous.close();
      socketRef.current = null;
    }

    setWsStatus("connecting");
    setLatency(null);
    pendingEchoesRef.current.clear();
    addLog("info", "Opening WebSocket", `Connecting to ${url.origin}${url.pathname}`);

    let socket: WebSocket;
    try {
      socket = new WebSocket(url.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid WebSocket endpoint";
      setWsStatus("error");
      addLog("error", "Connection failed", message);
      notify(message);
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      if (socketRef.current !== socket) return;
      setWsStatus("connected");
      addLog("success", "WebSocket connected", `Handshake completed with ${url.host}. Ready to send frames.`);
      notify("WebSocket connected.");
      if (token.trim() && authMode === "message") {
        const authPayload = JSON.stringify({ type: "auth", token: token.trim() });
        socket.send(authPayload);
        addFrame({ direction: "sent", payload: authPayload, opcode: 1, source: "websocket" });
        addLog("info", "Auth message sent", "A token was sent as the first WebSocket message.");
      }
    };

    socket.onmessage = async (event: MessageEvent) => {
      if (socketRef.current !== socket) return;
      let data: string;
      let opcode = 1;
      let actualByteLength: number | undefined;
      if (typeof event.data === "string") {
        data = event.data;
      } else if (event.data instanceof Blob) {
        opcode = 2;
        const bytes = new Uint8Array(await event.data.arrayBuffer());
        actualByteLength = bytes.byteLength;
        data = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
      } else if (event.data instanceof ArrayBuffer) {
        opcode = 2;
        const bytes = new Uint8Array(event.data);
        actualByteLength = bytes.byteLength;
        data = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
      } else {
        data = String(event.data);
      }
      if (socketRef.current !== socket) return;
      const sentAt = pendingEchoesRef.current.get(data);
      if (sentAt != null) {
        setLatency(Math.max(1, Date.now() - sentAt));
        pendingEchoesRef.current.delete(data);
      }
      addFrame({ direction: "received", payload: data, opcode, byteLength: actualByteLength, source: "websocket" });
      addLog("info", "Frame received", `${formatByteCount(actualByteLength ?? byteSize(data))} received from ${url.host}.`);
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      setWsStatus("error");
      addLog("error", "WebSocket connection error", "The browser could not reach the endpoint. Check TLS, origin policy, and server availability.");
      notify("WebSocket connection failed. Check the endpoint and connection logs.");
    };

    socket.onclose = (event: CloseEvent) => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      setWsStatus((current) => current === "error" ? "error" : "disconnected");
      setLatency(null);
      addLog(event.wasClean ? "info" : "warning", "WebSocket closed", `Close code ${event.code}${event.reason ? `: ${event.reason}` : "."}`);
    };
  }, [addFrame, addLog, authMode, endpoint, notify, protocol, queryKey, token]);

  const disconnectSocket = useCallback(() => {
    clearDemoTimers();
    if (socketRef.current) {
      const socket = socketRef.current;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close(1000, "Closed by user");
      socketRef.current = null;
    }
    setWsStatus("disconnected");
    setLatency(null);
    pendingEchoesRef.current.clear();
    addLog("info", "Socket disconnected", wsStatus === "demo" ? "Local demo simulation stopped." : "Connection closed by user.");
  }, [addLog, wsStatus]);

  function startDemo() {
    if (socketRef.current) {
      const socket = socketRef.current;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    }
    setWsStatus("demo");
    setLatency(18);
    addLog("success", "Demo session ready", "Local echo simulation is active. No remote socket was opened.");
    notify("Local demo session started.");
  }

  const sendFrame = useCallback((data: string) => {
    if (wsStatus === "demo") {
      addFrame({ direction: "sent", payload: data, opcode: 1, source: "demo" }, true);
      addLog("success", "Demo frame sent", `${formatBytes(data)} sent to the local echo simulator.`);
      const timer = window.setTimeout(() => {
        const reply = makeDemoReply(data);
        addFrame({ direction: "received", payload: reply, opcode: 1, source: "demo" }, true);
        setLatency(18);
      }, 380);
      demoTimersRef.current.push(timer);
      return;
    }
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      notify("Connect a WebSocket before sending a frame.");
      return;
    }
    try {
      socketRef.current.send(data);
      pendingEchoesRef.current.set(data, Date.now());
      addFrame({ direction: "sent", payload: data, opcode: 1, source: "websocket" }, true);
      addLog("success", "Frame sent", `${formatBytes(data)} sent to the connected WebSocket.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Frame could not be sent";
      addLog("error", "Send failed", message);
      notify(message);
    }
  }, [addFrame, addLog, notify, wsStatus]);

  function exportFrames() {
    downloadJson("socketpulse-message-log.json", { app: "SocketPulse", exportedAt: new Date().toISOString(), frames });
    notify("Message log exported as JSON.");
  }

  function useBuiltPayload(value: string) {
    setPayload(value);
    setActiveTab("websocket");
    notify("Payload loaded into the sender.");
    window.setTimeout(() => document.getElementById("payload-sender")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  const displayStatus = activeTab === "sse" ? sseStatus : wsStatus;
  const activeConnection = ["demo", "connected", "streaming", "simulating"].includes(displayStatus);
  const statusLabel = displayStatus === "demo" ? "Connected" : displayStatus === "streaming" ? "Streaming" : displayStatus === "simulating" ? "Simulating" : displayStatus === "connecting" ? "Connecting" : displayStatus === "error" ? "Error" : displayStatus === "connected" ? "Connected" : "Disconnected";
  const page = pageCopy[activeTab];
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#26343d] bg-[#0d151b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1600px] items-center justify-between gap-2 px-5 sm:gap-4 sm:px-8 xl:px-10">
          <button type="button" onClick={() => setActiveTab("websocket")} aria-label="SocketPulse home" className="group flex shrink-0 items-center gap-2 text-left sm:gap-3">
            <span className="brand-glow relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#376c70] bg-[#15343a] text-[#70e1dc] transition-transform group-hover:scale-105 sm:h-10 sm:w-10"><Radio size={21} strokeWidth={2.1} /><span className="absolute right-[7px] top-[8px] h-[4px] w-[4px] rounded-full bg-[#80f1cd]" /></span>
            <span className="text-[18px] font-bold tracking-[-0.055em] text-[#f1f7f6] sm:text-[21px]">Socket<span className="text-[#71deda]">Pulse</span></span>
            <span title={`Connection: ${statusLabel}`} className={`h-1.5 w-1.5 rounded-full sm:hidden ${activeConnection ? "status-live bg-[#4bd69c]" : "bg-[#718690]"}`} />
            <span className="hidden rounded border border-[#36535a] bg-[#193038] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-[#83c6c7] sm:inline">BETA</span>
          </button>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <div className="mr-1 hidden min-w-0 items-center gap-2.5 rounded-[9px] border border-[#2b3b42] bg-[#142229] px-3 py-2 sm:flex sm:px-3.5">
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${activeConnection ? "status-live bg-[#4bd69c]" : displayStatus === "connecting" ? "animate-pulse bg-[#edbc65]" : displayStatus === "error" ? "bg-[#f17678]" : "bg-[#718690]"}`} />
              <div className="min-w-0 leading-tight"><div className="whitespace-nowrap text-[10px] font-semibold text-[#d6e3e4] sm:text-[11px]">Connection: <span className={activeConnection ? "text-[#82dcb3]" : "text-[#b1c0c4]"}>{statusLabel}</span>{displayStatus === "demo" && <span className="ml-1.5 font-mono text-[9px] text-[#75a6a5]">DEMO</span>}</div><div className="hidden max-w-[225px] truncate pt-1 font-mono text-[9px] text-[#768d96] md:block" title={activeTab === "sse" ? sseEndpointLabel : `${protocol}${endpoint}`}>{activeTab === "sse" ? sseEndpointLabel : `${protocol}${endpoint}`}</div></div>
            </div>
            <button type="button" onClick={connectSocket} title="Reconnect Socket" aria-label="Reconnect Socket" className="icon-button h-8 w-8 gap-2 text-[11px] font-semibold sm:h-9 sm:w-auto sm:px-3"><RefreshCw size={15} /><span className="hidden lg:inline">Reconnect Socket</span></button>
            <button type="button" onClick={exportFrames} title="Export Message Log" aria-label="Export Message Log" className="icon-button h-8 w-8 gap-2 border-[#315858] bg-[#1b393b] text-[11px] font-semibold text-[#83dfd9] hover:border-[#57aaa8] sm:h-9 sm:w-auto sm:px-3"><Download size={15} /><span className="hidden lg:inline">Export Message Log</span></button>
          </div>
        </div>

        <div className="border-t border-[#1d2b33] bg-[#0c141a]">
          <nav className="scroll-thin mx-auto flex h-[51px] max-w-[1600px] items-stretch gap-1 overflow-x-auto px-5 sm:gap-3 sm:px-8 xl:px-10" aria-label="Main navigation">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined} className={`relative flex shrink-0 items-center gap-2 px-2.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${activeTab === id ? "text-[#7ae1dc]" : "text-[#8297a0] hover:text-[#d7e6e7]"}`}>
                <Icon size={15} strokeWidth={activeTab === id ? 2.2 : 1.8} />{label}
                {activeTab === id && <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-t bg-[#72dcd7] shadow-[0_0_12px_rgba(106,219,215,0.5)] sm:left-3 sm:right-3" />}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 pb-16 pt-8 sm:px-8 sm:pt-9 xl:px-10">
        <div className="mb-7">
          <div className="flex items-center gap-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#70c8c8]"><span className="h-[1px] w-5 bg-[#68c8c7]" />{page.eyebrow}</div>
          <h1 className="mt-3 text-[29px] font-bold tracking-[-0.045em] text-[#edf5f4] sm:text-[34px]">{page.title}</h1>
          <p className="mt-1.5 text-[13px] text-[#8ca0a9] sm:text-sm">{page.description}</p>
        </div>

        <div className={activeTab === "websocket" ? "view-enter" : "hidden"}>
          <ConnectionPanel
            mode="websocket"
            protocol={protocol}
            endpoint={endpoint}
            onProtocolChange={setProtocol}
            onEndpointChange={setEndpoint}
            status={wsStatus}
            latency={latency}
            token={token}
            onTokenChange={setToken}
            authMode={authMode}
            onAuthModeChange={setAuthMode}
            queryKey={queryKey}
            onQueryKeyChange={setQueryKey}
            headers={headers}
            onHeadersChange={setHeaders}
            onConnect={connectSocket}
            onDisconnect={disconnectSocket}
            onStartDemo={startDemo}
          />
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(350px,0.85fr)]">
            <FrameStream frames={frames} selectedId={selectedFrameId} onSelect={setSelectedFrameId} onClear={() => { setFrames([]); setSelectedFrameId(null); addLog("info", "Message log cleared", "All frames were removed from the current workspace."); }} status={wsStatus} />
            <div className="min-w-0 space-y-5"><div id="payload-sender"><PayloadSender payload={payload} onPayloadChange={setPayload} onSend={sendFrame} canSend={wsStatus === "demo" || wsStatus === "connected"} /></div><FrameInspector frame={selectedFrame} /></div>
          </div>
        </div>

        <div className={activeTab === "sse" ? "" : "hidden"}><SSEStreamer onStatusChange={setSseStatus} onEndpointChange={setSseEndpointLabel} onLog={addLog} notify={notify} /></div>
        <div className={activeTab === "builder" ? "" : "hidden"}><PayloadBuilder onUsePayload={useBuiltPayload} notify={notify} /></div>
        <div className={activeTab === "logs" ? "" : "hidden"}><ConnectionLogs logs={logs} onClear={() => setLogs([])} notify={notify} /></div>
      </main>

      <footer className="border-t border-[#1d2b33] px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#617681]"><span>SOCKETPULSE / REAL-TIME DEBUGGING WORKSPACE</span><span>BUILT FOR THE BROWSER <span className="mx-2 text-[#35515a]">/</span> LOCAL SESSION</span></div></footer>

      {toast && <div role="status" className="view-enter fixed bottom-5 right-5 z-50 flex max-w-[min(360px,calc(100vw-40px))] items-center gap-2.5 rounded-[10px] border border-[#3f6c68] bg-[#173532] px-4 py-3 text-xs font-medium text-[#d7f5eb] shadow-[0_16px_50px_rgba(0,0,0,0.35)]"><Check size={15} className="shrink-0 text-[#76dbaa]" /><span>{toast}</span><button type="button" onClick={() => setToast("")} aria-label="Dismiss notification" className="ml-1 text-[#8fb5aa] hover:text-white"><X size={14} /></button></div>}
    </div>
  );
}
