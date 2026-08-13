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
import {
  trackAgentConnected,
  trackChatStarted,
  trackLearnMoreClick,
  trackPhoneClick,
  trackPrivacyPolicyClick,
} from "@/lib/analytics-events";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting";

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

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [textInput, setTextInput] = useState("");

  // Placeholder dynamic variable (you said tools will overwrite later)
  const contactIdPlaceholder = "1234";

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const keepaliveRef = useRef<NodeJS.Timeout | undefined>(undefined);
  /** Guards the chat_started event so it fires once per session, not per message. */
  const chatStartedRef = useRef(false);

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
      if (mountedRef.current) setAgentState("disconnected");
      startingRef.current = false;
      sessionStartedRef.current = false;
    },
  });

  const startTextSession = useCallback(async () => {
    if (startingRef.current) return;
    if (agentState === "connecting" || agentState === "connected") return;

    startingRef.current = true;
    setAgentState("connecting");

    try {
      await conversation.startSession({
        agentId: DEFAULT_AGENT.agentId,
        connectionType: "websocket",
        dynamicVariables: {
          contactId: contactIdPlaceholder,
        },
        onStatusChange: (status) => {
          if (!mountedRef.current) return;

          setAgentState(status.status as AgentState);

          if (status.status === "connected") {
            if (!sessionStartedRef.current) trackAgentConnected();
            sessionStartedRef.current = true;
            startingRef.current = false;
          }

          if (status.status === "disconnected") {
            sessionStartedRef.current = false;
            startingRef.current = false;
          }
        },
      });

      startingRef.current = false;
    } catch (e) {
      startingRef.current = false;
      sessionStartedRef.current = false;
      if (mountedRef.current) setAgentState("disconnected");
      console.error("startSession failed:", e);
    }
  }, [agentState, conversation, contactIdPlaceholder]);

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

    // Records only that a conversation began, never the message content.
    if (!chatStartedRef.current) {
      chatStartedRef.current = true;
      trackChatStarted();
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    conversation.sendUserMessage(trimmed);
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

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 sm:px-8 lg:h-screen lg:min-h-0 lg:py-6 xl:py-8">
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
        <div aria-hidden className="h-3 shrink-0 sm:h-4 lg:h-6 xl:h-8" />

        <div className="flex min-h-0 flex-1 items-stretch">
          <div className="grid w-full min-h-0 grid-cols-1 items-stretch gap-6 lg:h-full lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[1fr_440px] lg:gap-10 xl:grid-cols-[1fr_470px] xl:gap-12">
          {/* Benefits dashboard. Left column on desktop, scroll target on mobile. */}
          <BenefitsPanel id="service-features" className="order-2 lg:order-1" />

          {/* Chat widget. Right column on desktop, first thing seen on mobile. */}
          <div className="order-1 flex h-full min-h-0 w-full flex-col gap-3 lg:order-2">
            <Card className="flex h-[calc(100dvh-11.75rem)] min-h-[340px] w-full flex-col gap-0 overflow-hidden rounded-3xl border-white/60 bg-white/70 py-0 shadow-[0_24px_70px_-24px_rgba(33,72,102,0.35)] backdrop-blur-2xl sm:h-[calc(100dvh-12.25rem)] lg:h-auto lg:min-h-0 lg:flex-1">
              {/* Solid brand navy header, matching the logo */}
              <CardHeader className="relative flex shrink-0 flex-row items-center justify-between gap-3 rounded-none border-b border-white/40 bg-cf-navy px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 [.border-b]:border-b-0">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
                />

                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-white/25 ring-1 ring-white/40">
                    <Orb className="h-full w-full" colors={ORB_COLORS} />
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <Image
                      src="/cryofuture-logo-white.svg"
                      alt="CryoFuture"
                      width={214}
                      height={40}
                      priority
                      className="h-[17px] w-auto"
                    />
                    <p className="truncate text-xs font-light text-white/85">
                      {DEFAULT_AGENT.name}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 backdrop-blur-md">
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
                    className="text-[11px] font-light tracking-wide text-white"
                  >
                    {isConnected
                      ? "Connected"
                      : isTransitioning
                      ? "Connecting"
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
                          <span className="text-base font-normal text-cf-navy">
                            {isTransitioning
                              ? "Connecting you now"
                              : "How can we help with your transport?"}
                          </span>
                        }
                        description={
                          <span className="mx-auto block max-w-[320px] text-sm leading-relaxed font-light text-cf-slate">
                            {isTransitioning
                              ? "One moment while we bring up your session."
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

              <CardFooter className="shrink-0 flex-col items-stretch gap-2 border-t border-white/50 bg-white/70 px-4 py-4 backdrop-blur-xl">
                <div className="flex w-full items-center gap-2 rounded-full border border-white/70 bg-white/80 py-1 pr-1 pl-2 shadow-[0_2px_10px_-4px_rgba(33,72,102,0.2)] transition-colors focus-within:border-cf-blue">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isConnected
                        ? "Type your message..."
                        : "Connecting to the assistant..."
                    }
                    className="h-10 border-0 bg-transparent text-sm font-light text-cf-navy shadow-none placeholder:text-cf-slate/70 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                    disabled={!isConnected}
                  />

                  <Button
                    onClick={handleSendText}
                    size="icon"
                    className="size-9 shrink-0 rounded-full bg-cf-navy text-white transition-colors hover:bg-cf-ocean disabled:bg-cf-pale disabled:text-cf-slate"
                    disabled={!textInput.trim() || !isConnected}
                  >
                    <SendIcon className="size-4" />
                    <span className="sr-only">Send message</span>
                  </Button>
                </div>

                <p className="px-1 text-center text-[9.5px] leading-[1.4] font-light text-cf-slate/90">
                  By continuing, you consent to receive service-related
                  communications, including calls, SMS, and emails, from
                  CryoFuture. Msg &amp; data rates may apply.{" "}
                  <a
                    className="underline decoration-cf-blue/40 underline-offset-2 transition-colors hover:text-cf-ocean hover:decoration-cf-ocean"
                    href="https://cryofuture.com/privacy-policy/"
                    onClick={trackPrivacyPolicyClick}
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
              onClick={trackPhoneClick}
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
              onClick={trackLearnMoreClick}
              className="group flex w-full items-center justify-center gap-2 rounded-full border border-cf-blue/25 bg-white/40 px-4 py-2.5 text-[13px] font-light text-cf-ocean backdrop-blur-xl transition-colors duration-300 hover:border-cf-blue/50 hover:bg-white/60 lg:hidden"
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
