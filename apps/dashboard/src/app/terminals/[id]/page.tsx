"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { caoClient } from "@/lib/api-client";
import { Terminal as TerminalType } from "@/types/cao";
import Link from "next/link";
import "xterm/css/xterm.css";

export default function TerminalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [terminal, setTerminal] = useState<TerminalType | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("Waiting for container...");
  
  const xtermRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    caoClient.getTerminal(id).then(setTerminal).catch(err => setDebugStatus("Fetch error: " + err));
  }, [id]);

  const terminalRef = useCallback(async (container: HTMLDivElement | null) => {
    if (container === null) {
        if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
        if (wsRef.current) wsRef.current.close();
        if (xtermRef.current) xtermRef.current.dispose();
        xtermRef.current = null;
        return;
    }

    if (xtermRef.current) return;

    try {
        setDebugStatus("Loading xterm modules...");
        const { Terminal } = await import("xterm");
        const { FitAddon } = await import("xterm-addon-fit");

        setDebugStatus("Creating terminal...");
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: { background: '#020617', foreground: '#f8fafc' },
          convertEol: true, // Handle \n as \r\n
          scrollback: 10000,
          allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        setDebugStatus("Opening terminal...");
        term.open(container);
        
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const fitAndSync = () => {
            if (!fitAddon || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            try {
                fitAddon.fit();
                const { cols, rows } = term;
                if (cols > 0 && rows > 0) {
                    wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
                }
            } catch (e) {
                console.error("Fit error:", e);
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(fitAndSync);
        });
        resizeObserver.observe(container);
        resizeObserverRef.current = resizeObserver;

        // WebSocket setup
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/terminals/${id}/ws`;
        
        setDebugStatus(`Connecting WS...`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setDebugStatus("WS Connected");
          // Initial resize sync
          setTimeout(fitAndSync, 100);
        };

        ws.onmessage = (event) => {
          // Write directly from server (single source of truth)
          term.write(event.data);
        };

        ws.onclose = (ev) => {
          setDebugStatus(`WS Closed: ${ev.code}`);
          term.write("\r\n\x1b[31m--- Disconnected ---\x1b[0m\r\n");
        };

        ws.onerror = () => {
          setDebugStatus("WS Error");
          term.write("\r\n\x1b[31m--- Connection Error ---\x1b[0m\r\n");
        };

        // Input handling - NO Local Echo
        term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

    } catch (err) {
        setDebugStatus("Init Error: " + String(err));
        console.error("Init error:", err);
    }
  }, [id]);

  if (!terminal) return <div className="p-8 text-slate-400">Loading terminal metadata...</div>;

  return (
    <main className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <header className="flex-none p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-4">
          <Link href={`/sessions/${terminal.session_name}`} className="text-slate-500 hover:text-white transition-colors">
             ← Back
          </Link>
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              {terminal.agent_profile}
              <span className="text-xs font-normal text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                {terminal.name}
              </span>
            </h1>
            <div className="text-xs text-slate-400 font-mono">{terminal.id} • {terminal.provider}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-xs text-yellow-500 font-mono bg-yellow-900/20 px-2 py-1 rounded">
             Debug: {debugStatus}
           </div>
           <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Status:</span>
              <span className={`uppercase font-bold ${ 
                terminal.status === 'idle' ? 'text-green-400' :
                terminal.status === 'processing' ? 'text-blue-400' :
                'text-slate-400'
              }`}> 
                {terminal.status}
              </span>
           </div>
           <button 
              onClick={() => {
                  xtermRef.current?.clear();
                  fitAddonRef.current?.fit();
              }}
              className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
           >
              Clear
           </button>
        </div>
      </header>

      <div className="flex-1 relative bg-[#020617] p-4 min-h-[400px]">
        <div 
          ref={terminalRef}
          className="absolute inset-4 overflow-hidden"
          style={{ visibility: 'visible' }}
        />
      </div>
    </main>
  );
}
