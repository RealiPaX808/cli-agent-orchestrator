import { Session, Terminal, TerminalOutputResponse, InboxMessage } from "../types/cao";
import { Workflow } from "../types/workflow";

const BASE_URL = "/api";

class CAOClient {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    return response.json();
  }

  // Sessions
  async listSessions(): Promise<Session[]> {
    return this.fetch<Session[]>("/sessions");
  }

  async listSessionsWithTerminals(): Promise<Array<Session & { terminals?: Terminal[] }>> {
    const sessions = await this.fetch<Session[]>("/sessions");
    const sessionsWithTerminals = await Promise.all(
      sessions.map(async (session) => {
        try {
          const data = await this.fetch<{ session: Session; terminals: Terminal[] }>(`/sessions/${session.name}`);
          return { ...data.session, terminals: data.terminals };
        } catch {
          return session;
        }
      })
    );
    return sessionsWithTerminals;
  }

  async getSession(name: string): Promise<Session> {
    const data = await this.fetch<{ session: Session; terminals: Terminal[] }>(`/sessions/${name}`);
    return { ...data.session, terminals: data.terminals };
  }

  async createSession(provider: string, agentProfile: string, sessionName?: string, workflowId?: string): Promise<Terminal> {
    const params = new URLSearchParams({
      provider,
      agent_profile: agentProfile,
    });
    if (sessionName) {
      params.append("session_name", sessionName);
    }
    if (workflowId) {
      params.append("workflow_id", workflowId);
    }
    return this.fetch<Terminal>(`/sessions?${params.toString()}`, {
      method: "POST",
    });
  }

  async deleteSession(name: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(`/sessions/${name}`, {
      method: "DELETE",
    });
  }

  async listWorkflows(): Promise<Workflow[]> {
    return this.fetch<Workflow[]>("/workflows");
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.fetch<Workflow>(`/workflows/${id}`);
  }

  async createWorkflow(workflow: Workflow): Promise<Workflow> {
    return this.fetch<Workflow>("/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(`/workflows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(`/workflows/${id}`, {
      method: "DELETE",
    });
  }

  async getSessionWorkflow(sessionName: string): Promise<Workflow> {
    return this.fetch<Workflow>(`/sessions/${sessionName}/workflow`);
  }

  // Terminals
  async listTerminals(sessionName: string): Promise<Terminal[]> {
    return this.fetch<Terminal[]>(`/sessions/${sessionName}/terminals`);
  }

  async getTerminal(id: string): Promise<Terminal> {
    return this.fetch<Terminal>(`/terminals/${id}`);
  }

  async deleteTerminal(id: string): Promise<{ success: boolean }> {
    return this.fetch<{ success: boolean }>(`/terminals/${id}`, {
      method: "DELETE",
    });
  }

  async getTerminalOutput(id: string, mode: "full" | "last" | "stream" = "full"): Promise<TerminalOutputResponse> {
    return this.fetch<TerminalOutputResponse>(`/terminals/${id}/output?mode=${mode}`);
  }

  async sendTerminalInput(id: string, message: string): Promise<{ success: boolean }> {
    const params = new URLSearchParams({ message });
    return this.fetch<{ success: boolean }>(`/terminals/${id}/input?${params.toString()}`, {
      method: "POST",
    });
  }

  // Inbox
  async getInboxMessages(terminalId: string): Promise<InboxMessage[]> {
    return this.fetch<InboxMessage[]>(`/terminals/${terminalId}/inbox/messages`);
  }

  // Agents
  async listAgents(): Promise<string[]> {
    return this.fetch<string[]>("/agents");
  }

  async getAgentContent(agentName: string): Promise<{ content: string }> {
    return this.fetch<{ content: string }>(`/agents/${agentName}/content`);
  }

  async listProviders(): Promise<Array<{ value: string; label: string }>> {
    return this.fetch<Array<{ value: string; label: string }>>("/providers");
  }

  async installAgent(request: {
    source_type: "built-in" | "file" | "url";
    name?: string;
    path?: string;
    provider: string;
  }): Promise<{ success: boolean; agent_name: string; message: string }> {
    return this.fetch<{ success: boolean; agent_name: string; message: string }>("/agents/install", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  }
}

export const caoClient = new CAOClient();
