import { useMemo, useState } from "react";
import { ArrowRight, Braces, Check, Copy, RotateCcw, Settings2 } from "lucide-react";
import { byteSize } from "../lib/utils";

interface PayloadBuilderProps {
  onUsePayload: (payload: string) => void;
  notify: (message: string) => void;
}

const initialData = '{\n  "symbols": ["BTC-USD", "ETH-USD"],\n  "snapshot": true\n}';

export default function PayloadBuilder({ onUsePayload, notify }: PayloadBuilderProps) {
  const [action, setAction] = useState("subscribe");
  const [channel, setChannel] = useState("market.ticker");
  const [data, setData] = useState(initialData);
  const [includeId, setIncludeId] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(false);
  const [requestId, setRequestId] = useState("req_8f21c4");

  const result = useMemo(() => {
    try {
      const parsed: unknown = data.trim() ? JSON.parse(data) : {};
      const payload: Record<string, unknown> = {};
      if (action.trim()) payload.type = action.trim();
      if (channel.trim()) payload.channel = channel.trim();
      payload.data = parsed;
      if (includeId) payload.request_id = requestId;
      if (includeTimestamp) payload.timestamp = new Date().toISOString();
      return { json: JSON.stringify(payload, null, 2), error: null };
    } catch (error) {
      return { json: "", error: error instanceof Error ? error.message : "Invalid JSON in data field" };
    }
  }, [action, channel, data, includeId, includeTimestamp, requestId]);

  function reset() {
    setAction("subscribe");
    setChannel("market.ticker");
    setData(initialData);
    setIncludeId(true);
    setIncludeTimestamp(false);
    setRequestId("req_8f21c4");
    notify("Builder reset to defaults.");
  }

  async function copy() {
    if (!result.json) return;
    try {
      await navigator.clipboard.writeText(result.json);
      notify("Payload copied to clipboard.");
    } catch {
      notify("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="view-enter grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="surface-panel overflow-hidden" aria-label="Payload builder fields">
        <div className="flex items-center justify-between border-b border-[#293741] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><Settings2 size={18} /></div><div><h2 className="text-[15px] font-semibold text-[#f0f6f6]">Configure payload</h2><p className="mt-0.5 text-[11px] text-[#82949e]">Shape the event your application expects.</p></div></div>
          <button type="button" onClick={reset} title="Reset builder" aria-label="Reset builder" className="icon-button h-8 w-8"><RotateCcw size={14} /></button>
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="builder-action" className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Event / action</label><input id="builder-action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="subscribe" className="field-control h-11 w-full rounded-lg px-3.5 font-mono text-xs" /></div>
            <div><label htmlFor="builder-channel" className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Channel / topic</label><input id="builder-channel" value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="market.ticker" className="field-control h-11 w-full rounded-lg px-3.5 font-mono text-xs" /></div>
          </div>
          <div><div className="mb-2 flex items-center justify-between"><label htmlFor="builder-data" className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Data object</label><span className="font-mono text-[10px] text-[#63818b]">JSON</span></div><textarea id="builder-data" spellCheck={false} value={data} onChange={(event) => setData(event.target.value)} className="field-control scroll-thin min-h-[218px] w-full resize-y rounded-lg px-4 py-3 font-mono text-[12px] leading-6 text-[#b7e4d0]" /></div>
          <div className="border-t border-[#2a3942] pt-5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Include metadata</span>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#b8c8cb]"><input type="checkbox" checked={includeId} onChange={(event) => setIncludeId(event.target.checked)} className="h-4 w-4 accent-[#6bdbd7]" />Request ID</label>
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#b8c8cb]"><input type="checkbox" checked={includeTimestamp} onChange={(event) => setIncludeTimestamp(event.target.checked)} className="h-4 w-4 accent-[#6bdbd7]" />ISO timestamp</label>
            </div>
            {includeId && <input aria-label="Request ID" value={requestId} onChange={(event) => setRequestId(event.target.value)} className="field-control mt-3 h-10 w-full rounded-lg px-3 font-mono text-xs" />}
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden" aria-label="Generated payload preview">
        <div className="flex items-center justify-between border-b border-[#293741] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><Braces size={18} /></div><div><h2 className="text-[15px] font-semibold text-[#f0f6f6]">Live preview</h2><p className="mt-0.5 text-[11px] text-[#82949e]">Your ready-to-send JSON frame.</p></div></div>
          <span className="rounded-md border border-[#315058] bg-[#173139] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7bdad8]">JSON</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-[#2b3a44] bg-[#14222b] px-4 py-2.5 font-mono text-[10px] text-[#89a0a7]"><span>payload.json</span><span className="inline-flex items-center gap-1.5 text-[#6fd6a5]"><span className="h-1.5 w-1.5 rounded-full bg-[#6fd6a5]" />{result.error ? "INVALID" : "READY"}</span></div>
          <div className="scroll-thin min-h-[369px] overflow-auto rounded-b-lg border border-[#2b3a44] bg-[#0b141b] p-5">
            {result.error ? <div className="font-mono text-xs leading-6 text-[#ec9d85]">Syntax error in data object:<br />{result.error}</div> : <pre className="font-mono text-[12px] leading-[24px] text-[#a9d7be]">{result.json}</pre>}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-[11px]"><span className={`inline-flex items-center gap-1.5 ${result.error ? "text-[#ec9d85]" : "text-[#71d5a5]"}`}>{result.error ? <span className="h-1.5 w-1.5 rounded-full bg-[#ec9d85]" /> : <Check size={13} />}{result.error ? "Fix JSON to continue" : "Valid JSON payload"}</span><span className="font-mono text-[#728792]">{byteSize(result.json)} bytes</span></div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={copy} disabled={!!result.error} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#34454e] bg-[#1b2a33] px-5 text-xs font-semibold text-[#c0d1d2] transition-colors hover:border-[#5a8588] hover:text-white disabled:opacity-40 sm:flex-1"><Copy size={15} />Copy JSON</button><button type="button" onClick={() => onUsePayload(result.json)} disabled={!!result.error} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#67dbd6] px-5 text-xs font-bold text-[#092024] transition-colors hover:bg-[#89e9e3] disabled:opacity-40 sm:flex-1">Use in sender <ArrowRight size={15} /></button></div>
        </div>
      </section>
    </div>
  );
}