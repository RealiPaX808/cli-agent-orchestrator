"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { caoClient } from "@/lib/api-client";

const EXAMPLE_TEMPLATE = `---
name: my_custom_agent
description: A specialized agent for specific tasks
---

# MY CUSTOM AGENT

## Role and Identity
You are a specialized agent designed for...

## Core Responsibilities
- Primary responsibility 1
- Primary responsibility 2
- Primary responsibility 3

## Critical Rules
1. **ALWAYS** follow best practices
2. **NEVER** skip validation steps
3. **ALWAYS** provide clear explanations
`;

export default function NewAgentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("editor");
  
  const [markdownContent, setMarkdownContent] = useState(EXAMPLE_TEMPLATE);
  const [providerOptions, setProviderOptions] = useState<SelectProps.Option[]>([]);
  const [provider, setProvider] = useState<SelectProps.Option | null>(null);
  const [creating, setCreating] = useState(false);
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
        const [aceModule, providers] = await Promise.all([
          import("ace-builds"),
          caoClient.listProviders(),
        ]);
        
        aceModule.config.set("basePath", "https://cdn.jsdelivr.net/npm/ace-builds@1.43.5/src-noconflict");
        setAce(aceModule);
        
        setProviderOptions(providers);
        if (providers.length > 0) {
          setProvider(providers[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load providers");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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

  const handleCreate = async () => {
    const validation = validateYamlFrontmatter(markdownContent);
    
    if (!validation.valid) {
      setError(validation.error || "Invalid YAML frontmatter");
      return;
    }

    if (!provider) {
      setError("Please select a provider");
      return;
    }

    setCreating(true);
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
        throw new Error(data.detail || "Failed to create agent");
      }

      router.push("/settings/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Dashboard", href: "/" },
        { text: "Settings", href: "/settings" },
        { text: "Agents", href: "/settings/agents" },
        { text: "New Agent", href: "/settings/agents/new" },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Create a custom agent profile using Markdown"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => router.push("/settings/agents")}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  loading={creating}
                >
                  Create Agent
                </Button>
              </SpaceBetween>
            }
          >
            New Agent
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
                placeholder={loading ? "Loading providers..." : "Select a provider"}
                disabled={loading}
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
                        Write your agent profile in Markdown with YAML frontmatter. Required fields: <strong>name</strong> and <strong>description</strong>
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
              {
                id: "help",
                label: "Help",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <Box>
                        <Header variant="h3">Required Fields</Header>
                        <ul>
                          <li><strong>name</strong>: Unique identifier (lowercase, underscores)</li>
                          <li><strong>description</strong>: Brief description of the agent</li>
                        </ul>
                      </Box>

                      <FormField label="Example Template">
                        <Textarea
                          value={EXAMPLE_TEMPLATE}
                          readOnly
                          rows={15}
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
