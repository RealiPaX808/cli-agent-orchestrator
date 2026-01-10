"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Button from "@cloudscape-design/components/button";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { WorkflowStorage } from "@/lib/workflow-storage";
import { Workflow } from "@/types/workflow";

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkflows = async () => {
      const loaded = await WorkflowStorage.getWorkflows();
      setWorkflows(loaded);
      setLoading(false);
    };
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    const loaded = await WorkflowStorage.getWorkflows();
    setWorkflows(loaded);
  };

  const handleDelete = async () => {
    await Promise.all(
      selectedWorkflows.map(w => WorkflowStorage.deleteWorkflow(w.id))
    );
    await loadWorkflows();
    setSelectedWorkflows([]);
  };

  const handleExport = (workflow: Workflow) => {
    const json = WorkflowStorage.exportWorkflow(workflow);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Home", href: "/" },
        { text: "Workflows", href: "/workflows" },
      ]}
    >
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => router.push("/workflows/new")}>
                Create workflow
              </Button>
              <Button
                disabled={selectedWorkflows.length === 0}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </SpaceBetween>
          }
        >
          Workflows
        </Header>

        {workflows.length === 0 && !loading ? (
          <Box textAlign="center" padding="xxl">
            <Box variant="p" color="text-body-secondary">
              No workflows yet. Create your first workflow to get started.
            </Box>
            <Button
              variant="primary"
              onClick={() => router.push("/workflows/new")}
            >
              Create workflow
            </Button>
          </Box>
        ) : (
          <Table
            selectedItems={selectedWorkflows}
            onSelectionChange={({ detail }) =>
              setSelectedWorkflows(detail.selectedItems)
            }
            columnDefinitions={[
              {
                id: "name",
                header: "Name",
                cell: (item) => item.name || "-",
                sortingField: "name",
              },
              {
                id: "description",
                header: "Description",
                cell: (item) => item.description || "-",
              },
              {
                id: "nodes",
                header: "Nodes",
                cell: (item) => (item as any).node_count ?? item.nodes?.length ?? "-",
              },
              {
                id: "updated",
                header: "Last updated",
                cell: (item) =>
                  new Date(item.updatedAt).toLocaleString(),
                sortingField: "updatedAt",
              },
              {
                id: "status",
                header: "Status",
                cell: () => <StatusIndicator>Ready</StatusIndicator>,
              },
              {
                id: "actions",
                header: "Actions",
                cell: (item) => (
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      variant="inline-link"
                      onClick={() => router.push(`/workflows/${item.id}`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="inline-link"
                      onClick={() => router.push(`/workflows/${item.id}/execute`)}
                    >
                      Execute
                    </Button>
                    <Button
                      variant="inline-link"
                      onClick={() => handleExport(item)}
                    >
                      Export
                    </Button>
                  </SpaceBetween>
                ),
              },
            ]}
            items={workflows}
            loading={loading}
            loadingText="Loading workflows"
            selectionType="multi"
            trackBy="id"
            empty={
              <Box textAlign="center" color="inherit">
                <Box variant="p" color="inherit">
                  No workflows
                </Box>
              </Box>
            }
          />
        )}
      </SpaceBetween>
    </DashboardLayout>
  );
}
