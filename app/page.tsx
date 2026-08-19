"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { SendIcon, PhoneIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/orb";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// DEV AGENT ID - DO NOT USE IN PRODUCTION/MAIN BRANCH
const DEV_AGENT_ID = "agent_0301kkymy67pf3rt3nakjmaevbxc";

const ORB_COLORS: [string, string] = ["#58B7BD", "#4E95BB"];

const QUICK_ACTIONS = [
  "Get a transport quote",
  "Track a shipment",
  "Packaging & dry ice",
];

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [textInput, setTextInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const contactIdPlaceholder = "1234";

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const keepaliveRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
        agentId: DEV_AGENT_ID,
        connectionType: "websocket",
        dynamicVariables: {
          contactId: contactIdPlaceholder,
        },
        onStatusChange: (status) => {
          if (!mountedRef.current) return;
          setAgentState(status.status as AgentState);

          if (status.status === "connected") {
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
      if (sessionStartedRef.current) {
        conversation.endSession().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keepalive
  useEffect(() => {
    if (agentState === "connected") {
      keepaliveRef.current = setInterval(() => {
        conversation.sendUserActivity();
      }, 120000);
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = useCallback((text?: string) => {
    const messageText = text || textInput.trim();
    if (!messageText) return;
    if (agentState !== "connected") return;

    setTextInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    conversation.sendUserMessage(messageText);
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

  const handleQuickAction = (action: string) => {
    handleSendText(action);
  };

  const isTransitioning = agentState === "connecting" || agentState === "disconnecting";
  const isConnected = agentState === "connected";

  return (
    <main className="flex min-h-screen flex-col bg-cf-mist">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-8">
        <Image
          src="/cryofuture-logo-navy.svg"
          alt="CryoFuture"
          width={160}
          height={32}
          priority
          className="h-6 w-auto sm:h-8"
        />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]",
              isTransitioning && "animate-pulse bg-amber-400",
              !isConnected && !isTransitioning && "bg-gray-400"
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wider text-cf-slate">
            {isConnected ? "Agent Online" : isTransitioning ? "Connecting" : "Offline"}
          </span>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Messages or empty state */}
        <div className="cf-scroll flex-1 overflow-y-auto px-6 sm:px-8">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center pb-32">
              {/* Orb icon */}
              <div className="mb-6 h-16 w-16 overflow-hidden rounded-full sm:h-20 sm:w-20">
                <Orb className="h-full w-full" colors={ORB_COLORS} />
              </div>

              {/* Greeting */}
              <h1 className="mb-3 text-2xl font-light text-cf-navy sm:text-3xl">
                How can I help?
              </h1>
              <p className="mb-8 max-w-md text-center text-sm font-light leading-relaxed text-cf-slate sm:text-base">
                Get a quote for your transportation or ask questions about your transportation here
              </p>

              {/* Quick action pills */}
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleQuickAction(action)}
                    disabled={!isConnected}
                    className="rounded-full border border-cf-pale bg-white px-4 py-2 text-sm font-light text-cf-navy shadow-sm transition-all hover:border-cf-blue hover:shadow-md disabled:opacity-50"
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Type here callout */}
              <div className="flex items-center gap-2 rounded-full bg-cf-teal px-4 py-2 text-sm font-medium text-white">
                Type your message here
                <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl py-6">
              <div className="flex flex-col gap-4">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%]",
                        m.role === "user"
                          ? "rounded-br-md bg-cf-navy text-white"
                          : "rounded-bl-md border border-cf-pale bg-white text-cf-navy shadow-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words font-light leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input area - pinned to bottom */}
        <div className="border-t border-cf-pale bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Ask about pricing, routes, or your shipment..." : "Connecting..."}
                disabled={!isConnected}
                className="flex-1 rounded-full border border-cf-pale bg-cf-mist px-5 py-3 text-sm font-light text-cf-navy placeholder-cf-slate/60 outline-none transition-all focus:border-cf-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(78,149,187,0.1)] disabled:opacity-50"
              />
              <button
                onClick={() => handleSendText()}
                disabled={!textInput.trim() || !isConnected}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-cf-teal text-white shadow-md transition-all hover:bg-cf-ocean hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Phone link */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <PhoneIcon className="h-4 w-4 text-cf-slate" />
              <span className="font-light text-cf-slate">
                Prefer to speak with someone? Call our Transportation team at{" "}
                <a href="tel:+16502627464" className="font-medium text-cf-ocean underline decoration-cf-blue/30 underline-offset-2 hover:decoration-cf-blue">
                  (650) 262-7464
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
