"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

// Une la sesión anónima (landing, registro) con la cuenta en PostHog.
export function IdentifyUser({ id, email, name }: { id: string; email: string; name?: string }) {
  useEffect(() => identify({ id, email, name }), [id, email, name]);
  return null;
}
