"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import Alert from "@cloudscape-design/components/alert";
import Tabs from "@cloudscape-design/components/tabs";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface Settings {
  dashboardName: string;
  defaultView: SelectProps.Option;
  autoRefresh: boolean;
  terminalFontSize: SelectProps.Option;
  terminalScrollbackLines: string;
  terminalCursorBlink: boolean;
  apiEndpoint: string;
  wsEndpoint: string;
  connectionTimeout: string;
}

const DEFAULT_SETTINGS: Settings = {
  dashboardName: "CLI Agent Orchestrator",
  defaultView: { value: "sessions", label: "Sessions List" },
  autoRefresh: true,
  terminalFontSize: { value: "14", label: "14px" },
  terminalScrollbackLines: "10000",
  terminalCursorBlink: true,
  apiEndpoint: "http://localhost:8000",
  wsEndpoint: "ws://localhost:8000",
  connectionTimeout: "30",
};

const STORAGE_KEY = "cao-dashboard-settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
  }, []);

  const handleSave = () => {
    setSaveStatus("saving");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setTimeout(() => {
      setSaveStatus("saved");
      setHasChanges(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 300);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    setHasChanges(true);
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Dashboard", href: "/" },
        { text: "Settings", href: "/settings" },
      ]}
      contentType="default"
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Configure your CLI Agent Orchestrator dashboard"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleReset} disabled={!hasChanges}>
                  Reset
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  loading={saveStatus === "saving"}
                >
                  {saveStatus === "saved" ? "Saved" : "Save"}
                </Button>
              </SpaceBetween>
            }
          >
            Settings
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="l">
          {hasChanges && (
            <Alert type="warning" dismissible onDismiss={() => setHasChanges(false)}>
              You have unsaved changes
            </Alert>
          )}

          <Tabs
            tabs={[
              {
                id: "general",
                label: "General",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <FormField
                        label="Dashboard Name"
                        description="Display name for this dashboard"
                      >
                        <Input
                          value={settings.dashboardName}
                          onChange={({ detail }) =>
                            updateSettings({ dashboardName: detail.value })
                          }
                        />
                      </FormField>

                      <FormField
                        label="Default View"
                        description="Default view when loading the dashboard"
                      >
                        <Select
                          selectedOption={settings.defaultView}
                          onChange={({ detail }) =>
                            updateSettings({ defaultView: detail.selectedOption })
                          }
                          options={[
                            { value: "sessions", label: "Sessions" },
                            { value: "chain", label: "Workflow" },
                            { value: "terminals", label: "Terminals" },
                          ]}
                        />
                      </FormField>

                      <FormField
                        label="Auto-refresh"
                        description="Automatically refresh session and terminal data"
                      >
                        <Toggle
                          checked={settings.autoRefresh}
                          onChange={({ detail }) =>
                            updateSettings({ autoRefresh: detail.checked })
                          }
                        >
                          Enable auto-refresh
                        </Toggle>
                      </FormField>
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                id: "terminal",
                label: "Terminal",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <FormField
                        label="Font Size"
                        description="Default font size for terminal views"
                      >
                        <Select
                          selectedOption={settings.terminalFontSize}
                          onChange={({ detail }) =>
                            updateSettings({ terminalFontSize: detail.selectedOption })
                          }
                          options={[
                            { value: "12", label: "12px" },
                            { value: "14", label: "14px" },
                            { value: "16", label: "16px" },
                            { value: "18", label: "18px" },
                          ]}
                        />
                      </FormField>

                      <FormField
                        label="Scrollback Lines"
                        description="Number of lines to keep in terminal history"
                      >
                        <Input
                          type="number"
                          value={settings.terminalScrollbackLines}
                          onChange={({ detail }) =>
                            updateSettings({ terminalScrollbackLines: detail.value })
                          }
                        />
                      </FormField>

                      <FormField
                        label="Cursor Blink"
                        description="Enable or disable cursor blinking in terminals"
                      >
                        <Toggle
                          checked={settings.terminalCursorBlink}
                          onChange={({ detail }) =>
                            updateSettings({ terminalCursorBlink: detail.checked })
                          }
                        >
                          Enable cursor blinking
                        </Toggle>
                      </FormField>
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                id: "api",
                label: "API",
                content: (
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <FormField
                        label="API Endpoint"
                        description="Backend API URL (configured at build time)"
                      >
                        <Input value={settings.apiEndpoint} disabled />
                      </FormField>

                      <FormField
                        label="WebSocket URL"
                        description="WebSocket endpoint for terminal streams"
                      >
                        <Input value={settings.wsEndpoint} disabled />
                      </FormField>

                      <FormField
                        label="Connection Timeout"
                        description="Timeout in seconds for API requests"
                      >
                        <Input
                          type="number"
                          value={settings.connectionTimeout}
                          onChange={({ detail }) =>
                            updateSettings({ connectionTimeout: detail.value })
                          }
                        />
                      </FormField>
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                id: "advanced",
                label: "Advanced",
                content: (
                  <Container
                    header={
                      <Header variant="h2" description="Additional configuration and management">
                        Advanced Settings
                      </Header>
                    }
                  >
                    <SpaceBetween direction="vertical" size="l">
                      <FormField
                        label="Agent Management"
                        description="Configure and install agent profiles for CLI sessions"
                      >
                        <Link href="/settings/agents">
                          <Button iconName="settings">Manage Agents</Button>
                        </Link>
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
