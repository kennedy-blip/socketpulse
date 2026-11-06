import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Inbox,
  Pause,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import type { ConnectionState, Frame, FrameDirection } from "../types";
import { formatFrameBytes, formatTime, framePreview, payloadLabel } from "../lib/utils";

interface FrameStreamProps {
  frames: Frame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  status: ConnectionState;
}

export default function FrameStream({ frames, selectedId, onSelect, onClear, status }: FrameStreamProps) {
  const [search, setSearch] = useState("");
  const [pausedFrames, setPausedFrames] = useState<Frame[] | null>(null);
  const visibleFrames = pausedFrames ?? frames;
  const query = search.trim().toLowerCase();
  const filteredFrames = useMemo(
    () => visibleFrames.filter((frame) => !query || `${frame.payload} ${payloadLabel(frame.payload)} ${frame.direction}`.toLowerCase().includes(query)),
    [visibleFrames, query],
  );
  const waitingCount = pausedFrames ? frames.filter((frame) => !pausedFrames.some((paused) => paused.id === frame.id)).length : 0;
  const isLive = status === "demo" || status === "connected";

  function clearFrames() {
    setPausedFrames(null);
    onClear();
  }

  function renderColumn(direction: FrameDirection) {
    const outgoing = direction === "sent";
    const items = filteredFrames.filter((frame) => frame.direction === direction);
    return (
      <div className="min-w-0">
        <div className="flex h-[48px] items-center justify-between border-b border-[#293741] bg-[#15212a]/65 px-4 sm:px-5">
          <div className="flex items-center gap-2">
            {outgoing ? <ArrowUpRight size={15} className="text-[#70dcdf]" /> : <ArrowDownLeft size={15} className="text-[#62d6a4]" />}
            <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.15em] ${outgoing ? "text-[#75dfe2]" : "text-[#6ddbab]"}`}>
              {outgoing ? "Outgoing" : "Incoming"}
            </span>
          </div>
          <span className="rounded-md border border-[#31414a] bg-[#182630] px-2 py-0.5 font-mono text-[10px] text-[#91a6ae]">{items.length.toString().padStart(2, "0")}</span>
        </div>
        <div className="scroll-thin h-[385px] overflow-y-auto bg-[#101921]/40 lg:h-[425px]">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[195px] flex-col items-center justify-center px-5 text-center">
              <Inbox size={23} strokeWidth={1.4} className="text-[#55717c]" />
              <p className="mt-3 text-[13px] font-medium text-[#93a6af]">No {outgoing ? "outgoing" : "incoming"} frames</p>
              <p className="mt-1 text-[11px] text-[#5e7580]">{query ? "Try another search term." : outgoing ? "Send a payload to see it here." : "Waiting for messages."}</p>
            </div>
          ) : (
            items.map((frame) => {
              const active = selectedId === frame.id;
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => onSelect(frame.id)}
                  className={`frame-enter relative block w-full border-b border-[#25333d] px-4 py-3.5 text-left transition-colors hover:bg-[#1a2a33] sm:px-5 ${active ? "bg-[#1a3037] hover:bg-[#1d353d]" : ""}`}
                >
                  {active && <span className={`absolute bottom-0 left-0 top-0 w-[2px] ${outgoing ? "bg-[#68d9dc]" : "bg-[#5ad19f]"}`} />}
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 rounded-[5px] px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.04em] ${outgoing ? "bg-[#15393e] text-[#70dde0]" : "bg-[#173b34] text-[#6bd4a4]"}`}>
                        {outgoing ? "Sent" : "Received"}
                      </span>
                      <span className="truncate font-mono text-[11px] font-medium text-[#c9d7d9]">{payloadLabel(frame.payload)}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-[#6d838d]">{formatTime(frame.timestamp)}</span>
                  </div>
                  <p className="mt-2.5 truncate font-mono text-[11px] leading-relaxed text-[#93a8af]">{framePreview(frame)}</p>
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-[#607782]">
                    <span>{frame.opcode === 2 ? "BINARY" : frame.source === "sse" ? "EVENT" : "TEXT"}</span>
                    <span className="text-[#435963]">/</span>
                    <span>{formatFrameBytes(frame)}</span>
                    {frame.source === "demo" && <span className="ml-auto text-[#5e8587]">DEMO</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="surface-panel min-w-0 overflow-hidden" aria-label="Live frame exchange">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]">
            <ArrowLeftRight size={18} strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#f0f6f6]">Live frame exchange</h2>
            <p className="mt-0.5 text-[11px] text-[#82949e]">Every message, in both directions.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${pausedFrames ? "text-[#e8bd7a]" : isLive ? "text-[#6dd5a3]" : "text-[#788d96]"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pausedFrames ? "bg-[#e8bd7a]" : isLive ? "status-live bg-[#5ed39f]" : "bg-[#758992]"}`} />
          {pausedFrames ? `${waitingCount > 0 ? `${waitingCount} new / ` : ""}Paused` : isLive ? "Live feed" : "Feed idle"}
        </span>
      </div>

      <div className="flex items-center gap-2 border-y border-[#293741] px-4 py-2.5 sm:px-5">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#708791]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter frames by event or payload..."
            aria-label="Filter frames"
            className="field-control h-9 w-full rounded-lg pl-9 pr-3 text-xs"
          />
        </div>
        <button type="button" onClick={() => setPausedFrames(pausedFrames ? null : [...frames])} title={pausedFrames ? "Resume feed" : "Pause feed"} aria-label={pausedFrames ? "Resume feed" : "Pause feed"} className="icon-button h-9 w-9">
          {pausedFrames ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
        </button>
        <button type="button" onClick={clearFrames} title="Clear frames" aria-label="Clear frames" className="icon-button h-9 w-9"><Trash2 size={15} /></button>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#293741] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {renderColumn("sent")}
        {renderColumn("received")}
      </div>
      <div className="flex items-center justify-between border-t border-[#293741] px-5 py-3 font-mono text-[10px] text-[#69818a] sm:px-6">
        <span>{frames.length} total frames</span>
        <span>CLICK A FRAME TO INSPECT <ArrowUpRight size={11} className="ml-1 inline" /></span>
      </div>
    </section>
  );
}