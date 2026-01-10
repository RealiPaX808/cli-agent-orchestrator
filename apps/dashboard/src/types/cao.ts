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
  name?: string; // API may not always return name
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
  workflow_id?: string; // Assigned workflow ID
  execution_state?: Record<string, unknown>; // Workflow execution state
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

// Cloudscape StatusIndicator type mappings for enums
// These provide type-safe conversion from CAO enums to Cloudscape StatusIndicator types
export const TerminalStatusIndicatorType: Record<TerminalStatus, "success" | "in-progress" | "error" | "stopped" | "warning"> = {
  [TerminalStatus.IDLE]: "stopped",
  [TerminalStatus.PROCESSING]: "in-progress",
  [TerminalStatus.COMPLETED]: "success",
  [TerminalStatus.WAITING_PERMISSION]: "warning",
  [TerminalStatus.WAITING_USER_ANSWER]: "warning",
  [TerminalStatus.ERROR]: "error",
} as const;

export const SessionStatusIndicatorType: Record<SessionStatus, "success" | "stopped"> = {
  [SessionStatus.ACTIVE]: "success",
  [SessionStatus.DETACHED]: "stopped",
  [SessionStatus.TERMINATED]: "stopped",
} as const;

// Helper functions for StatusIndicator props
export function getTerminalStatusType(status: TerminalStatus | undefined): "success" | "in-progress" | "error" | "stopped" | "warning" {
  if (!status) return "stopped";
  return TerminalStatusIndicatorType[status];
}

export function getSessionStatusType(status: SessionStatus): "success" | "stopped" {
  return SessionStatusIndicatorType[status];
}
