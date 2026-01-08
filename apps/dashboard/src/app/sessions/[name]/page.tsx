"use client";

import { useEffect, useState, use } from "react";
import { caoClient } from "@/lib/api-client";
import { Session, Terminal, ProviderType } from "@/types/cao";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SessionDetail({ params }: { params: Promise<{ name: string }> }) {
  // Unwrap params using use() hook for Next.js 15+
  const { name } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create terminal state
  const [showAddTerminal, setShowAddTerminal] = useState(false);
  const [agentProfile, setAgentProfile] = useState("reviewer");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [agents, setAgents] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sessionData, terminalsData, agentsData] = await Promise.all([
        caoClient.getSession(name),
        caoClient.listTerminals(name),
        caoClient.listAgents()
      ]);
      setSession(sessionData);
      setTerminals(terminalsData);
      setAgents(agentsData);
      if (agentsData.length > 0 && !agentProfile) {
          setAgentProfile(agentsData[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [name]);

  const handleAddTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdding(true);
      // We need to implement createTerminalInSession in client or use raw fetch
      // Let's assume we'll add it to client or use a fetch here. 
      // Actually checking client... it's missing createTerminalInSession.
      // I'll do a direct fetch for now or update client. updating client is better.
      const params = new URLSearchParams({
        provider,
        agent_profile: agentProfile,
      });
      
      await fetch(`/api/sessions/${name}/terminals?${params.toString()}`, {
        method: "POST"
      });
      
      setShowAddTerminal(false);
      fetchData();
    } catch (err) {
      alert("Failed to add terminal: " + err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading session details...</div>;
  if (!session) return <div className="p-8 text-red-400">Session not found</div>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-slate-500 hover:text-sky-400 mb-6 inline-block transition-colors">
          ← Back to Dashboard
        </Link>
        
        <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{session.name}</h1>
              <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                {session.id}
              </span>
            </div>
            <p className="text-slate-400 flex items-center gap-2">
              Status: <span className="uppercase text-green-400 font-bold">{session.status}</span>
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to delete this session? All terminals will be killed.")) return;
                try {
                  await caoClient.deleteSession(session.name);
                  // Force hard navigation back to home
                  window.location.href = "/";
                } catch (e) {
                  alert("Failed to delete session: " + e);
                }
              }}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded font-medium transition-colors"
            >
              Terminate Session
            </button>
            <button
              onClick={() => setShowAddTerminal(!showAddTerminal)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-white font-medium transition-colors"
            >
              + Add Terminal
            </button>
          </div>
        </header>

        {showAddTerminal && (
          <div className="mb-8 p-6 bg-slate-900 border border-slate-700 rounded-xl">
            <h3 className="text-lg font-semibold mb-4">Add Agent to Session</h3>
            <form onSubmit={handleAddTerminal} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-1">Agent Profile</label>
                <select
                  value={agentProfile}
                  onChange={(e) => setAgentProfile(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  {Object.values(ProviderType).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-medium"
              >
                {adding ? "Adding..." : "Add Agent"}
              </button>
            </form>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4 text-slate-200">Terminals ({terminals.length})</h2>
        <div className="grid gap-4">
          {terminals.map((terminal) => (
            <Link 
              href={`/terminals/${terminal.id}`} 
              key={terminal.id}
              className="block p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-sky-500 hover:bg-slate-800/50 transition-all flex justify-between items-center group"
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-sky-400">{terminal.agent_profile || "Unknown Agent"}</h3>
                  <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {terminal.provider}
                  </span>
                </div>
                <div className="text-sm text-slate-400 font-mono flex gap-4">
                  <span>ID: {terminal.id}</span>
                  <span>Window: {terminal.name}</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="mb-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider
                    ${terminal.status === 'idle' ? 'bg-green-900/50 text-green-400 border border-green-800' : 
                      terminal.status === 'processing' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                      'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {terminal.status || 'UNKNOWN'}
                  </span>
                </div>
                <span className="text-xs text-slate-600 group-hover:text-sky-500 transition-colors">
                  Open Terminal →
                </span>
                <button
                  onClick={async (e) => {
                    e.preventDefault(); // Prevent navigation
                    if (!confirm("Kill this terminal?")) return;
                    try {
                      await caoClient.deleteTerminal(terminal.id);
                      fetchData();
                    } catch (err) {
                      alert("Failed to kill terminal: " + err);
                    }
                  }}
                  className="ml-4 text-xs text-red-900 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-950/50"
                >
                  [KILL]
                </button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}