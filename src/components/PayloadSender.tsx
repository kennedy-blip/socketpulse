import { useMemo, useRef } from "react";
import { Braces, Check, Code2, Send, Sparkles } from "lucide-react";
import { byteSize } from "../lib/utils";
import { createTemplate, templateNames } from "../types";

interface PayloadSenderProps {
  payload: string;
  onPayloadChange: (value: string) => void;
  onSend: (value: string) => void;
  canSend: boolean;
}

export default function PayloadSender({ payload, onPayloadChange, onSend, canSend }: PayloadSenderProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const validation = useMemo(() => {
    if (!payload.trim()) return "Enter a JSON payload to send.";
    try {
      JSON.parse(payload);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON syntax";
    }
  }, [payload]);
  const lineCount = Math.max(8, payload.split("\n").length);

  function send() {
    if (validation || !canSend) return;
    onSend(JSON.stringify(JSON.parse(payload)));
  }

  function prettify() {
    if (validation) return;
    onPayloadChange(JSON.stringify(JSON.parse(payload), null, 2));
  }

  return (
    <section className="surface-panel min-w-0 overflow-hidden" aria-label="Payload sender">
      <div className="flex items-center justify-between gap-3 border-b border-[#293741] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#31444d] bg-[#1a2c33] text-[#72d8d8]"><Code2 size={18} strokeWidth={1.8} /></div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#f0f6f6]">Payload sender</h2>
            <p className="mt-0.5 text-[11px] text-[#82949e]">Craft and send a JSON frame.</p>
          </div>
        </div>
        <span className="rounded-md border border-[#315058] bg-[#173139] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#7bdad8]">JSON</span>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Quick templates</span>
          <Sparkles size={13} className="text-[#67959c]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {templateNames.map((name) => (
            <button key={name} type="button" onClick={() => onPayloadChange(createTemplate(name))} className="rounded-[7px] border border-[#30414b] bg-[#192731] px-3 py-2 text-left font-mono text-[10px] text-[#a8c0c4] transition-colors hover:border-[#50898e] hover:bg-[#1c3339] hover:text-[#88e3df]">
              <span className="mr-1.5 text-[#5ca4a9]">/</span>{name}
            </button>
          ))}
        </div>

        <div className="mb-2 mt-5 flex items-center justify-between">
          <label htmlFor="payload-editor" className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8298a2]">Message body</label>
          <button type="button" onClick={prettify} disabled={!!validation} className="inline-flex items-center gap-1.5 text-[11px] text-[#83bdc0] transition-colors hover:text-[#92e6e3] disabled:cursor-not-allowed disabled:opacity-40"><Braces size={13} /> Format</button>
        </div>
        <div className="flex overflow-hidden rounded-[9px] border border-[#2e3d46] bg-[#0b141b] focus-within:border-[#54c9c9] focus-within:shadow-[0_0_0_3px_rgba(82,211,212,0.09)]">
          <div ref={gutterRef} aria-hidden="true" className="scroll-thin min-h-[185px] w-9 shrink-0 overflow-hidden border-r border-[#21303a] bg-[#0f1b23] py-3 pr-2 text-right font-mono text-[10px] leading-[21px] text-[#526a75]">
            {Array.from({ length: lineCount }, (_, index) => <div key={index}>{index + 1}</div>)}
          </div>
          <textarea
            id="payload-editor"
            spellCheck={false}
            value={payload}
            onChange={(event) => onPayloadChange(event.target.value)}
            onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
            onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); send(); } }}
            className="scroll-thin min-h-[185px] w-full resize-y bg-transparent px-3 py-3 font-mono text-[11px] leading-[21px] text-[#b9e3d1] outline-none placeholder:text-[#566f78]"
            aria-label="JSON message body"
          />
        </div>

        <div className="mt-2.5 flex min-h-5 items-start justify-between gap-2 text-[10px]">
          <span className={`inline-flex min-w-0 items-start gap-1.5 ${validation ? "text-[#ec9d85]" : "text-[#70d3a1]"}`}>
            {validation ? <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ee9a83]" /> : <Check size={12} className="shrink-0" />}
            <span className="truncate">{validation ?? "Valid JSON"}</span>
          </span>
          <span className="shrink-0 font-mono text-[#6d838d]">{byteSize(payload)} bytes</span>
        </div>

        <button type="button" onClick={send} disabled={!!validation || !canSend} className="mt-4 flex h-[43px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#67dbd6] text-[12px] font-bold text-[#092024] shadow-[0_5px_17px_rgba(76,207,204,0.14)] transition-all hover:-translate-y-0.5 hover:bg-[#89e9e3] disabled:translate-y-0 disabled:bg-[#2a4448] disabled:text-[#7b999d] disabled:shadow-none">
          <Send size={15} /> Send frame
          <span className="ml-auto hidden font-mono text-[10px] font-normal opacity-65 sm:inline">CTRL + ENTER</span>
        </button>
        {!canSend && <p className="mt-2.5 text-center text-[11px] text-[#82959e]">Connect a socket to send messages.</p>}
      </div>
    </section>
  );
}