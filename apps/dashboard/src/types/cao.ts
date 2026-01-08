export enum TerminalStatus {
  IDLE = "idle",
  PROCESSING = "processing",
  COMPLETED = "completed",
  WAITING_PERMISSION = "waiting_permission",
  WAITING_USER_ANSWER = "waiting_user_answer",
  ERROR = "error",
}

export enum ProviderType {
  Q_CLI = "q_cli",
  KIRO_CLI = "kiro_cli",
  CLAUDE_CODE = "claude_code",
  OPENCODE = "opencode",
  GEMINI_CLI = "gemini_cli",
  QWEN_CLI = "qwen_cli",
  GH_COPILOT = "gh_copilot",
}

export interface Terminal {
  id: string;
  name: string;
  provider: ProviderType;
  session_name: string;
  agent_profile?: string;
  status?: TerminalStatus;
  last_active?: string;
}

export enum SessionStatus {
  ACTIVE = "active",
  DETACHED = "detached",
  TERMINATED = "terminated",
}

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  terminals?: Terminal[]; // Sometimes included in list views or details
}

export interface TerminalOutputResponse {
  output: string;
  mode: string;
}

export interface InboxMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  status: string;
  created_at: string;
}
