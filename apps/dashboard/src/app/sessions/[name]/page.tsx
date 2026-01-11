"use client";

import { useEffect, useState, useCallback, use } from "react";
import { caoClient } from "@/lib/api-client";
import { Session, Terminal, ProviderType } from "@/types/cao";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Select from "@cloudscape-design/components/select";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Tabs from "@cloudscape-design/components/tabs";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WebhookTrigger } from "@/components/session/WebhookTrigger";

export default function SessionDetail({ params }: { params: Promise<{ name: string }> }) {
  const resolvedParams = use(params);
  const name = resolvedParams.name;

  const [session, setSession] = useState<Session | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddTerminal, setShowAddTerminal] = useState(false);
  const [agentProfile, setAgentProfile] = useState("developer");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [agents, setAgents] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  const fetchData = useCallback(async () => {
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
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [name, agentProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteSession = async () => {
    try {
      setDeleting(true);
      await caoClient.deleteSession(name);
      router.push("/");
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAddTerminal = async () => {
    try {
      setAdding(true);
      await fetch(`/api/sessions/${name}/terminals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          agent_profile: agentProfile
        })
      });
      setShowAddTerminal(false);
      fetchData();
    } catch (err) {
      console.error("Failed to add terminal:", err);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Sessions", href: "/sessions" },
          { text: name, href: `/sessions/${name}` },
        ]}
        contentType="default"
      >
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
            <Spinner size="large" />
            <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
              Loading session details...
            </Box>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: name, href: `/sessions/${name}` }
        ]}
        contentType="default"
      >
        <Container>
          <Alert type="error" header="Session not found">
            Session "{name}" was not found. It may have been deleted or never existed.
          </Alert>
          <Box padding={{ top: "s" }}>
            <Button href="/">Back to Dashboard</Button>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  const processingCount = terminals.filter(t => t.status === 'processing').length;
  const idleCount = terminals.filter(t => t.status === 'idle').length;
  const completedCount = terminals.filter(t => t.status === 'completed').length;
  const errorCount = terminals.filter(t => t.status === 'error').length;

  return (
    <>
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Sessions", href: "/sessions" },
          { text: name, href: `/sessions/${name}` },
        ]}
        contentType="default"
      >
        <ContentLayout
          header={
            <Header
              variant="h1"
              description={`Session ID: ${session.id}`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="normal"
                    onClick={() => router.push(`/sessions/${name}/prompt-input`)}
                    iconName="gen-ai"
                  >
                    Prompt Input
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddTerminal(true)}
                    iconName="add-plus"
                  >
                    Add Terminal
                  </Button>
                </SpaceBetween>
              }
            >
              {session.name}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <SpaceBetween direction="vertical" size="l">
                    <Container
                      header={<Header variant="h2">Session Information</Header>}
                    >
                      <ColumnLayout columns={2} variant="text-grid">
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Session Name</Box>
                          <Box>{session.name}</Box>
                        </SpaceBetween>
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Status</Box>
                          <StatusIndicator
                            type={session.status === "active" ? "success" : "stopped"}
                          >
                            {session.status}
                          </StatusIndicator>
                        </SpaceBetween>
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Session ID</Box>
                          <Box variant="small" color="text-body-secondary">
                            {session.id}
                          </Box>
                        </SpaceBetween>
                        {session.workflow_id && (
                          <SpaceBetween direction="vertical" size="xs">
                            <Box variant="awsui-key-label">Workflow ID</Box>
                            <Box>{session.workflow_id}</Box>
                          </SpaceBetween>
                        )}
                      </ColumnLayout>
                    </Container>

                    <Container
                      header={<Header variant="h2">Terminal Statistics</Header>}
                    >
                      <ColumnLayout columns={4} variant="text-grid">
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Processing</Box>
                          <Box fontSize="heading-xl" fontWeight="bold">
                            {processingCount}
                          </Box>
                        </SpaceBetween>
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Idle</Box>
                          <Box fontSize="heading-xl" fontWeight="bold">
                            {idleCount}
                          </Box>
                        </SpaceBetween>
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Completed</Box>
                          <Box fontSize="heading-xl" fontWeight="bold">
                            {completedCount}
                          </Box>
                        </SpaceBetween>
                        <SpaceBetween direction="vertical" size="xs">
                          <Box variant="awsui-key-label">Errors</Box>
                          <Box fontSize="heading-xl" fontWeight="bold">
                            {errorCount}
                          </Box>
                        </SpaceBetween>
                      </ColumnLayout>
                    </Container>

                    <WebhookTrigger />
                  </SpaceBetween>
                ),
              },
              {
                id: "terminals",
                label: "Terminals",
                content: (
                  <Container>
                    {terminals.length > 0 ? (
                      <SpaceBetween direction="vertical" size="l">
                        {terminals.map((terminal) => (
                          <Container
                            key={terminal.id}
                            header={
                              <SpaceBetween direction="horizontal" size="xs">
                                <Box fontWeight="bold">{terminal.name}</Box>
                                <StatusIndicator
                                  type={
                                    terminal.status === "idle" || terminal.status === "processing"
                                      ? "success"
                                      : "stopped"
                                  }
                                >
                                  {terminal.status}
                                </StatusIndicator>
                              </SpaceBetween>
                            }
                          >
                            <SpaceBetween direction="vertical" size="m">
                              <ColumnLayout columns={2} variant="text-grid">
                                <SpaceBetween direction="vertical" size="xs">
                                  <Box variant="awsui-key-label">Terminal ID</Box>
                                  <Box variant="small" color="text-body-secondary">
                                    {terminal.id}
                                  </Box>
                                </SpaceBetween>
                                <SpaceBetween direction="vertical" size="xs">
                                  <Box variant="awsui-key-label">Type</Box>
                                  <Box>{terminal.provider}</Box>
                                </SpaceBetween>
                                {terminal.agent_profile && (
                                  <SpaceBetween direction="vertical" size="xs">
                                    <Box variant="awsui-key-label">Agent Profile</Box>
                                    <Box>{terminal.agent_profile}</Box>
                                  </SpaceBetween>
                                )}
                              </ColumnLayout>
                              <Link href={`/terminals/${terminal.id}`}>
                                <Button variant="primary">View Terminal</Button>
                              </Link>
                            </SpaceBetween>
                          </Container>
                        ))}
                      </SpaceBetween>
                    ) : (
                      <Box
                        textAlign="center"
                        padding={{ top: "xxl", bottom: "xxl" }}
                        variant="p"
                        color="text-body-secondary"
                      >
                        No active terminals. Add one to get started.
                      </Box>
                    )}
                  </Container>
                ),
              },
              {
                id: "activity",
                label: "Activity",
                content: (
                  <Container>
                    <Box
                      textAlign="center"
                      padding={{ top: "xxl", bottom: "xxl" }}
                      variant="p"
                      color="text-body-secondary"
                    >
                      Activity timeline coming soon...
                    </Box>
                  </Container>
                ),
              },
              {
                id: "advanced",
                label: "Advanced",
                content: (
                  <Container
                    header={
                      <Header variant="h2" description="Dangerous operations">
                        Advanced Settings
                      </Header>
                    }
                  >
                    <FormField
                      label="Delete Session"
                      description="Permanently delete this session and all associated terminals"
                    >
                      <Button
                        iconName="remove"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Delete Session
                      </Button>
                    </FormField>
                  </Container>
                ),
              },
            ]}
          />
        </ContentLayout>
      </DashboardLayout>

      {showDeleteConfirm && (
        <Modal
          visible={showDeleteConfirm}
          onDismiss={() => setShowDeleteConfirm(false)}
          header="Confirm session deletion"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteSession}
                  loading={deleting}
                >
                  Delete
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box variant="p" color="text-body-secondary">
            Are you sure you want to delete this session?
          </Box>
        </Modal>
      )}

      {showAddTerminal && (
        <Modal
          visible={showAddTerminal}
          onDismiss={() => setShowAddTerminal(false)}
          header="Add Terminal to Session"
          size="medium"
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowAddTerminal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddTerminal} loading={adding}>
                  Add Terminal
                </Button>
              </SpaceBetween>
            }
          >
            <FormField label="Agent Profile">
              <Select
                selectedOption={agents.find(a => a === agentProfile) ? { value: agentProfile, label: agentProfile } : null}
                onChange={({ detail }) => setAgentProfile(detail.selectedOption?.value || "")}
                options={agents.map(agent => ({ value: agent, label: agent }))}
                placeholder="Choose an agent profile"
                expandToViewport={true}
              />
            </FormField>

            <FormField label="Provider">
              <Select
                selectedOption={{ value: provider, label: provider }}
                onChange={({ detail }) => setProvider(detail.selectedOption?.value || ProviderType.Q_CLI)}
                options={Object.values(ProviderType).map(p => ({ value: p, label: p }))}
                placeholder="Choose a provider"
                expandToViewport={true}
              />
            </FormField>
          </Form>
        </Modal>
      )}
    </>
  );
}
