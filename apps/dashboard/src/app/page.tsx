"use client";

import { useEffect, useState, useCallback } from "react";
import { caoClient } from "@/lib/api-client";
import { Session, getSessionStatusType } from "@/types/cao";
import Link from "next/link";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import TextContent from "@cloudscape-design/components/text-content";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface MetricTileProps {
  title: string;
  value: string;
  description: string;
  color?: "text-status-success" | "text-status-inactive" | "text-status-info" | "text-status-error" | "text-status-warning";
  iconName?: string;
}

function MetricTile({ title, value, description, color, iconName }: MetricTileProps) {
  return (
    <Container
      header={<Header variant="h3">{title}</Header>}
      fitHeight
    >
      <SpaceBetween direction="vertical" size="s">
        <SpaceBetween direction="horizontal" size="xs" alignItems="center">
          {iconName && (
            <Box fontSize="display-l" color={color || "text-body-secondary"}>
              {iconName}
            </Box>
          )}
          <Box variant="h1" fontSize="display-l" color={color || "text-body-secondary"}>
            {value}
          </Box>
        </SpaceBetween>
        <Box variant="p" color="text-body-secondary">
          {description}
        </Box>
      </SpaceBetween>
    </Container>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const sessionsData = await caoClient.listSessions();
      setSessions(sessionsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const activeSessionsCount = sessions.filter(s => s.status === "active").length;
  const inactiveSessionsCount = sessions.filter(s => s.status !== "active").length;

  const contentHeader = (
    <Header
      variant="h1"
      description="CLI Agent Orchestrator Dashboard"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            onClick={fetchSessions}
            iconName="refresh"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            href="/sessions"
          >
            View All Sessions
          </Button>
        </SpaceBetween>
      }
    >
      Dashboard
    </Header>
  );

  if (loading) {
    return (
      <DashboardLayout contentHeader={contentHeader}>
        <Container>
          <Box textAlign="center" padding={{ top: "xxl", bottom: "xxl" }}>
            <Spinner size="large" />
            <Box padding={{ top: "s" }} variant="p" color="text-body-secondary">
              Loading dashboard...
            </Box>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }


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

      {/* Welcome Section */}
      <Container>
        <SpaceBetween direction="vertical" size="m">
          <TextContent>
            <Box variant="h2">Welcome to CLI Agent Orchestrator</Box>
            <Box variant="p">
              Manage your CLI agent sessions, visualize agent chains, and monitor terminal activity
              from this centralized dashboard.
            </Box>
          </TextContent>
          <SpaceBetween direction="horizontal" size="s">
            <Link href="/sessions">
              <Button variant="primary">View Sessions</Button>
            </Link>
            <Link href="/settings/agents">
              <Button>Manage Agents</Button>
            </Link>
            <Link href="/settings">
              <Button>Settings</Button>
            </Link>
          </SpaceBetween>
        </SpaceBetween>
      </Container>

      {/* Stats Overview */}
      <SpaceBetween direction="horizontal" size="l">
        <MetricTile
          title="Total Sessions"
          value={sessions.length.toString()}
          description="All time"
          iconName="📊"
        />
        <MetricTile
          title="Active Sessions"
          value={activeSessionsCount.toString()}
          description="Currently running"
          color="text-status-success"
          iconName="⚡"
        />
        <MetricTile
          title="Inactive Sessions"
          value={inactiveSessionsCount.toString()}
          description="Not currently running"
          color="text-status-inactive"
          iconName="💤"
        />
      </SpaceBetween>

      {/* Recent Sessions Preview */}
      {sessions.length > 0 && (
        <Container header={<Header variant="h2">Recent Sessions</Header>}>
          <SpaceBetween direction="vertical" size="m">
            <SpaceBetween direction="horizontal" size="m">
              {sessions.slice(0, 3).map((session) => (
                <Container
                  key={session.id}
                  fitHeight
                  header={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Box fontWeight="bold">{session.name}</Box>
                      <StatusIndicator type={getSessionStatusType(session.status)}>
                        {session.status}
                      </StatusIndicator>
                    </SpaceBetween>
                  }
                >
                  <SpaceBetween direction="vertical" size="s">
                    <Box variant="small" color="text-body-secondary">
                      ID: {session.id}
                    </Box>
                    <Link href={`/sessions/${session.name}`}>
                      <Button variant="primary" iconName="angle-right" fullWidth>
                        Open Session
                      </Button>
                    </Link>
                  </SpaceBetween>
                </Container>
              ))}
            </SpaceBetween>
            {sessions.length > 6 && (
              <Box padding={{ top: "s" }} textAlign="center">
                <Link href="/sessions">
                  <Button variant="inline-link">View all {sessions.length} sessions</Button>
                </Link>
              </Box>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Quick Actions */}
      <Container header={<Header variant="h2">Quick Actions</Header>}>
        <SpaceBetween direction="horizontal" size="l">
          <Container fitHeight>
            <SpaceBetween direction="vertical" size="s">
              <Box fontWeight="bold" variant="h3">
                🚀 Create New Session
              </Box>
              <Box variant="p" color="text-body-secondary">
                Launch a new CLI agent session with your preferred configuration.
              </Box>
              <Link href="/sessions">
                <Button iconName="angle-right">Open</Button>
              </Link>
            </SpaceBetween>
          </Container>
          <Container fitHeight>
            <SpaceBetween direction="vertical" size="s">
              <Box fontWeight="bold" variant="h3">
                ⚙️ Configure Agents
              </Box>
              <Box variant="p" color="text-body-secondary">
                Manage and install agent profiles for your CLI sessions.
              </Box>
              <Link href="/settings/agents">
                <Button iconName="angle-right">Open</Button>
              </Link>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );

  return (
    <DashboardLayout contentHeader={contentHeader}>
      {mainContent}
    </DashboardLayout>
  );
}
