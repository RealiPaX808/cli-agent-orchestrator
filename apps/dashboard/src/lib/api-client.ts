import { Session, Terminal, TerminalOutputResponse, InboxMessage } from "../types/cao";

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

  async getSession(name: string): Promise<Session> {
    const data = await this.fetch<{ session: Session; terminals: Terminal[] }>(`/sessions/${name}`);
    return { ...data.session, terminals: data.terminals };
  }

  async createSession(provider: string, agentProfile: string, sessionName?: string): Promise<Terminal> {
    const params = new URLSearchParams({
      provider,
      agent_profile: agentProfile,
    });
    if (sessionName) {
      params.append("session_name", sessionName);
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
}

export const caoClient = new CAOClient();
