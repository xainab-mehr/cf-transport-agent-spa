"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: true },
      loaded: (ph) => {
        // track() in page.tsx reads window.posthog — make that binding explicit
        (window as unknown as { posthog: typeof ph }).posthog = ph;
      },
    });
  }, []);

  return <>{children}</>;
}
