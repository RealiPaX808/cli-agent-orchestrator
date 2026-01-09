"use client";

import { useState, useEffect, useCallback } from "react";
import { ProviderType } from "@/types/cao";
import Link from "next/link";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Tabs from "@cloudscape-design/components/tabs";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Alert from "@cloudscape-design/components/alert";
import Cards from "@cloudscape-design/components/cards";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Modal from "@cloudscape-design/components/modal";
import Spinner from "@cloudscape-design/components/spinner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { caoClient } from "@/lib/api-client";

interface AgentProfile {
  name: string;
  provider: ProviderType;
  description?: string;
  status: "installed" | "available" | "error";
}

export default function AgentsSettingsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);

  // Install form state
  const [sourceType, setSourceType] = useState<"built-in" | "file" | "url">("built-in");
  const [agentName, setAgentName] = useState("");
  const [pathOrUrl, setPathOrUrl] = useState("");
  const [provider, setProvider] = useState<string>(ProviderType.Q_CLI);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const agentsData = await caoClient.listAgents();
      const profiles: AgentProfile[] = agentsData.map(name => ({
        name,
        provider: ProviderType.Q_CLI,
        description: `Built-in agent profile for ${name}`,
        status: "installed" as const,
      }));
      setAgents(profiles);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleInstall = async () => {
    setInstalling(true);
    setResult(null);

    try {
      const response = await caoClient.installAgent({
        source_type: sourceType,
        name: sourceType === "built-in" ? agentName : undefined,
        path: sourceType !== "built-in" ? pathOrUrl : undefined,
        provider,
      });

      setResult({
        success: response.success,
        message: response.message || `Agent '${response.agent_name}' installed successfully!`,
      });

      if (response.success) {
        setShowInstall(false);
        setAgentName("");
        setPathOrUrl("");
        fetchAgents();
      }
    } catch (err) {
      setResult({
        success: false,
        message: `Installation failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setInstalling(false);
    }
  };

  const contentHeader = (
    <Header
      variant="h1"
      description="Manage and configure agent profiles"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Link href="/settings/agents/new">
            <Button iconName="add-plus">
              Create Agent
            </Button>
          </Link>
          <Button onClick={fetchAgents} iconName="refresh" disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowInstall(true)} iconName="upload">
            Install Agent
          </Button>
        </SpaceBetween>
      }
    >
      Agents
    </Header>
  );

  if (loading) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Settings", href: "/settings" },
          { text: "Agents", href: "/settings/agents" },
        ]}
      >
        <ContentLayout header={contentHeader}>
          <Container>
            <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
              <Spinner size="large" />
              <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
                Loading agent profiles...
              </Box>
            </Box>
          </Container>
        </ContentLayout>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Settings", href: "/settings" },
          { text: "Agents", href: "/settings/agents" },
        ]}
      >
        <ContentLayout header={contentHeader}>
          <SpaceBetween direction="vertical" size="l">
            {result && (
              <Alert
                type={result.success ? "success" : "error"}
                header={result.success ? "Success" : "Error"}
                dismissible
                onDismiss={() => setResult(null)}
              >
                {result.message}
              </Alert>
            )}

            <Tabs
              tabs={[
                {
                  id: "installed",
                  label: `Installed (${agents.length})`,
                  content: (
                    <Container>
                      <SpaceBetween direction="vertical" size="l">
                        <Alert type="info">
                          Agent profiles define the behavior and capabilities of your CLI agents. Create new agents or install from built-in profiles.
                        </Alert>

                        {agents.length === 0 ? (
                          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }} color="text-body-secondary">
                            <Box variant="p" fontSize="heading-m" padding={{ bottom: "s" }}>
                              No agents installed
                            </Box>
                            <Box variant="p" color="text-body-secondary" padding={{ bottom: "m" }}>
                              Install your first agent to get started
                            </Box>
                            <SpaceBetween direction="horizontal" size="xs">
                              <Link href="/settings/agents/new">
                                <Button iconName="add-plus">Create Agent</Button>
                              </Link>
                              <Button variant="primary" onClick={() => setShowInstall(true)} iconName="upload">
                                Install Agent
                              </Button>
                            </SpaceBetween>
                          </Box>
                        ) : (
                          <Cards
                            cardDefinition={{
                              header: (agent) => (
                                <Link href={`/settings/agents/${agent.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                  <SpaceBetween direction="horizontal" size="xs">
                                    <Box fontWeight="bold" fontSize="heading-m">{agent.name}</Box>
                                    <StatusIndicator type="success">Installed</StatusIndicator>
                                  </SpaceBetween>
                                </Link>
                              ),
                              sections: [
                                {
                                  id: "provider",
                                  header: "Provider",
                                  content: (agent) => (
                                    <Link href={`/settings/agents/${agent.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      <Box color="text-body-secondary">{agent.provider}</Box>
                                    </Link>
                                  ),
                                },
                                {
                                  id: "description",
                                  header: "Description",
                                  content: (agent) => (
                                    <Link href={`/settings/agents/${agent.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      <Box color="text-body-secondary">
                                        {agent.description || "No description available"}
                                      </Box>
                                    </Link>
                                  ),
                                },
                              ],
                            }}
                            cardsPerRow={[
                              { cards: 1 },
                              { minWidth: 400, cards: 2 },
                              { minWidth: 800, cards: 3 },
                            ]}
                            items={agents}
                          />
                        )}
                      </SpaceBetween>
                    </Container>
                  ),
                },
                {
                  id: "providers",
                  label: "Providers",
                  content: (
                    <Container>
                      <SpaceBetween direction="vertical" size="l">
                        <Alert type="info">
                          Providers are the underlying CLI tools that agents use to execute commands. All configured providers are listed below.
                        </Alert>

                        <SpaceBetween direction="vertical" size="m">
                          {Object.values(ProviderType).map((prov) => (
                            <Container
                              key={prov}
                              header={
                                <Header
                                  variant="h3"
                                  actions={
                                    <StatusIndicator type="success">Active</StatusIndicator>
                                  }
                                >
                                  {prov}
                                </Header>
                              }
                            >
                              <Box variant="p" color="text-body-secondary">
                                {prov === ProviderType.Q_CLI && "Amazon Q CLI provider for Q.ai powered agents"}
                                {prov === ProviderType.CLAUDE_CODE && "Claude Code provider for Anthropic Claude agents"}
                                {prov === ProviderType.GEMINI_CLI && "Gemini CLI provider for Google Gemini agents"}
                                {prov === ProviderType.GH_COPILOT && "GitHub Copilot CLI provider for GitHub AI agents"}
                                {prov === ProviderType.OPENCODE && "OpenCode plugin provider for extensible agent framework"}
                              </Box>
                            </Container>
                          ))}
                        </SpaceBetween>
                      </SpaceBetween>
                    </Container>
                  ),
                },
              ]}
            />
          </SpaceBetween>
        </ContentLayout>
      </DashboardLayout>

      {/* Install Agent Modal */}
      {showInstall && (
        <Modal
          visible={showInstall}
          onDismiss={() => setShowInstall(false)}
          header="Install New Agent"
          size="medium"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowInstall(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleInstall} loading={installing}>
                  Install Agent
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Form>
            <SpaceBetween direction="vertical" size="l">
              <FormField label="Source Type">
                <Select
                  selectedOption={
                    sourceType
                      ? {
                          value: sourceType,
                          label:
                            sourceType === "built-in"
                              ? "Built-in agent"
                              : sourceType === "file"
                                ? "Local file path"
                                : "External URL",
                        }
                      : null
                  }
                  onChange={({ detail }) => setSourceType(detail.selectedOption?.value as "built-in" | "file" | "url" || "built-in")}
                  options={[
                    { value: "built-in", label: "Built-in agent" },
                    { value: "file", label: "Local file path" },
                    { value: "url", label: "External URL" },
                  ]}
                  placeholder="Choose source type"
                  expandToViewport={true}
                />
              </FormField>

              {sourceType === "built-in" && (
                <FormField label="Agent Name" constraintText="Name of the built-in agent profile">
                  <Input
                    value={agentName}
                    onChange={({ detail }) => setAgentName(detail.value)}
                    placeholder="e.g., developer, code_supervisor, reviewer"
                  />
                </FormField>
              )}

              {sourceType === "file" && (
                <FormField label="Agent Path" constraintText="Absolute path to agent markdown file">
                  <Input
                    value={pathOrUrl}
                    onChange={({ detail }) => setPathOrUrl(detail.value)}
                    placeholder="/path/to/agent.md"
                  />
                </FormField>
              )}

              {sourceType === "url" && (
                <FormField label="Agent URL" constraintText="HTTPS or HTTP URL to agent markdown file">
                  <Input
                    value={pathOrUrl}
                    onChange={({ detail }) => setPathOrUrl(detail.value)}
                    placeholder="https://example.com/agents/custom-agent.md"
                    type="url"
                  />
                </FormField>
              )}

              <FormField label="Provider">
                <Select
                  selectedOption={{ value: provider, label: provider }}
                  onChange={({ detail }) => setProvider(detail.selectedOption?.value || ProviderType.Q_CLI)}
                  options={Object.values(ProviderType).map((p) => ({ value: p, label: p }))}
                  placeholder="Choose a provider"
                  expandToViewport={true}
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </Modal>
      )}
    </>
  );
}
