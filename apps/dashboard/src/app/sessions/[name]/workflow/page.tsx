"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { caoClient } from "@/lib/api-client";
import { Session, Terminal, TerminalStatus, getTerminalStatusType } from "@/types/cao";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import SplitPanel from "@cloudscape-design/components/split-panel";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import { WorkflowStorage } from "@/lib/workflow-storage";
import { Workflow } from "@/types/workflow";
import SegmentedControl from "@cloudscape-design/components/segmented-control";

type ViewMode = 'workflow' | 'list';

export default function SessionWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const sessionName = params.name as string;

  const [session, setSession] = useState<Session & { terminals?: Terminal[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('workflow');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionName) return;
    try {
      setLoading(true);
      const sessionData = await caoClient.getSession(sessionName);
      setSession(sessionData);
      
      const workflowId = `session-${sessionName}`;
      let sessionWorkflow = await WorkflowStorage.getWorkflow(workflowId);
      
      if (!sessionWorkflow) {
        sessionWorkflow = {
          id: workflowId,
          name: `Workflow for ${sessionName}`,
          description: `Agent workflow for session ${sessionName}`,
          nodes: [],
          edges: [],
          config: {
            errorHandling: 'stop',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await WorkflowStorage.saveWorkflow(sessionWorkflow);
      }
      
      setWorkflow(sessionWorkflow);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionName]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Auto-refresh for active terminals
  useEffect(() => {
    if (!autoRefresh) return;

    const hasProcessingTerminals = session?.terminals?.some(
      t => t.status === TerminalStatus.PROCESSING
    );

    if (!hasProcessingTerminals) return;

    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [session, autoRefresh, fetchSession]);

  const handleTerminalClick = useCallback((terminal: Terminal) => {
    setSelectedTerminal(terminal);
  }, []);

  const handleTerminalNavigate = useCallback((terminal: Terminal) => {
    router.push(`/terminals/${terminal.id}`);
  }, [router]);

  const getStatusSummary = () => {
    if (!session?.terminals) return null;
    const terminals = session.terminals;
    return {
      total: terminals.length,
      idle: terminals.filter(t => t.status === TerminalStatus.IDLE).length,
      processing: terminals.filter(t => t.status === TerminalStatus.PROCESSING).length,
      completed: terminals.filter(t => t.status === TerminalStatus.COMPLETED).length,
      error: terminals.filter(t => t.status === TerminalStatus.ERROR).length,
      waiting: terminals.filter(t =>
        t.status === TerminalStatus.WAITING_PERMISSION ||
        t.status === TerminalStatus.WAITING_USER_ANSWER
      ).length,
    };
  };

  const contentHeader = (
    <Header
      variant="h1"
      description="Agent workflow editor and configuration"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            onClick={fetchSession}
            iconName="refresh"
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            iconName={autoRefresh ? 'close' : 'play'}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-Refresh
          </Button>
          <Button
            href={`/sessions/${sessionName}`}
            iconName="arrow-left"
          >
            Back to Session
          </Button>
        </SpaceBetween>
      }
    >
      Workflow: {sessionName}
    </Header>
  );

  if (loading && !session) {
    return (
      <DashboardLayout contentHeader={contentHeader} breadcrumbs={[
        { text: 'Dashboard', href: '/' },
        { text: 'Sessions', href: '/sessions' },
        { text: sessionName, href: `/sessions/${sessionName}` },
        { text: 'Workflow', href: `/sessions/${sessionName}/workflow` },
      ]}>
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
            <Spinner size="large" />
            <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
              Loading agent workflow...
            </Box>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  const summary = getStatusSummary();

  // Main content
  const mainContent = (
    <SpaceBetween direction="vertical" size="l">
      {error && (
        <Alert type="error" header="Error">{error}</Alert>
      )}

      {session && (
        <>
          {/* Status Summary */}
          <Container header={<Header variant="h2">Workflow Status</Header>}>
            <SpaceBetween direction="vertical" size="s">
              <SpaceBetween direction="horizontal" size="xl">
                <Box>
                  <Box variant="p" color="text-body-secondary">
                    Total Terminals
                  </Box>
                  <Box variant="h1">{summary?.total ?? 0}</Box>
                </Box>
                <Box>
                  <Box variant="p" color="text-body-secondary">
                    Active
                  </Box>
                  <Box variant="h1" color="text-status-info">
                    {summary?.processing ?? 0}
                  </Box>
                </Box>
                <Box>
                  <Box variant="p" color="text-body-secondary">
                    Idle
                  </Box>
                  <Box variant="h1" color="text-status-inactive">
                    {summary?.idle ?? 0}
                  </Box>
                </Box>
                <Box>
                  <Box variant="p" color="text-body-secondary">
                    Completed
                  </Box>
                  <Box variant="h1" color="text-status-success">
                    {summary?.completed ?? 0}
                  </Box>
                </Box>
                {(summary?.error ?? 0) > 0 && (
                  <Box>
                    <Box variant="p" color="text-body-secondary">Errors</Box>
                    <Box variant="h1" color="text-status-error">
                      {summary?.error ?? 0}
                    </Box>
                  </Box>
                )}
                {(summary?.waiting ?? 0) > 0 && (
                  <Box>
                    <Box variant="p" color="text-body-secondary">Waiting</Box>
                    <Box variant="h1" color="text-status-warning">
                      {summary?.waiting ?? 0}
                    </Box>
                  </Box>
                )}
              </SpaceBetween>

              <SegmentedControl
                selectedId={viewMode}
                onChange={({ detail }) => setViewMode(detail.selectedId as ViewMode)}
                label="View mode"
                options={[
                  { id: 'workflow', text: 'Workflow Editor' },
                  { id: 'list', text: 'List View' },
                ]}
              />
            </SpaceBetween>
          </Container>

          {viewMode === 'workflow' && workflow && (
            <Container header={<Header variant="h2">Workflow Editor</Header>}>
              <div style={{ height: "600px", borderRadius: "8px", overflow: "hidden" }}>
                <WorkflowEditor workflowId={workflow.id} />
              </div>
              <Box padding={{ top: "s" }} color="text-body-secondary" fontSize="body-s">
                Design and configure your agent workflow. Add nodes, connect them, and execute the workflow.
              </Box>
            </Container>
          )}

          {viewMode === 'list' && (
            <Container header={<Header variant="h2">Terminals</Header>}>
              <SpaceBetween direction="vertical" size="s">
                {session.terminals?.map((terminal) => (
                  <Button
                    key={terminal.id}
                    onClick={() => handleTerminalClick(terminal)}
                    variant="normal"
                    fullWidth
                  >
                    <SpaceBetween direction="horizontal" size="s">
                      <Box>
                        <Box fontWeight="bold">{terminal.name}</Box>
                        <Box variant="p" color="text-body-secondary" fontSize="body-s">
                          Provider: {terminal.provider}
                          {terminal.agent_profile && ` • Agent: ${terminal.agent_profile}`}
                        </Box>
                      </Box>
                      <StatusIndicator type={getTerminalStatusType(terminal.status)}>
                        {terminal.status}
                      </StatusIndicator>
                    </SpaceBetween>
                  </Button>
                )) || (
                  <Box color="text-body-secondary" textAlign="center">
                    No terminals in this session
                  </Box>
                )}
              </SpaceBetween>
            </Container>
          )}
        </>
      )}
    </SpaceBetween>
  );

  // Split panel content for terminal details
  const splitPanelContent = selectedTerminal && (
    <SpaceBetween direction="vertical" size="l">
      <Header
        variant="h3"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              onClick={() => handleTerminalNavigate(selectedTerminal)}
              variant="primary"
              iconName="angle-right"
            >
              Open Terminal
            </Button>
            <Button
              iconName="close"
              onClick={() => setSelectedTerminal(null)}
            >
              Close
            </Button>
          </SpaceBetween>
        }
      >
        {selectedTerminal.name || selectedTerminal.id}
      </Header>

      <Container header={<Header>Terminal Details</Header>}>
        <SpaceBetween direction="vertical" size="s">
          <Box>
            <Box variant="p" color="text-body-secondary">Terminal ID</Box>
            <Box>{selectedTerminal.id}</Box>
          </Box>
          <Box>
            <Box variant="p" color="text-body-secondary">Provider</Box>
            <Box>{selectedTerminal.provider}</Box>
          </Box>
          {selectedTerminal.agent_profile && (
            <Box>
              <Box variant="p" color="text-body-secondary">Agent Profile</Box>
              <Box>{selectedTerminal.agent_profile}</Box>
            </Box>
          )}
          <Box>
            <Box variant="p" color="text-body-secondary">Status</Box>
            <StatusIndicator type={getTerminalStatusType(selectedTerminal.status)}>
              {selectedTerminal.status}
            </StatusIndicator>
          </Box>
          {selectedTerminal.last_active && (
            <Box>
              <Box variant="p" color="text-body-secondary">Last Active</Box>
              <Box>{selectedTerminal.last_active}</Box>
            </Box>
          )}
        </SpaceBetween>
      </Container>

      <Container header={<Header>Session Info</Header>}>
        <SpaceBetween direction="vertical" size="s">
          <Box>
            <Box variant="p" color="text-body-secondary">Session Name</Box>
            <Box>{sessionName}</Box>
          </Box>
          <Box>
            <Box variant="p" color="text-body-secondary">Session ID</Box>
            <Box>{session?.id}</Box>
          </Box>
        </SpaceBetween>
      </Container>

      <Alert type="info">
        Click "Open Terminal" to view the full terminal output and interact with the CLI agent.
      </Alert>
    </SpaceBetween>
  );

  return (
      <DashboardLayout contentHeader={contentHeader} breadcrumbs={[
        { text: 'Dashboard', href: '/' },
        { text: 'Sessions', href: '/sessions' },
        { text: sessionName, href: `/sessions/${sessionName}` },
        { text: 'Workflow', href: `/sessions/${sessionName}/workflow` },
      ]}>
      <SplitPanel
        header="Terminal details"
        i18nStrings={{
          preferencesTitle: 'Split panel preferences',
          preferencesPositionLabel: 'Split panel position',
          preferencesPositionDescription: 'Choose the default split panel position for the service.',
          preferencesPositionSide: 'Side',
          preferencesPositionBottom: 'Bottom',
          preferencesConfirm: 'Confirm',
          preferencesCancel: 'Cancel',
          closeButtonAriaLabel: 'Close panel',
          openButtonAriaLabel: 'Open panel',
          resizeHandleAriaLabel: 'Resize split panel',
        }}
      >
        {mainContent}
        {splitPanelContent}
      </SplitPanel>
    </DashboardLayout>
  );
}
