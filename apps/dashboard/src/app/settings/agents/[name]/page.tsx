"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import Alert from "@cloudscape-design/components/alert";
import CodeEditor, { CodeEditorProps } from "@cloudscape-design/components/code-editor";
import Box from "@cloudscape-design/components/box";
import Textarea from "@cloudscape-design/components/textarea";
import Spinner from "@cloudscape-design/components/spinner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { caoClient } from "@/lib/api-client";

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentName = params.name as string;
  
  const [activeTab, setActiveTab] = useState("editor");
  const [markdownContent, setMarkdownContent] = useState("");
  const [providerOptions, setProviderOptions] = useState<SelectProps.Option[]>([]);
  const [provider, setProvider] = useState<SelectProps.Option | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ace, setAce] = useState<unknown>(undefined);
  const [editorPreferences, setEditorPreferences] = useState<CodeEditorProps.Preferences>({
    wrapLines: true,
    theme: "dawn",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [aceModule, providers, agentContent] = await Promise.all([
          import("ace-builds"),
          caoClient.listProviders(),
          caoClient.getAgentContent(agentName),
        ]);
        
        aceModule.config.set("basePath", "https://cdn.jsdelivr.net/npm/ace-builds@1.43.5/src-noconflict");
        setAce(aceModule);
        
        setProviderOptions(providers);
        if (providers.length > 0) {
          setProvider(providers[0]);
        }
        
        setMarkdownContent(agentContent.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [agentName]);

  const validateYamlFrontmatter = (content: string): { valid: boolean; error?: string; name?: string } => {
    if (!content.trim().startsWith("---")) {
      return { 
        valid: false, 
        error: "Content must start with '---' to begin YAML frontmatter" 
      };
    }

    const lines = content.split("\n");
    const closingIndex = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    
    if (closingIndex === -1) {
      return { 
        valid: false, 
        error: "YAML frontmatter must end with '---'" 
      };
    }

    const frontmatter = lines.slice(1, closingIndex).join("\n");
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const hasDescription = frontmatter.includes("description:");
    
    if (!nameMatch) {
      return { 
        valid: false, 
        error: "YAML frontmatter must include 'name:' field" 
      };
    }
    
    if (!hasDescription) {
      return { 
        valid: false, 
        error: "YAML frontmatter must include 'description:' field" 
      };
    }

    return { 
      valid: true, 
      name: nameMatch[1].trim() 
    };
  };

  const parseAgentName = (content: string): string | null => {
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    return nameMatch ? nameMatch[1].trim() : null;
  };

  const handleSave = async () => {
    const validation = validateYamlFrontmatter(markdownContent);
    
    if (!validation.valid) {
      setError(validation.error || "Invalid YAML frontmatter");
      return;
    }

    if (!provider) {
      setError("Please select a provider");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/agents/install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_type: "content",
          content: markdownContent,
          name: validation.name,
          provider: provider.value || "q_cli",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to save agent");
      }

      router.push("/settings/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        breadcrumbs={[
          { text: "Dashboard", href: "/" },
          { text: "Settings", href: "/settings" },
          { text: "Agents", href: "/settings/agents" },
          { text: agentName, href: `/settings/agents/${agentName}` },
        ]}
      >
        <ContentLayout
          header={
            <Header variant="h1">
              Edit Agent: {agentName}
            </Header>
          }
        >
          <Container>
            <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
              <Spinner size="large" />
              <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
                Loading agent...
              </Box>
            </Box>
          </Container>
        </ContentLayout>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Dashboard", href: "/" },
        { text: "Settings", href: "/settings" },
        { text: "Agents", href: "/settings/agents" },
        { text: agentName, href: `/settings/agents/${agentName}` },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Edit the agent profile markdown"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => router.push("/settings/agents")}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </SpaceBetween>
            }
          >
            Edit Agent: {agentName}
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="l">
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Container>
            <FormField
              label="Provider"
              description="CLI provider where this agent will be used"
            >
              <Select
                selectedOption={provider}
                onChange={({ detail }) => setProvider(detail.selectedOption)}
                options={providerOptions}
                placeholder="Select a provider"
              />
            </FormField>
          </Container>

          <Tabs
            activeTabId={activeTab}
            onChange={({ detail }) => setActiveTab(detail.activeTabId)}
            tabs={[
              {
                id: "editor",
                label: "Editor",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <Alert type="info">
                        Edit your agent profile in Markdown with YAML frontmatter. Required fields: <strong>name</strong> and <strong>description</strong>
                      </Alert>

                      <FormField>
                        <CodeEditor
                          ace={ace}
                          value={markdownContent}
                          language="markdown"
                          onDelayedChange={({ detail }) => setMarkdownContent(detail.value)}
                          preferences={editorPreferences}
                          onPreferencesChange={({ detail }) => setEditorPreferences(detail)}
                          loading={!ace}
                          i18nStrings={{
                            loadingState: "Loading code editor",
                            errorState: "Error loading code editor",
                            errorStateRecovery: "Retry",
                            editorGroupAriaLabel: "Code editor",
                            statusBarGroupAriaLabel: "Status",
                            cursorPosition: (row, column) => `Ln ${row}, Col ${column}`,
                            errorsTab: "Errors",
                            warningsTab: "Warnings",
                            preferencesButtonAriaLabel: "Preferences",
                            paneCloseButtonAriaLabel: "Close",
                            preferencesModalHeader: "Preferences",
                            preferencesModalCancel: "Cancel",
                            preferencesModalConfirm: "Confirm",
                            preferencesModalWrapLines: "Wrap lines",
                            preferencesModalTheme: "Theme",
                            preferencesModalLightThemes: "Light themes",
                            preferencesModalDarkThemes: "Dark themes",
                          }}
                          editorContentHeight={500}
                        />
                      </FormField>
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                id: "preview",
                label: "Preview",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <FormField label="Agent Name">
                        <Input 
                          value={parseAgentName(markdownContent) || "Not found"} 
                          readOnly 
                        />
                      </FormField>

                      <FormField label="Preview">
                        <Textarea
                          value={markdownContent}
                          readOnly
                          rows={20}
                        />
                      </FormField>
                    </SpaceBetween>
                  </Container>
                ),
              },
            ]}
          />
        </SpaceBetween>
      </ContentLayout>
    </DashboardLayout>
  );
}
