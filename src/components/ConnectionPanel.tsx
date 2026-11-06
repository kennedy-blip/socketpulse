import { useState } from "react";
import {
  Activity,
  ChevronDown,
  CircleHelp,
  Globe2,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
  Unplug,
  Zap,
} from "lucide-react";
import type { ConnectionState, HeaderEntry } from "../types";
import { makeId } from "../lib/utils";

interface ConnectionPanelProps {
  mode: "websocket" | "sse";
  protocol: string;
  endpoint: string;
  onProtocolChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  status: ConnectionState;
  latency?: number | null;
  token: string;
  onTokenChange: (value: string) => void;
  authMode?: "query" | "message";
  onAuthModeChange?: (value: "query" | "message") => void;
  queryKey?: string;
  onQueryKeyChange?: (value: string) => void;
  headers: HeaderEntry[];
  onHeadersChange: (value: HeaderEntry[]) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartDemo?: () => void;
}

const statusText: Record<ConnectionState, string> = {
  demo: "Demo connected",
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
  streaming: "Streaming",
  simulating: "Simulating",
  error: "Connection error",
};

export default function ConnectionPanel({
  mode,
  protocol,
  endpoint,
  onProtocolChange,
  onEndpointChange,
  status,
  latency,
  token,
  onTokenChange,
  authMode = "query",
  onAuthModeChange,
  queryKey = "token",
  onQueryKeyChange,
  headers,
  onHeadersChange,
  onConnect,
  onDisconnect,
  onStartDemo,
}: ConnectionPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isSse = mode === "sse";
  const isConnected = status === "connected" || status === "streaming";
  const isPreview = status === "demo" || status === "simulating";
  const isBusy = status === "connecting";
  const isLive = isConnected || isPreview;

  const protocols = isSse ? ["https://", "http://"] : ["wss://", "ws://"];

  function handleEndpointInput(value: string) {
    const match = value.match(/^(wss?|https?):\/\/(.*)$/i);
    if (match && protocols.includes(`${match[1].toLowerCase()}://`)) {
      onProtocolChange(`${match[1].toLowerCase()}://`);
      onEndpointChange(match[2]);
      return;
    }
    onEndpointChange(value);
  }

  function updateHeader(id: string, field: "key" | "value", value: string) {
    onHeadersChange(headers.map((header) => header.id === id ? { ...header, [field]: value } : header));
  }

  return (
    <section className="surface-panel overflow-hidden" aria-label={isSse ? "SSE connection setup" : "WebSocket connection setup"}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#26343e] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#2e4e50] bg-[#153135] text-[#67dedc]">
            {isSse ? <Globe2 size={19} strokeWidth={1.9} /> : <Link2 size={19} strokeWidth={2} />}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#f0f6f6]">Connection setup</h2>
            <p className="mt-0.5 text-xs text-[#81939e]">
              {isSse ? "Connect to an event stream or run a simulation." : "Configure your endpoint and inspect the handshake."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#b8c7cc]">
            <span className={`h-[7px] w-[7px] rounded-full ${isLive ? "status-live bg-[#4bd69c]" : isBusy ? "animate-pulse bg-[#edbc65]" : status === "error" ? "bg-[#f17678]" : "bg-[#627682]"}`} />
            {statusText[status]}
          </div>
          {!isSse && (
            <div className="flex items-center gap-1.5 border-l border-[#32404a] pl-3 font-mono text-[11px] text-[#8ea1a9] sm:pl-5">
              <Activity size={13} className="text-[#62d8d4]" />
              {latency == null ? "-- ms" : `${latency} ms`}
              {status === "demo" && <span className="hidden text-[#647c85] sm:inline">demo</span>}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-5 sm:px-6 sm:pb-5">
        <label htmlFor={`${mode}-endpoint`} className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8297a0]">
          Endpoint URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="field-control flex min-w-0 flex-1 overflow-hidden rounded-[9px] focus-within:border-[#51c7ca] focus-within:shadow-[0_0_0_3px_rgba(82,211,212,0.11)]">
            <div className="relative flex shrink-0 items-center border-r border-[#293943] bg-[#13232b]">
              <select
                aria-label="Protocol"
                value={protocol}
                onChange={(event) => onProtocolChange(event.target.value)}
                className="h-[47px] appearance-none bg-transparent py-0 pl-3.5 pr-8 font-mono text-[12px] font-medium text-[#69dcd9] outline-none sm:pl-4"
              >
                {protocols.map((item) => <option key={item} value={item} className="bg-[#14212a]">{item}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 text-[#6ca3a6]" />
            </div>
            <input
              id={`${mode}-endpoint`}
              value={endpoint}
              onChange={(event) => handleEndpointInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") onConnect(); }}
              spellCheck={false}
              autoComplete="off"
              placeholder={isSse ? "your-server.com/events" : "your-server.com/socket"}
              className="h-[47px] min-w-0 flex-1 bg-transparent px-3.5 font-mono text-[12px] text-[#e4eff0] outline-none placeholder:text-[#536673] sm:px-4 sm:text-[13px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isConnected || isBusy ? onDisconnect : onConnect}
              className={`inline-flex h-[49px] flex-1 items-center justify-center gap-2 rounded-[9px] px-5 text-[13px] font-bold transition-all sm:min-w-[156px] sm:flex-none ${isConnected || isBusy ? "border border-[#754448] bg-[#38252a] text-[#ff9b9b] hover:bg-[#462c31]" : "bg-[#66dbd5] text-[#092025] shadow-[0_4px_18px_rgba(76,207,204,0.16)] hover:-translate-y-0.5 hover:bg-[#85e9e1]"}`}
            >
              {isBusy ? <LoaderCircle size={16} className="animate-spin" /> : isConnected ? <Unplug size={16} /> : <Zap size={16} fill="currentColor" strokeWidth={1.5} />}
              {isBusy ? "Cancel" : isConnected ? "Disconnect" : isPreview ? "Connect live" : isSse ? "Connect stream" : "Connect"}
            </button>
            {isPreview && (
              <button type="button" onClick={onDisconnect} className="icon-button h-[49px] w-[49px]" title="Stop demo connection" aria-label="Stop demo connection">
                <Unplug size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            aria-expanded={advancedOpen}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#a8bcc3] transition-colors hover:text-[#73e1de]"
          >
            <ChevronDown size={14} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            Advanced settings
            {(token || headers.some((header) => header.key || header.value)) && <span className="h-1.5 w-1.5 rounded-full bg-[#65dcd7]" />}
          </button>
          <div className="flex items-center gap-3">
            {!isSse && !isLive && !isBusy && onStartDemo && <button type="button" onClick={onStartDemo} className="text-[11px] font-medium text-[#78d8d4] hover:text-[#a6efea]">Use local demo</button>}
            <span className="flex items-center gap-1.5 text-[11px] text-[#637a85]">
              <CircleHelp size={12} />
              {isSse ? "Fetch-based SSE with custom header support" : "Browser-based WebSocket client"}
            </span>
          </div>
        </div>

        {advancedOpen && (
          <div className="view-enter mt-5 border-t border-[#2a3942] pt-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label htmlFor={`${mode}-token`} className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#879aa4]">Auth token</label>
                <input
                  id={`${mode}-token`}
                  type="password"
                  value={token}
                  onChange={(event) => onTokenChange(event.target.value)}
                  placeholder={isSse ? "Bearer token (optional)" : "Access token (optional)"}
                  className="field-control h-10 w-full rounded-lg px-3 font-mono text-xs"
                />
              </div>
              {!isSse && (
                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                  <div>
                    <label htmlFor="auth-mode" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#879aa4]">Send token via</label>
                    <select id="auth-mode" value={authMode} onChange={(event) => onAuthModeChange?.(event.target.value as "query" | "message")} className="field-control h-10 w-full rounded-lg px-3 text-xs">
                      <option value="query">URL query</option>
                      <option value="message">First message</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="query-key" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#879aa4]">Query key</label>
                    <input id="query-key" value={queryKey} onChange={(event) => onQueryKeyChange?.(event.target.value)} disabled={authMode !== "query"} className="field-control h-10 w-full rounded-lg px-3 font-mono text-xs disabled:opacity-45" />
                  </div>
                </div>
              )}
              {isSse && (
                <div className="flex items-end pb-2 text-xs leading-relaxed text-[#8297a0]">
                  A token is sent as an Authorization: Bearer header. The server must allow CORS.
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#879aa4]">Custom headers</span>
              <button type="button" onClick={() => onHeadersChange([...headers, { id: makeId(), key: "", value: "" }])} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6cddda] hover:text-[#a0f2ed]">
                <Plus size={13} /> Add header
              </button>
            </div>
            {headers.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-[#33424b] px-3 py-3 text-xs text-[#657d87]">No custom headers added.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {headers.map((header) => (
                  <div key={header.id} className="flex gap-2">
                    <input aria-label="Header name" value={header.key} onChange={(event) => updateHeader(header.id, "key", event.target.value)} placeholder="Header name" className="field-control h-9 min-w-0 flex-1 rounded-lg px-3 font-mono text-xs" />
                    <input aria-label="Header value" value={header.value} onChange={(event) => updateHeader(header.id, "value", event.target.value)} placeholder="Value" className="field-control h-9 min-w-0 flex-1 rounded-lg px-3 font-mono text-xs" />
                    <button type="button" onClick={() => onHeadersChange(headers.filter((entry) => entry.id !== header.id))} title="Remove header" aria-label="Remove header" className="icon-button h-9 w-9"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[#81939e]">
              {isSse
                ? "Custom headers are included in fetch requests to your SSE endpoint."
                : "Browsers cannot attach custom headers to a WebSocket handshake. Use a query token, cookies, or a first-message auth flow instead."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}