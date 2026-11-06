import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  Download,
  Inbox,
  Pause,
  Play,
  Radio,
  Search,
  SlidersHorizontal,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";
import ConnectionPanel from "./ConnectionPanel";
import FrameInspector from "./FrameInspector";
import type { ConnectionLog, ConnectionState, Frame, HeaderEntry } from "../types";
import { downloadJson, formatBytes, formatTime, framePreview, makeId, payloadLabel } from "../lib/utils";

interface SSEStreamerProps {
  onStatusChange: (status: ConnectionState) => void;
  onEndpointChange: (endpoint: string) => void;
  onLog: (level: ConnectionLog["level"], title: string, details: string) => void;
  notify: (message: string) => void;
}

const now = Date.now();
const sampleEvents: Frame[] = [
  { id: "sse-sample-1", direction: "received", payload: JSON.stringify({ event: "order.created", order_id: "ord_1042", total: 89.5, currency: "USD" }), timestamp: now - 16000, opcode: null, source: "demo", eventType: "order.created" },
  { id: "sse-sample-2", direction: "received", payload: JSON.stringify({ event: "inventory.updated", sku: "SKU-1042", available: 18 }), timestamp: now - 31000, opcode: null, source: "demo", eventType: "inventory.updated" },
  { id: "sse-sample-3", direction: "received", payload: JSON.stringify({ event: "user.active", user_id: "usr_8c21", online: true }), timestamp: now - 47000, opcode: null, source: "demo", eventType: "user.active" },
];

const eventTypes = ["Mixed events", "order.created", "inventory.updated", "user.active", "payment.completed"];

function createSimulatedEvent(selectedType: string, index: number): Frame {
  const types = eventTypes.slice(1);
  const type = selectedType === "Mixed events" ? types[index % types.length] : selectedType;
  const data: Record<string, unknown> = {
    "order.created": { order_id: `ord_${1043 + index}`, total: Number((49 + Math.random() * 170).toFixed(2)), currency: "USD" },
    "inventory.updated": { sku: `SKU-${1042 + index}`, available: Math.floor(5 + Math.random() * 60) },
    "user.active": { user_id: `usr_${(8600 + index).toString(16)}`, online: true },
    "payment.completed": { payment_id: `pay_${3040 + index}`, amount: Number((25 + Math.random() * 80).toFixed(2)) },
  }[type] as Record<string, unknown>;

  return {
    id: makeId(),
    direction: "received",
    payload: JSON.stringify({ event: type, data, timestamp: new Date().toISOString() }),
    timestamp: Date.now(),
    opcode: null,
    source: "demo",
    eventType: type,
  };
}

