"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Textarea from "@cloudscape-design/components/textarea";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { WorkflowStorage } from "@/lib/workflow-storage";
import { WorkflowNodeType } from "@/types/workflow";

export default function PromptInputPage({ params }: { params: Promise<{ name: string }> }) {
  const resolvedParams = use(params);
  const sessionName = resolvedParams.name;
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    const workflows = WorkflowStorage.getWorkflows();
    
    for (const workflow of workflows) {
      for (const node of workflow.nodes) {
        if (
          node.data.type === WorkflowNodeType.WEBHOOK &&
          node.data.config.isPromptInput &&
          node.data.config.webhookUrl
        ) {
          setWebhookUrl(node.data.config.webhookUrl);
          return;
        }
      }
    }
  }, []);

  const handleOptimize = async () => {
    if (!prompt.trim()) {
      setResult({ type: "error", message: "Please enter a prompt to optimize" });
      return;
    }

    if (!webhookUrl) {
      setResult({ 
        type: "error", 
        message: "No webhook configured for prompt input. Please create a workflow with a webhook node marked as 'Enable Prompt Input'." 
      });
      return;
    }

    try {
      setOptimizing(true);
      setResult(null);

      const response = await fetch("/api/prompt/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt,
          webhook_url: webhookUrl 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to optimize prompt");
      }

      const data = await response.json();
      setOptimizedPrompt(data.optimized_prompt);
      setResult({
        type: "success",
        message: "Prompt optimized successfully",
      });
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to optimize prompt",
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleSubmit = async () => {
    const finalPrompt = optimizedPrompt || prompt;
    
    if (!finalPrompt.trim()) {
      setResult({ type: "error", message: "Please enter a prompt" });
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const response = await fetch(`/api/sessions/${sessionName}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to submit prompt");
      }

      setResult({
        type: "success",
        message: "Prompt submitted successfully",
      });
      
      setTimeout(() => {
        router.push(`/sessions/${sessionName}`);
      }, 1500);
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to submit prompt",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseOptimized = () => {
    setPrompt(optimizedPrompt);
    setOptimizedPrompt("");
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { text: "Dashboard", href: "/" },
        { text: "Sessions", href: "/sessions" },
        { text: sessionName, href: `/sessions/${sessionName}` },
        { text: "Prompt Input", href: `/sessions/${sessionName}/prompt-input` },
      ]}
      contentHeader={
        <Header
          variant="h1"
          description={`Session: ${sessionName}`}
        >
          Prompt Input
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        {result && (
          <Alert
            type={result.type}
            dismissible
            onDismiss={() => setResult(null)}
          >
            {result.message}
          </Alert>
        )}

        {!webhookUrl && (
          <Alert type="warning">
            No webhook configured for prompt optimization. Create a workflow with a webhook node and enable "Prompt Input" to use AI optimization.
          </Alert>
        )}

        <Container
          header={
            <Header
              description="Enter your prompt and optionally optimize it before submitting"
            >
              Input Prompt
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Your Prompt"
              stretch
            >
              <Textarea
                value={prompt}
                onChange={({ detail }) => setPrompt(detail.value)}
                placeholder="Enter your prompt here..."
                rows={8}
              />
            </FormField>

            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={handleOptimize}
                loading={optimizing}
                iconName="gen-ai"
                disabled={!webhookUrl}
              >
                Optimize with AI
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!prompt.trim() && !optimizedPrompt.trim()}
              >
                Submit Prompt
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </Container>

        {optimizedPrompt && (
          <Container
            header={
              <Header
                description="AI-optimized version of your prompt"
                actions={
                  <Button onClick={handleUseOptimized} iconName="upload">
                    Use This Version
                  </Button>
                }
              >
                Optimized Prompt
              </Header>
            }
          >
            <Box variant="p" padding={{ top: "s", bottom: "s" }}>
              {optimizedPrompt}
            </Box>
          </Container>
        )}
      </SpaceBetween>
    </DashboardLayout>
  );
}
