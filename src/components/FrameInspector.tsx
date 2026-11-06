import { useEffect, useState } from "react";
import { Braces, Check, ChevronDown, ChevronRight, Copy, FileCode2, Info, ScanSearch } from "lucide-react";
import type { Frame } from "../types";
import { formatFrameBytes, formatTime, payloadLabel } from "../lib/utils";

type InspectorTab = "tree" | "raw" | "headers";

function JsonNode({ name, value, depth = 0 }: { name: string; value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === "object";
  const entries = isObject ? Object.entries(value as Record<string, unknown>) : [];
  const isArray = Array.isArray(value);

  if (!isObject) {
    const color = typeof value === "string" ? "text-[#97ddad]" : typeof value === "number" ? "text-[#edbb87]" : typeof value === "boolean" ? "text-[#a7b8f3]" : "text-[#9cabba]";
    return (
      <div className="flex min-w-0 items-start gap-1 py-[2px] font-mono text-[11px] leading-[19px]" style={{ paddingLeft: depth * 15 }}>
        <span className="text-[#85bdc5]">{name}:</span>
        <span className={`break-all ${color}`}>{typeof value === "string" ? `"${value}"` : String(value)}</span>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-1 py-[2px] text-left font-mono text-[11px] leading-[19px] hover:text-white" style={{ paddingLeft: Math.max(0, depth * 15 - 3) }}>
        {expanded ? <ChevronDown size={12} className="shrink-0 text-[#77a2aa]" /> : <ChevronRight size={12} className="shrink-0 text-[#77a2aa]" />}
        <span className="text-[#85bdc5]">{name}:</span>
        <span className="ml-1 text-[#a7b7bd]">{isArray ? `[${entries.length} items]` : `{${entries.length} keys}`}</span>
      </button>
      {expanded && entries.map(([key, child]) => <JsonNode key={key} name={key} value={child} depth={depth + 1} />)}
      {expanded && entries.length === 0 && <div className="font-mono text-[11px] text-[#7e939d]" style={{ paddingLeft: (depth + 1) * 15 }}>{isArray ? "[]" : "{}"}</div>}
    </div>
  );
}

interface FrameInspectorProps {
  frame: Frame | null;
}

export default function FrameInspector({ frame }: FrameInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("tree");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab("tree");
    setCopied(false);
  }, [frame?.id]);

  let parsed: unknown = null;
  let isJson = false;
  if (frame) {
    try {
      parsed = JSON.parse(frame.payload);
      isJson = true;
    } catch {
      // Text and binary frames are shown without a JSON tree.
    }
  }

  async function copyPayload() {
    if (!frame) return;
    try {
      await navigator.clipboard.writeText(frame.payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="surface-panel min-w-0 overflow-hidden" aria-label="Frame inspector">
      <div className="flex items-center justify-between gap-3 border-b border-[#293741] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><ScanSearch size={18} strokeWidth={1.8} /></div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#f0f6f6]">Frame inspector</h2>
            <p className="mt-0.5 text-[11px] text-[#82949e]">A closer look at your selected frame.</p>
          </div>
        </div>
        <button type="button" onClick={copyPayload} disabled={!frame} title="Copy frame payload" aria-label="Copy frame payload" className="icon-button h-8 w-8 disabled:opacity-40">
          {copied ? <Check size={15} className="text-[#6cdaa8]" /> : <Copy size={14} />}
        </button>
      </div>

      {!frame ? (
        <div className="flex min-h-[292px] flex-col items-center justify-center px-6 text-center">
          <FileCode2 size={27} strokeWidth={1.4} className="text-[#58717a]" />
          <p className="mt-3 text-[13px] font-medium text-[#afbec3]">No frame selected</p>
          <p className="mt-1 text-xs text-[#718791]">Choose a frame from the exchange to inspect it.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${frame.direction === "sent" ? "bg-[#68d9dc]" : "bg-[#5ad19f]"}`} />
              <span className="truncate font-mono text-xs font-medium text-[#d6e7e7]">{payloadLabel(frame.payload)}</span>
            </div>
            <span className={`shrink-0 rounded px-1.5 py-1 font-mono text-[9px] uppercase ${frame.direction === "sent" ? "bg-[#15393e] text-[#70dde0]" : "bg-[#173b34] text-[#6bd4a4]"}`}>{frame.direction}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-[#293741] px-5 pb-4 sm:px-6">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6c838d]">Opcode</span>
              <p className="mt-1 font-mono text-[11px] text-[#bdcdd0]">{frame.opcode === null ? "SSE / N/A" : `0x0${frame.opcode} / ${frame.opcode === 2 ? "Binary" : "Text"}`}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6c838d]">Size</span>
              <p className="mt-1 font-mono text-[11px] text-[#bdcdd0]">{formatFrameBytes(frame)}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6c838d]">Time</span>
              <p className="mt-1 font-mono text-[11px] text-[#bdcdd0]">{formatTime(frame.timestamp)}</p>
            </div>
          </div>

          <div className="flex gap-5 border-b border-[#293741] px-5 sm:px-6" role="tablist" aria-label="Inspector views">
            {(["tree", "raw", "headers"] as InspectorTab[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`relative py-3 text-[11px] font-medium capitalize transition-colors ${tab === item ? "text-[#76e0dc]" : "text-[#8296a0] hover:text-[#d7e5e7]"}`}>
                {item === "tree" ? "JSON tree" : item}
                {tab === item && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-[#69deda]" />}
              </button>
            ))}
          </div>

          <div className="scroll-thin min-h-[190px] max-h-[270px] overflow-auto bg-[#0d161e]/75 px-5 py-4 sm:px-6">
            {tab === "tree" && (isJson ? <div className="min-w-max"><JsonNode name="payload" value={parsed} /></div> : <p className="whitespace-pre-wrap break-all font-mono text-[11px] leading-6 text-[#a5b9bf]">{frame.payload}</p>)}
            {tab === "raw" && <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-[19px] text-[#b8cbcd]">{frame.payload}</pre>}
            {tab === "headers" && (
              frame.headers && Object.keys(frame.headers).length > 0 ? (
                <div className="space-y-2.5">
                  {Object.entries(frame.headers).map(([key, value]) => <div key={key} className="flex flex-wrap gap-x-3 font-mono text-[11px]"><span className="text-[#72d7d6]">{key}</span><span className="break-all text-[#b9c9cc]">{value}</span></div>)}
                </div>
              ) : (
                <div className="flex gap-2.5 text-[11px] leading-relaxed text-[#8ba0a9]">
                  <Info size={15} className="mt-0.5 shrink-0 text-[#69bdc2]" />
                  <span>{frame.source === "sse" ? "No response headers were available for this event." : "The browser WebSocket API does not expose handshake headers or individual frame headers. Opcode and payload metadata are shown above."}</span>
                </div>
              )
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[#293741] px-5 py-3 font-mono text-[10px] text-[#6c838e] sm:px-6">
            <span>{frame.source === "demo" ? "SIMULATED FRAME" : frame.source === "sse" ? "SERVER-SENT EVENT" : "WEBSOCKET FRAME"}</span>
            <span className="inline-flex items-center gap-1"><Braces size={11} /> {isJson ? "VALID JSON" : "RAW TEXT"}</span>
          </div>
        </>
      )}
    </section>
  );
}