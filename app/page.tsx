"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { ChevronDownIcon, PhoneIcon, SendIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { BenefitsPanel } from "@/components/benefits-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/components/ui/message";
import { Orb } from "@/components/ui/orb";
import { Response } from "@/components/ui/response";

/**
 * Design reminder — Guided Clinical Focus:
 * keep the chat centered and unmistakable, use navy for trusted structure,
 * and reserve soft blue motion exclusively for the first composer interaction.
 */

/**
 * "failed" is distinct from "disconnected".
 *   disconnected = no live session, but nothing has gone wrong (pre-connect, clean teardown)
 *   failed       = we tried and it broke; the user is stuck unless they retry
 * Without this split, a broken WebSocket is indistinguishable from a user who
 * simply wasn't interested — both produce a zero-message conversation.
 */
type AgentState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "failed";

/** Which kind of failure, so the copy can be accurate. */
type FailureKind = "connect" | "dropped" | null;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_AGENT = {
  agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
  name: "Transport Assistant",
  description: "CryoFuture specimen transport support",
};

/** CryoFuture brand colors used by the animated orb */
const ORB_COLORS: [string, string] = ["#58B7BD", "#4E95BB"];

/**
 * Fire-and-forget analytics. Uses PostHog if it has been installed on the page,
 * otherwise logs to the console so events can be verified in DevTools today.
 * Never pass message content here — counts, lengths and timings only.
 */