export default function SSEStreamer({ onStatusChange, onEndpointChange, onLog, notify }: SSEStreamerProps) {
  const [protocol, setProtocol] = useState("https://");
  const [endpoint, setEndpoint] = useState("stream.wikimedia.org/v2/stream/recentchange");
  const [token, setToken] = useState("");
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [events, setEvents] = useState<Frame[]>(sampleEvents);
  const [selectedId, setSelectedId] = useState<string | null>(sampleEvents[0].id);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("Mixed events");
  const [intervalMs, setIntervalMs] = useState(2000);
  const [pausedEvents, setPausedEvents] = useState<Frame[] | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const eventIndexRef = useRef(0);

  useEffect(() => onStatusChange(status), [onStatusChange, status]);
  useEffect(() => onEndpointChange(`${protocol}${endpoint}`), [onEndpointChange, protocol, endpoint]);

  useEffect(() => {
    if (status !== "simulating") return;
    const timer = window.setInterval(() => {
      eventIndexRef.current += 1;
      setEvents((current) => [createSimulatedEvent(selectedType, eventIndexRef.current), ...current].slice(0, 150));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [status, selectedType, intervalMs]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function stopStream() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (status !== "disconnected") onLog("info", "SSE stream stopped", "The event stream or simulator was stopped by the user.");
    setStatus("disconnected");
  }

  const addParsedEvent = useCallback((lines: string[], responseHeaders: Record<string, string>) => {
    let type = "message";
    let eventId = "";
    const data: string[] = [];

    for (const line of lines) {
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const rawValue = colon === -1 ? "" : line.slice(colon + 1);
      const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
      if (field === "event") type = value || "message";
      if (field === "id") eventId = value;
      if (field === "data") data.push(value);
    }

    if (data.length === 0) return;
    const frame: Frame = {
      id: makeId(),
      direction: "received",
      payload: data.join("\n"),
      timestamp: Date.now(),
      opcode: null,
      source: "sse",
      eventType: type,
      headers: { ...responseHeaders, ...(eventId ? { "last-event-id": eventId } : {}) },
    };
    setEvents((current) => [frame, ...current].slice(0, 150));
  }, []);

  async function connectStream() {
    controllerRef.current?.abort();
    const cleanEndpoint = endpoint.trim().replace(/^\/+/, "");
    if (!cleanEndpoint) {
      notify("Enter an SSE endpoint URL first.");
      return;
    }

    let url: URL;
    try {
      url = new URL(`${protocol}${cleanEndpoint}`);
    } catch {
      notify("Enter a valid SSE endpoint URL.");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("connecting");
    onLog("info", "Opening SSE stream", `Connecting to ${url.toString()}`);

    try {
      const requestHeaders: Record<string, string> = { Accept: "text/event-stream" };
      if (token.trim()) requestHeaders.Authorization = `Bearer ${token.trim()}`;
      headers.forEach(({ key, value }) => { if (key.trim()) requestHeaders[key.trim()] = value; });

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: requestHeaders,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Server responded with HTTP ${response.status}`);
      if (!response.body) throw new Error("The response does not contain a readable stream");

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });
      setStatus("streaming");
      onLog("success", "SSE stream connected", `Receiving events from ${url.host}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let block: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lineEnd = buffer.indexOf("\n");
        while (lineEnd !== -1) {
          let line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line === "") {
            addParsedEvent(block, responseHeaders);
            block = [];
          } else {
            block.push(line);
          }
          lineEnd = buffer.indexOf("\n");
        }
      }
      if (buffer) block.push(buffer);
      addParsedEvent(block, responseHeaders);
      if (!controller.signal.aborted) {
        setStatus("disconnected");
        onLog("warning", "SSE stream ended", "The server closed the event stream.");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "The stream could not be opened";
      setStatus("error");
      onLog("error", "SSE connection failed", message);
      notify(`SSE connection failed: ${message}`);
    }
  }

  function emitEvent() {
    eventIndexRef.current += 1;
    const frame = createSimulatedEvent(selectedType, eventIndexRef.current);
    setEvents((current) => [frame, ...current].slice(0, 150));
    setSelectedId(frame.id);
  }

  function toggleSimulation() {
    if (status === "simulating") {
      stopStream();
    } else {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setStatus("simulating");
      onLog("success", "SSE simulator started", `Generating ${selectedType.toLowerCase()} every ${(intervalMs / 1000).toFixed(1)} seconds.`);
      emitEvent();
    }
  }

  const filteredEvents = (pausedEvents ?? events).filter((event) => !search.trim() || `${event.eventType} ${event.payload}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;
  const waitingCount = pausedEvents ? events.filter((event) => !pausedEvents.some((paused) => paused.id === event.id)).length : 0;

  return (
    <div className="view-enter space-y-5">
      <ConnectionPanel
        mode="sse"
        protocol={protocol}
        endpoint={endpoint}
        onProtocolChange={setProtocol}
        onEndpointChange={setEndpoint}
        status={status}
        token={token}
        onTokenChange={setToken}
        headers={headers}
        onHeadersChange={setHeaders}
        onConnect={connectStream}
        onDisconnect={stopStream}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(350px,0.85fr)]">
        <section className="surface-panel min-w-0 overflow-hidden" aria-label="SSE event stream">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><Waves size={18} /></div>
              <div><h2 className="text-[15px] font-semibold text-[#f0f6f6]">Event stream</h2><p className="mt-0.5 text-[11px] text-[#82949e]">Incoming server-sent events, as they happen.</p></div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6ed6a6]">{status === "streaming" ? "Live stream" : status === "simulating" ? "Simulating" : "Sample events"}</span>
          </div>
          <div className="flex gap-2 border-y border-[#293741] px-4 py-2.5 sm:px-5">
            <div className="relative min-w-0 flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#708791]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter events..." aria-label="Filter SSE events" className="field-control h-9 w-full rounded-lg pl-9 pr-3 text-xs" />
            </div>
            <button type="button" onClick={() => setPausedEvents(pausedEvents ? null : [...events])} title={pausedEvents ? "Resume events" : "Pause events"} aria-label={pausedEvents ? "Resume events" : "Pause events"} className="icon-button h-9 w-9">{pausedEvents ? <Play size={15} /> : <Pause size={15} />}</button>
            <button type="button" onClick={() => { setEvents([]); setPausedEvents(null); setSelectedId(null); }} title="Clear events" aria-label="Clear events" className="icon-button h-9 w-9"><Trash2 size={15} /></button>
            <button type="button" onClick={() => { downloadJson("socketpulse-sse-events.json", events); notify("SSE events exported."); }} title="Export events" aria-label="Export events" className="icon-button h-9 w-9"><Download size={15} /></button>
          </div>

          <div className="flex h-[46px] items-center justify-between border-b border-[#293741] bg-[#15212a]/65 px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6cd8a5] sm:px-6">
            <span className="flex items-center gap-2"><ArrowDownLeft size={15} /> Incoming events</span>
            <span className="text-[#8299a0]">{filteredEvents.length.toString().padStart(2, "0")}</span>
          </div>
          <div className="scroll-thin h-[492px] overflow-y-auto bg-[#101921]/40">
            {filteredEvents.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-5 text-center"><Inbox size={26} strokeWidth={1.4} className="text-[#59727b]" /><p className="mt-3 text-[13px] text-[#a6b6bc]">No events to show</p><p className="mt-1 text-xs text-[#718791]">Connect a stream or start the simulator.</p></div>
            ) : filteredEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => setSelectedId(event.id)} className={`frame-enter relative block w-full border-b border-[#25333d] px-5 py-4 text-left transition-colors hover:bg-[#1a2a33] sm:px-6 ${selectedId === event.id ? "bg-[#1a3037]" : ""}`}>
                {selectedId === event.id && <span className="absolute bottom-0 left-0 top-0 w-[2px] bg-[#5ad19f]" />}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2"><span className="rounded-[5px] bg-[#173b34] px-1.5 py-1 font-mono text-[9px] font-semibold uppercase text-[#6bd4a4]">Event</span><span className="truncate font-mono text-[11px] font-medium text-[#d3e1e1]">{event.eventType ?? payloadLabel(event.payload)}</span></div>
                  <span className="shrink-0 font-mono text-[10px] text-[#6d838d]">{formatTime(event.timestamp)}</span>
                </div>
                <p className="mt-2.5 truncate font-mono text-[11px] text-[#95aab1]">{framePreview(event)}</p>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#607782]"><span>DATA / {formatBytes(event.payload)}</span><span>{event.source === "demo" ? "SIMULATED" : "LIVE"}</span></div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-[#293741] px-5 py-3 font-mono text-[10px] text-[#69818a] sm:px-6"><span>{events.length} total events</span><span>{pausedEvents ? `${waitingCount} NEW WHILE PAUSED` : "TEXT/EVENT-STREAM"}</span></div>
        </section>

        <div className="min-w-0 space-y-5">
          <section className="surface-panel overflow-hidden" aria-label="SSE simulator">
            <div className="flex items-center gap-3 border-b border-[#293741] px-5 py-4 sm:px-6"><div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><SlidersHorizontal size={18} /></div><div><h2 className="text-[15px] font-semibold text-[#f0f6f6]">Event simulator</h2><p className="mt-0.5 text-[11px] text-[#82949e]">Test your workflow without a server.</p></div></div>
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div><label htmlFor="sim-event-type" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.13em] text-[#8298a2]">Event type</label><select id="sim-event-type" value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="field-control h-10 w-full rounded-lg px-3 text-xs">{eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div><div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.13em] text-[#8298a2]"><label htmlFor="sim-interval">Interval</label><span className="text-[#78dcd7]">{(intervalMs / 1000).toFixed(1)}s</span></div><input id="sim-interval" type="range" min="500" max="5000" step="500" value={intervalMs} onChange={(event) => setIntervalMs(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-[#70dbd7]" /><div className="mt-1 flex justify-between font-mono text-[9px] text-[#617782]"><span>FAST / 0.5S</span><span>SLOW / 5S</span></div></div>
              <div className="flex gap-2 pt-1"><button type="button" onClick={toggleSimulation} className={`flex h-[41px] flex-1 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors ${status === "simulating" ? "border border-[#754448] bg-[#38252a] text-[#ff9b9b] hover:bg-[#462c31]" : "bg-[#67dbd6] text-[#092024] hover:bg-[#89e9e3]"}`}>{status === "simulating" ? <Pause size={15} /> : <Radio size={15} />}{status === "simulating" ? "Stop simulator" : "Start simulator"}</button><button type="button" onClick={emitEvent} title="Emit a single event" aria-label="Emit a single event" className="icon-button h-[41px] w-[41px]"><Zap size={16} /></button></div>
            </div>
          </section>
          <FrameInspector frame={selectedEvent} />
        </div>
      </div>
    </div>
  );
}