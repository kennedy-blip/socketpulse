import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Info, Search, Terminal, Trash2, XCircle } from "lucide-react";
import type { ConnectionLog } from "../types";
import { downloadJson, formatTime } from "../lib/utils";

interface ConnectionLogsProps {
  logs: ConnectionLog[];
  onClear: () => void;
  notify: (message: string) => void;
}

type Filter = "all" | ConnectionLog["level"];
const filters: Filter[] = ["all", "info", "success", "warning", "error"];

const colors: Record<ConnectionLog["level"], string> = {
  info: "text-[#75cbd1] bg-[#17343b] border-[#2c5860]",
  success: "text-[#79d8aa] bg-[#17382f] border-[#2b5645]",
  warning: "text-[#ebc184] bg-[#3b3022] border-[#65513a]",
  error: "text-[#f29b9b] bg-[#3a252a] border-[#654149]",
};

function LogIcon({ level }: { level: ConnectionLog["level"] }) {
  if (level === "success") return <CheckCircle2 size={16} />;
  if (level === "warning") return <AlertTriangle size={16} />;
  if (level === "error") return <XCircle size={16} />;
  return <Info size={16} />;
}

export default function ConnectionLogs({ logs, onClear, notify }: ConnectionLogsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const visibleLogs = useMemo(() => logs.filter((log) => (filter === "all" || log.level === filter) && (!search.trim() || `${log.title} ${log.details}`.toLowerCase().includes(search.toLowerCase()))), [logs, filter, search]);

  function exportLogs() {
    downloadJson("socketpulse-connection-logs.json", logs);
    notify("Connection logs exported.");
  }

  return (
    <section className="surface-panel view-enter overflow-hidden" aria-label="Connection logs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#293741] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><Terminal size={18} /></div><div><h2 className="text-[15px] font-semibold text-[#f0f6f6]">Activity log</h2><p className="mt-0.5 text-[11px] text-[#82949e]">A record of connection and transport events.</p></div></div>
        <div className="flex gap-2"><button type="button" onClick={exportLogs} className="icon-button h-9 gap-2 px-3 text-[11px] font-medium"><Download size={14} /><span className="hidden sm:inline">Export logs</span></button><button type="button" onClick={onClear} title="Clear logs" aria-label="Clear logs" className="icon-button h-9 w-9"><Trash2 size={15} /></button></div>
      </div>

      <div className="flex flex-col gap-3 border-b border-[#293741] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="scroll-thin flex gap-1 overflow-x-auto">
          {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors ${filter === item ? "bg-[#204348] text-[#84e2dd]" : "text-[#8299a1] hover:bg-[#1e2e37] hover:text-[#e6f1f1]"}`}>{item}</button>)}
        </div>
        <div className="relative w-full sm:w-56"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#708791]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search logs..." aria-label="Search connection logs" className="field-control h-9 w-full rounded-lg pl-9 pr-3 text-xs" /></div>
      </div>

      <div className="scroll-thin min-h-[420px] max-h-[630px] overflow-y-auto">
        {visibleLogs.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-5 text-center"><Terminal size={26} strokeWidth={1.4} className="text-[#59727b]" /><p className="mt-3 text-[13px] font-medium text-[#a6b6bc]">No log entries found</p><p className="mt-1 text-xs text-[#718791]">Connection activity will appear here.</p></div>
        ) : visibleLogs.map((log) => (
          <div key={log.id} className="frame-enter flex gap-3 border-b border-[#26353e] px-5 py-4 transition-colors hover:bg-[#192831] sm:gap-4 sm:px-6">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors[log.level]}`}><LogIcon level={log.level} /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="text-[13px] font-semibold text-[#dce8e9]">{log.title}</h3><span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${colors[log.level].split(" ")[0]}`}>{log.level}</span></div><p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-[#80969f]">{log.details}</p></div>
            <span className="shrink-0 pt-1 font-mono text-[10px] text-[#6d838d]">{formatTime(log.timestamp)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-[#293741] px-5 py-3 font-mono text-[10px] text-[#69818a] sm:px-6"><span>{visibleLogs.length} of {logs.length} entries</span><span>LOCAL SESSION</span></div>
    </section>
  );
}