function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const ph = (window as unknown as { posthog?: { capture?: (e: string, p?: unknown) => void } })
    .posthog;
  if (ph?.capture) ph.capture(event, props);
  else console.debug("[analytics]", event, props);
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [failureKind, setFailureKind] = useState<FailureKind>(null);
  const [textInput, setTextInput] = useState("");
  const [composerEngaged, setComposerEngaged] = useState(false);

  // Placeholder dynamic variable (you said tools will overwrite later)
  const contactIdPlaceholder = "1234";

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const keepaliveRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connectStartedAt = useRef(0);
  const userMsgCount = useRef(0);

  const conversation = useConversation({
    textOnly: true,
    onMessage: (message) => {
      if (message.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: message.source === "user" ? "user" : "assistant",
            content: message.message,
          },
        ]);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);

      // Read this BEFORE resetting it: if a session had already gone live,
      // this is a mid-conversation drop, not a failure to dial out.
      const wasLive = sessionStartedRef.current;

      startingRef.current = false;
      sessionStartedRef.current = false;

      if (mountedRef.current) {
        setFailureKind(wasLive ? "dropped" : "connect");
        setAgentState("failed");
      }

      const errorName = (error as { name?: string })?.name ?? "unknown";
      track(wasLive ? "chat_connection_lost" : "chat_connect_failed", {
        reason: errorName,
        user_messages: userMsgCount.current,
      });
    },
  });

  const startTextSession = useCallback(async () => {
    if (startingRef.current) return;
    if (agentState === "connecting" || agentState === "connected") return;

    startingRef.current = true;
    connectStartedAt.current = performance.now();
    setFailureKind(null);
    setAgentState("connecting");
    track("chat_connect_attempted");

    try {
      await conversation.startSession({
        agentId: DEFAULT_AGENT.agentId,
        connectionType: "websocket",
        dynamicVariables: {
          contactId: contactIdPlaceholder,
        },
        onStatusChange: (status) => {
          if (!mountedRef.current) return;

          if (status.status === "connected") {
            sessionStartedRef.current = true;
            startingRef.current = false;
            setFailureKind(null);
            setAgentState("connected");
            track("chat_connected", {
              ms_to_connect: Math.round(performance.now() - connectStartedAt.current),
            });
            return;
          }

          if (status.status === "disconnected") {
            const wasLive = sessionStartedRef.current;
            sessionStartedRef.current = false;
            startingRef.current = false;

            if (wasLive) {
              // The line was open and went away on its own — treat as a drop,
              // not as a normal idle state, so the user gets a way back.
              setFailureKind("dropped");
              setAgentState("failed");
              track("chat_connection_lost", {
                reason: "status_disconnected",
                user_messages: userMsgCount.current,
              });
              return;
            }

            setAgentState("disconnected");
            return;
          }

          setAgentState(status.status as AgentState);
        },
      });

      startingRef.current = false;
    } catch (e) {
      startingRef.current = false;
      sessionStartedRef.current = false;

      if (mountedRef.current) {
        setFailureKind("connect");
        setAgentState("failed");
      }

      const errName = (e as { name?: string })?.name ?? "unknown";
      track("chat_connect_failed", {
        reason: errName,
        ms_elapsed: Math.round(performance.now() - connectStartedAt.current),
      });
      console.error("startSession failed:", e);
    }
  }, [agentState, conversation, contactIdPlaceholder]);

  /** Manual recovery. Before this existed, a failure was permanent until reload. */
  const handleRetry = useCallback(() => {
    track("chat_retry_clicked", { failure_kind: failureKind });
    setFailureKind(null);
    setAgentState("disconnected");
    startTextSession();
  }, [failureKind, startTextSession]);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    startTextSession();

    return () => {
      mountedRef.current = false;
      // Only end if we actually started; avoid cancelling during connection in dev
      if (sessionStartedRef.current) {
        conversation.endSession().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keepalive mechanism to prevent connection timeout
  useEffect(() => {
    if (agentState === "connected") {
      keepaliveRef.current = setInterval(() => {
        conversation.sendUserActivity();
      }, 120000); // Every 2 minutes
    }

    if (agentState !== "connected" && keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = undefined;
    }

    return () => {
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
      }
    };
  }, [agentState, conversation]);

  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    if (agentState !== "connected") return;

    setTextInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    conversation.sendUserMessage(trimmed);

    userMsgCount.current += 1;
    track("chat_message_sent", {
      message_index: userMsgCount.current,
      message_length: trimmed.length, // length only — never the text itself
    });
  }, [textInput, agentState, conversation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const isTransitioning =
    agentState === "connecting" || agentState === "disconnecting";
  const isConnected = agentState === "connected";
  const hasFailed = agentState === "failed";

  return (
    // overflow-x-clip, not overflow-hidden: a vertical overflow box here makes
    // anchor scrolling target <main> instead of the window, which traps the
    // page and hides the top of the chat card on mobile.
    <main className="relative min-h-screen overflow-x-clip bg-cf-mist">
      {/* Decorative layer. Clipped and absolutely positioned so the blurred
          orbs never extend the document height or create a scroll container. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Layered brand gradient field behind the glass panels */}
        <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_15%_-10%,#DDE9F4_0%,#F2F8FD_45%,#F9FCFF_100%)]" />
        <div className="absolute -top-40 -left-24 size-[34rem] rounded-full bg-cf-teal/20 blur-[110px]" />
        <div className="absolute top-1/3 -right-32 size-[32rem] rounded-full bg-cf-blue/20 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 size-[28rem] rounded-full bg-cf-steel/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 pb-6 sm:px-8 lg:py-7 xl:py-9">
        {/* Page header. Sticky and compact on mobile so the chat stays in view. */}
        <header className="sticky top-0 z-20 -mx-5 flex shrink-0 items-center justify-between gap-3 border-b border-white/50 bg-cf-mist/85 px-5 py-2.5 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:justify-start lg:gap-5 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          <Image
            src="/cryofuture-logo-navy.svg"
            alt="CryoFuture"
            width={214}
            height={40}
            priority
            className="h-[26px] w-auto sm:h-[32px] lg:h-[52px]"
          />

          <span className="rounded-full border border-white/60 bg-white/50 px-2.5 py-0.5 text-[9px] font-medium tracking-[0.1em] text-cf-ocean uppercase backdrop-blur-md sm:text-[10px] lg:px-3 lg:py-1 lg:text-[11px] lg:tracking-[0.12em]">
            Cryotransportation
          </span>
        </header>

        {/* Spacer */}
        <div aria-hidden className="h-4 shrink-0 sm:h-5 lg:h-7" />

        <section className="mx-auto mb-4 w-full max-w-[900px] sm:mb-5">
          <p className="mb-2 hidden text-[9px] font-medium tracking-[0.19em] text-cf-ocean uppercase sm:block">
            Secure specimen logistics
          </p>
          <h1 className="text-[clamp(1.5rem,3vw,2.35rem)] leading-tight font-light text-cf-navy">
            Start your transport request in the{" "}
            <span className="font-medium text-cf-ocean">chat below</span>
          </h1>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed font-light text-cf-slate sm:text-sm">
            Our transport assistant can set up a new request or pick up an
            existing quote. Most conversations take just a few minutes.
          </p>
        </section>

        <div className="flex min-h-0 flex-1 items-stretch">
          <div className="mx-auto grid w-full max-w-[900px] min-h-0 grid-cols-1 items-stretch gap-8 lg:gap-12">
          {/* Benefits dashboard. Kept below the chat at every width. */}
          <BenefitsPanel id="service-features" className="order-2" />

          {/* Chat widget. Tablet-style centered placement now applies on desktop too. */}
          <div className="order-1 flex h-full min-h-0 w-full flex-col gap-3">
            <Card className="cf-chat-frame flex h-[calc(100dvh-13.5rem)] min-h-[420px] w-full flex-col gap-0 overflow-hidden rounded-[1.8rem] border-[4px] bg-white/70 py-0 shadow-[0_26px_78px_-22px_rgba(33,72,102,0.48)] backdrop-blur-2xl sm:h-[calc(100dvh-14rem)] lg:h-[clamp(640px,70vh,760px)] lg:min-h-[640px]">
              {/* One shared navy token joins the banner and frame without seams. */}
              <CardHeader className="cf-chat-header relative flex shrink-0 flex-row items-center justify-between gap-2 rounded-none px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
                <div className="cf-chat-brand flex min-w-0 items-center gap-2 sm:gap-3">
                  <Image
                    src="/cryofuture-logo-white.svg"
                    alt="CryoFuture"
                    width={214}
                    height={40}
                    priority
                    className="cf-chat-logo h-auto w-[94px] sm:w-[126px]"
                  />
                  <span aria-hidden className="h-5 w-px shrink-0 bg-white/40 sm:h-6" />
                  <span className="cf-chat-title whitespace-nowrap text-[9px] font-light text-white sm:text-xs">
                    {DEFAULT_AGENT.name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-2 py-1.5 backdrop-blur-md sm:gap-2 sm:px-3">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full transition-all duration-300",
                      isConnected &&
                        "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
                      isTransitioning && "animate-pulse bg-amber-300",
                      !isConnected &&
                        !isTransitioning &&
                        "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                    )}
                  />
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-[9px] font-light tracking-wide text-white sm:text-[11px]"
                  >
                    {isConnected
                      ? "Connected"
                      : isTransitioning
                      ? "Connecting"
                      : hasFailed
                      ? "Connection lost"
                      : "Offline"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 overflow-hidden bg-white/55 p-0">
                <Conversation className="cf-scroll h-full">
                  <ConversationContent className="flex min-w-0 flex-col gap-1 p-5 pb-2">
                    {messages.length === 0 ? (
                      <ConversationEmptyState
                        className="gap-4"
                        icon={
                          <div className="size-16 overflow-hidden rounded-full">
                            <Orb className="h-full w-full" colors={ORB_COLORS} />
                          </div>
                        }
                        title={
                          <span className="text-base font-medium text-cf-navy">
                            {isTransitioning
                              ? "Connecting you now"
                              : hasFailed
                              ? "We couldn't reach the assistant"
                              : "How can we help with your transport?"}
                          </span>
                        }
                        description={
                          <span className="mx-auto block max-w-[320px] text-sm leading-relaxed font-light text-cf-slate">
                            {isTransitioning
                              ? "One moment while we bring up your session."
                              : hasFailed
                              ? "Tap Retry below, or call our team at (650) 262-7464."
                              : "Ask about scheduling a shipment, tracking a specimen in transit, or transport requirements."}
                          </span>
                        }
                      />
                    ) : (
                      messages.map((m, idx) => (
                        <div key={idx} className="flex w-full flex-col gap-1">
                          <Message from={m.role}>
                            <MessageContent className="max-w-full min-w-0">
                              {/* Use Response (markdown/links) only for assistant to avoid Streamdown link-safety
                                  injecting invalid HTML for user-entered emails/links. */}
                              {m.role === "assistant" ? (
                                <Response className="w-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
                                  {m.content}
                                </Response>
                              ) : (
                                <div className="w-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                  {m.content}
                                </div>
                              )}
                            </MessageContent>
                          </Message>
                        </div>
                      ))
                    )}
                  </ConversationContent>

                  <ConversationScrollButton className="border-white/60 bg-white/80 text-cf-navy backdrop-blur-md hover:bg-white hover:text-cf-navy" />
                </Conversation>
              </CardContent>

              <CardFooter className="shrink-0 flex-col items-stretch gap-2 border-t border-white/50 bg-white/75 px-4 pt-3 pb-4 backdrop-blur-xl sm:px-5">
                <div className="relative pt-9">
                  {!composerEngaged && (
                    <div
                      role="note"
                      className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-cf-navy bg-white px-4 py-1.5 text-[11px] font-medium tracking-[0.02em] text-cf-navy shadow-[0_8px_22px_-10px_rgba(33,72,102,0.65)] sm:text-xs"
                    >
                      Start Chatting Here
                      <span
                        aria-hidden
                        className="absolute -bottom-[6px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-cf-navy bg-white"
                      />
                    </div>
                  )}

                  <div
                    className={cn(
                      "cf-composer-guide relative flex w-full items-center gap-2 rounded-full border-2 bg-white py-1 pr-1 pl-2 shadow-[0_4px_18px_-7px_rgba(33,72,102,0.32)] transition-colors focus-within:border-cf-blue",
                      composerEngaged
                        ? "border-cf-blue/55"
                        : "is-attention border-[#6f9fbd]"
                    )}
                  >
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setComposerEngaged(true)}
                    onPointerDown={() => setComposerEngaged(true)}
                    aria-label="Message the CryoFuture transport assistant"
                    placeholder={
                      isConnected
                        ? "Type your message here to get started…"
                        : hasFailed
                        ? failureKind === "dropped"
                          ? "Connection lost — tap Retry to continue"
                          : "Couldn't connect — tap Retry, or call us below"
                        : "Connecting to the assistant..."
                    }
                    className="h-10 border-0 bg-transparent text-sm font-light text-cf-navy shadow-none placeholder:text-cf-slate/70 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                    disabled={!isConnected}
                  />

                  {hasFailed ? (
                    <Button
                      onClick={handleRetry}
                      className="h-9 shrink-0 rounded-full bg-cf-navy px-4 text-xs font-medium text-white transition-colors hover:bg-cf-ocean"
                    >
                      Retry
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendText}
                      size="icon"
                      className="size-9 shrink-0 rounded-full bg-cf-navy text-white transition-colors hover:bg-cf-ocean disabled:bg-cf-pale disabled:text-cf-slate"
                      disabled={!textInput.trim() || !isConnected}
                    >
                      <SendIcon className="size-4" />
                      <span className="sr-only">Send message</span>
                    </Button>
                  )}
                  </div>
                </div>

                <p className="px-1 text-center text-[9.5px] leading-[1.4] font-light text-cf-slate/90">
                  By continuing, you consent to receive service-related
                  communications, including calls, SMS, and emails, from
                  CryoFuture. Msg &amp; data rates may apply.{" "}
                  <a
                    className="underline decoration-cf-blue/40 underline-offset-2 transition-colors hover:text-cf-ocean hover:decoration-cf-ocean"
                    href="https://cryofuture.com/privacy-policy/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View our Privacy Policy
                  </a>
                </p>
              </CardFooter>
            </Card>

            {/* Speak to a live team member */}
            <a
              href="tel:+16502627464"
              className="group flex w-full items-center justify-center gap-3 rounded-full border border-white/70 bg-white/60 px-4 py-2.5 shadow-[0_8px_28px_-14px_rgba(33,72,102,0.3)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cf-blue/50 hover:bg-white/80 sm:px-5 sm:py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cf-navy text-white shadow-[0_4px_12px_-4px_rgba(33,72,102,0.55)] sm:size-9">
                <PhoneIcon className="size-4" strokeWidth={2} />
              </span>

              <span className="flex flex-col">
                {/* Condensed on mobile to save vertical space */}
                <span className="text-[13px] leading-snug font-light text-cf-navy">
                  <span className="hidden sm:inline">
                    Prefer to speak with someone? Call our Transportation team
                    at{" "}
                  </span>
                  <span className="sm:hidden">Call our team at </span>
                  <span className="font-medium whitespace-nowrap text-cf-ocean underline decoration-cf-blue/30 underline-offset-2 group-hover:decoration-cf-blue">
                    (650) 262-7464
                  </span>
                </span>
                <span className="text-[11px] leading-snug font-light text-cf-slate">
                  <span className="hidden sm:inline">
                    Monday to Friday, 9am to 8pm ET
                  </span>
                  <span className="sm:hidden">M-F, 9am to 8pm ET</span>
                </span>
              </span>
            </a>

            {/* Mobile only: scroll cue down to the service features */}
            <a
              href="#service-features"
              className="group flex w-full items-center justify-center gap-2 rounded-full border border-cf-blue/25 bg-white/40 px-4 py-2.5 text-[13px] font-light text-cf-ocean backdrop-blur-xl transition-colors duration-300 hover:border-cf-blue/50 hover:bg-white/60"
            >
              Learn more about our transport care
              <ChevronDownIcon
                className="size-4 transition-transform duration-300 group-hover:translate-y-0.5"
                strokeWidth={2}
              />
            </a>
          </div>
          </div>
        </div>

        {/* Page footer */}
        <footer className="relative w-full shrink-0 pt-6 pb-5 lg:pt-5 lg:pb-0">
          <p className="text-center text-[11px] font-light text-neutral-400">
            © {new Date().getFullYear()} CryoFuture, Inc. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
