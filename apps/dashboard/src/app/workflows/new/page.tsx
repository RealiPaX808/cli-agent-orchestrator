"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

export default function NewWorkflowPage() {
  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Home", href: "/" },
        { text: "Workflows", href: "/workflows" },
        { text: "New", href: "/workflows/new" },
      ]}
    >
      <SpaceBetween size="l">
        <Header variant="h1">Create New Workflow</Header>
        <WorkflowEditor />
      </SpaceBetween>
    </DashboardLayout>
  );
}
