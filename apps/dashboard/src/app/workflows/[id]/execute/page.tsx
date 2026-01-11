"use client";

import { use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ExecutionViewer } from '@/components/workflow/execution/ExecutionViewer';
import { WorkflowStorage } from '@/lib/workflow-storage';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import { useRouter } from 'next/navigation';

interface ExecutePageProps {
  params: Promise<{ id: string }>;
}

export default function ExecutePage({ params }: ExecutePageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const workflow = use(WorkflowStorage.getWorkflow(resolvedParams.id));

  if (!workflow) {
    return (
      <DashboardLayout>
        <ContentLayout
          header={
            <Header variant="h1">Workflow Not Found</Header>
          }
        >
          <p>The workflow you are looking for does not exist.</p>
        </ContentLayout>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description={workflow.description}
          >
            Execute: {workflow.name}
          </Header>
        }
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: 'Dashboard', href: '/' },
              { text: 'Workflows', href: '/workflows' },
              { text: workflow.name, href: `/workflows/${workflow.id}` },
              { text: 'Execute', href: `/workflows/${workflow.id}/execute` },
            ]}
            onFollow={(e) => {
              e.preventDefault();
              router.push(e.detail.href);
            }}
          />
        }
      >
        <ExecutionViewer workflow={workflow} />
      </ContentLayout>
    </DashboardLayout>
  );
}
