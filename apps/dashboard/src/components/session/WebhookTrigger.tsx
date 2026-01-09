"use client";

import { useState } from "react";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Textarea from "@cloudscape-design/components/textarea";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";

export function WebhookTrigger() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMethod, setWebhookMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("POST");
  const [payload, setPayload] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSend = async () => {
    if (!webhookUrl.trim()) {
      setResult({ type: "error", message: "Webhook URL is required" });
      return;
    }

    if (!payload.trim()) {
      setResult({ type: "error", message: "Payload is required" });
      return;
    }

    try {
      setSending(true);
      setResult(null);

      const response = await fetch("/api/webhooks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          method: webhookMethod,
          payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to execute webhook");
      }

      const data = await response.json();
      setResult({
        type: "success",
        message: `Webhook executed successfully. Status: ${data.status_code}`,
      });
      setPayload("");
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to execute webhook",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Container
      header={
        <Header
          description="Send custom payloads to webhook endpoints"
        >
          Webhook Trigger
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        {result && (
          <Alert type={result.type} dismissible onDismiss={() => setResult(null)}>
            {result.message}
          </Alert>
        )}

        <FormField label="Webhook URL" stretch>
          <Textarea
            value={webhookUrl}
            onChange={({ detail }) => setWebhookUrl(detail.value)}
            placeholder="https://example.com/webhook"
            rows={1}
          />
        </FormField>

        <FormField label="HTTP Method" stretch>
          <select
            value={webhookMethod}
            onChange={(e) => setWebhookMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              width: "100%",
            }}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </FormField>

        <FormField
          label="Payload"
          description="Text content to send to the webhook"
          stretch
        >
          <Textarea
            value={payload}
            onChange={({ detail }) => setPayload(detail.value)}
            placeholder="Enter text payload to send..."
            rows={6}
          />
        </FormField>

        <Button variant="primary" onClick={handleSend} loading={sending}>
          Send Webhook
        </Button>
      </SpaceBetween>
    </Container>
  );
}
