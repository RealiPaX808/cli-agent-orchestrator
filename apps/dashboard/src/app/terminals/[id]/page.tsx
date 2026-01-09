"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { caoClient } from "@/lib/api-client";
import { Terminal as TerminalType } from "@/types/cao";
import "@xterm/xterm/css/xterm.css";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function TerminalDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [terminal, setTerminal] = useState<TerminalType | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("Initializing...");

  const xtermRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const terminalInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    caoClient.getTerminal(id).then(setTerminal).catch(err => setDebugStatus("Fetch error: " + err));
  }, [id]);

  const terminalCallback = useCallback((element: HTMLDivElement | null) => {
    if (element === null) {
        if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
        if (wsRef.current) wsRef.current.close();
        if (xtermRef.current) xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
        terminalInitializedRef.current = false;
        return;
    }

    if (xtermRef.current || terminalInitializedRef.current) return;

      (async () => {
      try {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: { background: '#020617', foreground: '#f8fafc' },
          convertEol: true,
          scrollback: 10000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(element);
        
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        terminalInitializedRef.current = true;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              console.log('=== Before Fit ===');
              console.log('Container:', element.clientWidth, 'x', element.clientHeight);
              console.log('Terminal:', term.cols, 'x', term.rows);
              
              fitAddon.fit();
              
              console.log('=== After Fit ===');
              console.log('Terminal:', term.cols, 'x', term.rows);
              
              const core = (term as any)._core;
              if (core && core._renderService) {
                const dims = core._renderService.dimensions;
                console.log('Char size:', dims.css.cell.width, 'x', dims.css.cell.height);
                console.log('Canvas:', dims.css.canvas.width, 'x', dims.css.canvas.height);
                console.log('Expected canvas height:', term.rows * dims.css.cell.height);
              }

              setDebugStatus(`Terminal: ${term.cols}x${term.rows} (${element.clientWidth}x${element.clientHeight}px)`);
              
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'resize',
                  cols: term.cols,
                  rows: term.rows
                }));
              }
            } catch (error) {
              console.warn('Fit failed:', error);
            }
          });
        });

        // Set up WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/terminals/${id}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setDebugStatus("Connected");
          
          if (xtermRef.current && fitAddonRef.current) {
            fitAddonRef.current.fit();
            console.log('WebSocket connected - sending resize:', xtermRef.current.cols, 'x', xtermRef.current.rows);
            ws.send(JSON.stringify({
              type: 'resize',
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows
            }));
          }
        };

        ws.onmessage = (event) => {
          term.write(event.data);
        };

        ws.onclose = (ev) => {
          setDebugStatus(`Disconnected: ${ev.code}`);
          term.write("\r\n\x1b[31m--- Disconnected ---\x1b[0m\r\n");
        };

        ws.onerror = () => {
          setDebugStatus("Connection Error");
          term.write("\r\n\x1b[31m--- Connection Error ---\x1b[0m\r\n");
        };

        term.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

      } catch (err) {
        setDebugStatus("Init Error: " + String(err));
        console.error("Init error:", err);
      }
    })();
  }, [id]);

  if (!terminal) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Sessions", href: "/sessions" },
          { text: "Terminal", href: `/terminals/${id}` },
        ]}
      >
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
            <span>Loading terminal metadata...</span>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  const actions = (
    <SpaceBetween direction="horizontal" size="xs">
      <Box
        variant="small"
        color="text-body-secondary"
        padding={{ horizontal: "s", vertical: "xxs" }}
      >
        {debugStatus}
      </Box>
      <StatusIndicator
        type={
          terminal.status === 'idle' ? 'success' :
          terminal.status === 'processing' ? 'in-progress' :
          'stopped'
        }
      >
        {terminal.status}
      </StatusIndicator>
      <Button
        onClick={() => {
            xtermRef.current?.clear();
            fitAddonRef.current?.fit();
        }}
      >
        Clear
      </Button>
      <Button
        onClick={() => {
            fitAddonRef.current?.fit();
            setDebugStatus(`Terminal: ${xtermRef.current?.cols}x${xtermRef.current?.rows}`);
        }}
      >
        Force Fit
      </Button>
    </SpaceBetween>
  );

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Dashboard", href: "/" },
        { text: "Sessions", href: "/sessions" },
        { text: terminal.session_name || "Session", href: `/sessions/${terminal.session_name}` },
        { text: "Terminal", href: `/terminals/${id}` },
      ]}
      contentType="default"
    >
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '80vh'
      }}>
        <div style={{
          padding: '10px 0',
          marginBottom: '10px'
        }}>
          {actions}
        </div>
        <div 
          ref={terminalCallback}
          style={{
            flex: 1,
            minHeight: '600px',
            overflow: 'hidden',
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: '4px'
          }}
        />
      </div>
    </DashboardLayout>
  );
}
