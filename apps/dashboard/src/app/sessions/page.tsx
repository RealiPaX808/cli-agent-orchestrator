"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { caoClient } from "@/lib/api-client";
import { Session, ProviderType, getSessionStatusType, SessionStatus, Terminal } from "@/types/cao";
import { WorkflowStorage } from "@/lib/workflow-storage";
import Link from "next/link";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Textfilter from "@cloudscape-design/components/text-filter";
import Pagination from "@cloudscape-design/components/pagination";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChainOverviewCard } from "@/components/chain";

type FilterStatus = "all" | "active" | "detached" | "terminated";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsWithTerminals, setSessionsWithTerminals] = useState<Array<Session & { terminals?: Terminal[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filtering and pagination state
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const pageSize = 10;

  const [newSessionName, setNewSessionName] = useState("");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [agentProfile, setAgentProfile] = useState("developer");
  const [agents, setAgents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [workflows, setWorkflows] = useState<Array<{id: string, name: string}>>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSessions = useCallback(async () => {
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

      const availableWorkflows = await WorkflowStorage.getWorkflows();
      setWorkflows(availableWorkflows.map(w => ({ id: w.id, name: w.name })));

      if (sessionsData.length > 0) {
        const withTerminals = await caoClient.listSessionsWithTerminals();
        setSessionsWithTerminals(withTerminals);
      } else {
        setSessionsWithTerminals([]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [agentProfile]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateSession = async () => {
    try {
      setCreating(true);
      if (selectedWorkflowId) {
        await caoClient.createSession(
          "workflow",
          "workflow",
          newSessionName || undefined,
          selectedWorkflowId
        );
      } else {
        await caoClient.createSession(
          provider, 
          agentProfile, 
          newSessionName || undefined,
          undefined
        );
      }
      setShowCreate(false);
      setNewSessionName("");
      setSelectedWorkflowId("");
      fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionName: string) => {
    try {
      setDeleting(true);
      await caoClient.deleteSession(sessionName);
      setSessionToDelete(null);
      fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesText =
        filterText === "" ||
        session.name.toLowerCase().includes(filterText.toLowerCase()) ||
        session.id.toLowerCase().includes(filterText.toLowerCase());

      const matchesStatus =
        filterStatus === "all" || session.status === filterStatus;

      return matchesText && matchesStatus;
    });
  }, [sessions, filterText, filterStatus]);

  // Paginated sessions
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * pageSize;
    return filteredSessions.slice(startIndex, startIndex + pageSize);
  }, [filteredSessions, currentPageIndex]);

  const contentHeader = (
    <Header
      variant="h1"
      description="View and manage all CLI agent sessions"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            href="/settings/agents"
            iconName="download"
          >
            Install Agent
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCreate(true)}
            iconName="add-plus"
          >
            New Session
          </Button>
          <Button
            onClick={fetchSessions}
            iconName="refresh"
            disabled={loading}
          >
            Refresh
          </Button>
        </SpaceBetween>
      }
    >
      Sessions
    </Header>
  );

  if (loading) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Sessions", href: "/sessions" },
        ]}
        contentHeader={contentHeader}
      >
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
            <Spinner size="large" />
            <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
              Loading active sessions...
            </Box>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: SessionStatus.ACTIVE, label: "Active" },
    { value: SessionStatus.DETACHED, label: "Detached" },
    { value: SessionStatus.TERMINATED, label: "Terminated" },
  ];

  const mainContent = (
    <SpaceBetween direction="vertical" size="l">
      {error && (
        <Alert
          type="error"
          header="Error"
        >
          {error}
        </Alert>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }} variant="p" color="text-body-secondary">
            No active sessions running.
          </Box>
          <Box textAlign="center" padding={{ top: "s" }}>
            <Button
              variant="primary"
              onClick={() => setShowCreate(true)}
              iconName="add-plus"
            >
              Launch your first agent
            </Button>
          </Box>
        </Container>
      )}

      {!loading && !error && sessionsWithTerminals.length > 0 && (
        <Container header={<Header>Workflow Overview</Header>}>
          <div style={{ height: "500px", borderRadius: "8px", overflow: "hidden", border: "1px solid #2d3f4f" }}>
            <ChainOverviewCard sessions={sessionsWithTerminals} />
          </div>
        </Container>
      )}

      {!loading && !error && sessions.length > 0 && (
        <Table
          columnDefinitions={[
            {
              id: "name",
              header: "Session Name",
              cell: (item) => (
                <Link href={`/sessions/${item.name}`} style={{ textDecoration: 'none' }}>
                  <Button variant="inline-link" iconName="folder">
                    {item.name}
                  </Button>
                </Link>
              ),
              sortingField: "name",
              width: 250,
            },
            {
              id: "id",
              header: "ID",
              cell: (item) => (
                <Box color="text-body-secondary" fontSize="body-s">
                  {item.id.slice(0, 8)}...
                </Box>
              ),
              width: 120,
            },
            {
              id: "status",
              header: "Status",
              cell: (item) => (
                <StatusIndicator type={getSessionStatusType(item.status)}>
                  {item.status}
                </StatusIndicator>
              ),
              sortingField: "status",
              width: 140,
            },
            {
              id: "actions",
              header: "Actions",
              cell: (item) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Link href={`/sessions/${item.name}`}>
                    <Button variant="normal" iconName="settings">
                      Details
                    </Button>
                  </Link>
                  <Link href={`/workflows/session-${item.name}`}>
                    <Button variant="normal" iconName="share">
                      Workflow
                    </Button>
                  </Link>
                  <Button 
                    variant="normal" 
                    iconName="remove"
                    onClick={() => setSessionToDelete(item.name)}
                  >
                    Delete
                  </Button>
                </SpaceBetween>
              ),
              width: 250,
            },
          ]}
          items={paginatedSessions}
          loadingText="Loading sessions"
          empty={
            <Box textAlign="center" color="text-body-secondary">
              <b>No sessions</b>
              <Box padding={{ bottom: "s" }} color="text-body-secondary">
                No sessions match the current filters.
              </Box>
            </Box>
          }
          filter={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Textfilter
                filteringText={filterText}
                filteringPlaceholder="Find sessions"
                filteringAriaLabel="Filter sessions"
                onChange={({ detail }) => {
                  setFilterText(detail.filteringText);
                  setCurrentPageIndex(1);
                }}
              />
              <Select
                selectedOption={statusOptions.find(o => o.value === filterStatus) || null}
                onChange={({ detail }) => {
                  setFilterStatus(detail.selectedOption?.value as FilterStatus);
                  setCurrentPageIndex(1);
                }}
                options={statusOptions}
                ariaDescribedby="status-filter"
              />
            </SpaceBetween>
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={Math.ceil(filteredSessions.length / pageSize)}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
              ariaLabels={{
                pageLabel: (pageNumber) => `Page ${pageNumber} of ${Math.ceil(filteredSessions.length / pageSize)}`,
              }}
            />
          }
          variant="full-page"
          stickyHeader
        />
      )}
    </SpaceBetween>
  );

  return (
    <>
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Sessions", href: "/sessions" },
        ]}
        contentHeader={contentHeader}
      >
        {mainContent}
      </DashboardLayout>

      {showCreate && (
        <Modal
          visible={showCreate}
          onDismiss={() => setShowCreate(false)}
          header="Launch New Agent Session"
          closeAriaLabel="Close modal"
          size="medium"
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateSession}
                  loading={creating}
                >
                  {creating ? "Launching..." : "Launch Agent"}
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="l">
              <FormField label="Session Name" description="Optional">
                <Input
                  value={newSessionName}
                  onChange={({ detail }) => setNewSessionName(detail.value)}
                  placeholder="e.g. feature-dev-01"
                />
              </FormField>

              <FormField label="Workflow">
                <Select
                  selectedOption={
                    selectedWorkflowId 
                      ? workflows.find(w => w.id === selectedWorkflowId) 
                        ? { value: selectedWorkflowId, label: workflows.find(w => w.id === selectedWorkflowId)!.name }
                        : null
                      : null
                  }
                  onChange={({ detail }) => setSelectedWorkflowId(detail.selectedOption?.value || "")}
                  options={[
                    { value: "", label: "Manual setup (choose agent & provider)" },
                    ...workflows.map(w => ({ value: w.id, label: w.name }))
                  ]}
                  placeholder="Choose a workflow"
                />
              </FormField>

              {!selectedWorkflowId && (
                <>
                  <FormField label="Agent Profile">
                    <Select
                      selectedOption={agents.find(a => a === agentProfile) ? { value: agentProfile, label: agentProfile } : null}
                      onChange={({ detail }) => setAgentProfile(detail.selectedOption?.value || "")}
                      options={agents.map(agent => ({ value: agent, label: agent }))}
                      placeholder="Choose an agent"
                    />
                  </FormField>

                  <FormField label="Provider">
                    <Select
                      selectedOption={{ value: provider, label: provider }}
                      onChange={({ detail }) => setProvider(detail.selectedOption?.value || ProviderType.Q_CLI)}
                      options={Object.values(ProviderType).map(p => ({ value: p, label: p }))}
                      placeholder="Choose a provider"
                    />
                  </FormField>
                </>
              )}
            </SpaceBetween>
          </Form>
        </Modal>
      )}

      {sessionToDelete && (
        <Modal
          visible={!!sessionToDelete}
          onDismiss={() => setSessionToDelete(null)}
          header="Confirm session deletion"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setSessionToDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleDeleteSession(sessionToDelete)}
                  loading={deleting}
                >
                  Delete
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box variant="p" color="text-body-secondary">
            Are you sure you want to delete session "{sessionToDelete}"? This action cannot be undone.
          </Box>
        </Modal>
      )}
    </>
  );
}
