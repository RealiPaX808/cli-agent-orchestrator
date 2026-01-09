"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewAgentRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new settings/agents location
    router.replace("/settings/agents");
  }, [router]);

  return null;
}
