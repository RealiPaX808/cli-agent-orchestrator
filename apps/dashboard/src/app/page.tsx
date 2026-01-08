"use client";

import { useEffect, useState } from "react";
import { caoClient } from "@/lib/api-client";
import { Session, ProviderType } from "@/types/cao";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  
  // Form state
  const [newSessionName, setNewSessionName] = useState("");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [agentProfile, setAgentProfile] = useState("developer");
  const [agents, setAgents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const router = useRouter();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const [sessionsData, agentsData] = await Promise.all([
        caoClient.listSessions(),
        caoClient.listAgents()
      ]);
      setSessions(sessionsData);
      setAgents(agentsData);
      if (agentsData.length > 0 && !agentProfile) {
          setAgentProfile(agentsData[0]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await caoClient.createSession(provider, agentProfile, newSessionName || undefined);
      setShowCreate(false);
      setNewSessionName("");
      fetchSessions();
    } catch (err) {
      alert("Failed to create session: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold text-sky-400 mb-2">CAO Control</h1>
            <p className="text-slate-400">CLI Agent Orchestrator Dashboard</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/agents/new"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sky-400 font-medium transition-colors flex items-center gap-2 border border-slate-700"
            >
              <span>⬇ Install Agent</span>
            </Link>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-md text-white font-medium transition-colors flex items-center gap-2"
            >
              <span>+ New Session</span>
            </button>
            <button
              onClick={fetchSessions}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300 font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </header>

        {showCreate && (
          <div className="mb-8 p-6 bg-slate-900 border border-slate-700 rounded-xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-white">Launch New Agent Session</h2>
            <form onSubmit={handleCreateSession} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Session Name (Optional)</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. feature-dev-01"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Agent Profile</label>
                <select
                  value={agentProfile}
                  onChange={(e) => setAgentProfile(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {Object.values(ProviderType).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 rounded text-white font-medium transition-colors"
              >
                {creating ? "Launching..." : "Launch Agent"}
              </button>
            </form>
          </div>
        )}

        {loading && <div className="text-center py-12 text-slate-500">Loading active sessions...</div>}
        
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-200 rounded mb-6">
            Error: {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
            <p className="text-slate-400 text-lg mb-4">No active sessions running.</p>
            <button 
              onClick={() => setShowCreate(true)}
              className="text-sky-400 hover:text-sky-300 underline"
            >
              Launch your first agent
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link 
              href={`/sessions/${session.name}`} 
              key={session.id}
              className="group block p-6 bg-slate-900 border border-slate-800 rounded-xl hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${session.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`}></span>
                  <span className="text-slate-400 text-sm uppercase tracking-wider font-semibold">{session.status}</span>
                </div>
                <span className="text-xs text-slate-600 font-mono">{session.id}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 group-hover:text-sky-400 transition-colors mb-2">{session.name}</h2>
              <div className="text-sm text-slate-500">
                {session.terminals ? `${session.terminals.length} terminals` : 'Click to view details'}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
