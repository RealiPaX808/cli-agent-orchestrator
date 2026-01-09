"use client";

import { use } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

export default function WorkflowEditorPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params);

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Home", href: "/" },
        { text: "Workflows", href: "/workflows" },
        { text: "Edit", href: `/workflows/${id}` },
      ]}
    >
      <SpaceBetween size="l">
        <Header variant="h1">Edit Workflow</Header>
        <WorkflowEditor workflowId={id} />
      </SpaceBetween>
    </DashboardLayout>
  );
}
