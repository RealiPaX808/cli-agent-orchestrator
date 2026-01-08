"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProviderType } from "@/types/cao";

export default function NewAgentPage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"built-in" | "file" | "url">("built-in");
  const [agentName, setAgentName] = useState("");
  const [pathOrUrl, setPathOrUrl] = useState("");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstalling(true);
    setResult(null);

    try {
      // Since the backend doesn't have an HTTP endpoint for "cao install" yet, 
      // we would technically need one. 
      // However, for this prototype, we'll simulate the installation or 
      // show a message that this feature requires the CLI for now unless we add the endpoint.
      // 
      // Wait, the prompt asked to "add the function how to create new agents".
      // Let's assume we might need to add an endpoint to the backend or use a shell command via an endpoint.
      //
      // Given I cannot easily modify the backend to add a new "install" endpoint without 
      // writing python code and restarting the server (which I can do, but might be out of scope if I only focus on frontend),
      // I will implement the frontend UI and mock the call or try to use a "run_shell_command" equivalent if available via API (it isn't).
      //
      // UPDATE: I will add a proper endpoint to the backend for installing agents in the next step.
      // For now, let's implement the UI that calls this future endpoint.
      
      const response = await fetch("/api/agents/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          name: agentName, // for built-in or overrides
          path: pathOrUrl,
          provider: provider
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Installation failed");
      }

      setResult({ success: true, message: `Successfully installed agent!` });
      // Reset form after delay?
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-slate-500 hover:text-sky-400 mb-6 inline-block transition-colors">
          ← Back to Dashboard
        </Link>
        
        <header className="mb-8 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Install New Agent</h1>
          <p className="text-slate-400">Add new agent profiles to your local store.</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleInstall} className="space-y-6">
            
            {/* Source Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Installation Source</label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setSourceType("built-in")}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    sourceType === "built-in"
                      ? "bg-sky-900/40 border-sky-500 text-sky-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80"
                  }`}
                >
                  Built-in
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("file")}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    sourceType === "file"
                      ? "bg-sky-900/40 border-sky-500 text-sky-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80"
                  }`}
                >
                  Local File
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("url")}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    sourceType === "url"
                      ? "bg-sky-900/40 border-sky-500 text-sky-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-800/80"
                  }`}
                >
                  From URL
                </button>
              </div>
            </div>

            {/* Dynamic Fields based on source */}
            {sourceType === "built-in" && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Agent Name</label>
                <select
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="">Select an agent...</option>
                  <option value="code_supervisor">Code Supervisor</option>
                  <option value="developer">Developer</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>
            )}

            {sourceType === "file" && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">File Path</label>
                <input
                  type="text"
                  value={pathOrUrl}
                  onChange={(e) => setPathOrUrl(e.target.value)}
                  placeholder="/absolute/path/to/agent.md"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            )}

            {sourceType === "url" && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">URL</label>
                <input
                  type="text"
                  value={pathOrUrl}
                  onChange={(e) => setPathOrUrl(e.target.value)}
                  placeholder="https://example.com/agents/custom-agent.md"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            )}

            {/* Provider Selection */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Default Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {Object.values(ProviderType).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                The provider to use when running this agent (unless overridden).
              </p>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={installing || (sourceType === 'built-in' && !agentName) || (sourceType !== 'built-in' && !pathOrUrl)}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-white font-bold transition-colors shadow-lg shadow-green-900/20"
              >
                {installing ? "Installing..." : "Install Agent"}
              </button>
            </div>

            {/* Result Message */}
            {result && (
              <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-900/20 border-green-500/50 text-green-200' : 'bg-red-900/20 border-red-500/50 text-red-200'}`}>
                {result.message}
              </div>
            )}

          </form>
        </div>
      </div>
    </main>
  );
}
