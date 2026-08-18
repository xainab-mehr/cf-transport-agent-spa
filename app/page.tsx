"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { SendIcon, MessageCircle, PhoneIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_AGENT = {
  agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
  name: "CryoFuture Transport Assistant",
};

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
        agentId: DEFAULT_AGENT.agentId,
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

  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    if (agentState !== "connected") return;

    setTextInput("");
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

  const isTransitioning = agentState === "connecting" || agentState === "disconnecting";
  const isConnected = agentState === "connected";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cf-mist px-4 py-8">
      {/* Header description - BIGGER */}
      <div className="mb-8 max-w-[500px] text-center">
        <h1 className="mb-3 text-3xl font-light text-cf-navy">
          Chat with our agent
        </h1>
        <p className="text-lg font-light leading-relaxed text-cf-slate">
          Get a quote for your transportation or ask questions about your transportation here
        </p>
      </div>

      {/* Chat widget container with arrow */}
      <div className="relative">
        {/* Arrow pointing to chat widget */}
        <div className="absolute -left-32 top-1/2 hidden -translate-y-1/2 items-center gap-2 lg:flex">
          <span className="text-sm font-medium text-cf-ocean">Start here</span>
          <svg className="h-8 w-8 text-cf-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>

        {/* Chat widget */}
        <div className="flex h-[550px] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-cf-pale bg-white shadow-[0_20px_60px_-20px_rgba(33,72,102,0.3)]">
          {/* Header */}
          <div className="flex items-center gap-3 bg-cf-navy px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-medium text-white">{DEFAULT_AGENT.name}</h2>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isConnected && "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
                    isTransitioning && "animate-pulse bg-amber-300",
                    !isConnected && !isTransitioning && "bg-gray-400"
                  )}
                />
                <span className="text-xs font-light text-white/80">
                  {isConnected ? "Online" : isTransitioning ? "Connecting..." : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="cf-scroll flex-1 overflow-y-auto bg-cf-mist p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cf-teal to-cf-blue">
                  <MessageCircle className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-light text-cf-navy">
                  {isTransitioning ? "Connecting..." : "Hi there! 👋"}
                </h3>
                <p className="max-w-[280px] text-sm font-light text-cf-slate">
                  {isTransitioning
                    ? "Please wait while we connect you to our assistant."
                    : "How can we help you today? Ask about scheduling, tracking, or transport requirements."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
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
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "rounded-br-md bg-cf-navy text-white"
                          : "rounded-bl-md border border-cf-pale bg-white text-cf-navy shadow-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words font-light">{m.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-cf-pale bg-white p-4">
            {/* Callout arrow */}
            <div className="mb-3 flex items-center justify-center gap-2 text-sm text-cf-ocean">
              <span className="font-medium">Type here to get started</span>
              <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Type your message..." : "Connecting..."}
                disabled={!isConnected}
                className="flex-1 rounded-full border border-cf-pale bg-cf-mist px-4 py-2.5 text-sm font-light text-cf-navy placeholder-cf-slate/60 outline-none transition-colors focus:border-cf-blue focus:bg-white disabled:opacity-50"
              />
              <button
                onClick={handleSendText}
                disabled={!textInput.trim() || !isConnected}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cf-navy text-white transition-colors hover:bg-cf-ocean disabled:opacity-50 disabled:hover:bg-cf-navy"
              >
                <SendIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call phone number pill */}
      <a
        href="tel:+16502627464"
        className="group mt-6 flex items-center gap-3 rounded-full border border-cf-pale bg-white px-5 py-3 shadow-[0_8px_28px_-14px_rgba(33,72,102,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:border-cf-blue/50 hover:shadow-[0_12px_32px_-12px_rgba(33,72,102,0.35)]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cf-navy text-white shadow-[0_4px_12px_-4px_rgba(33,72,102,0.55)]">
          <PhoneIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-light text-cf-navy">
            Prefer to speak with someone? Call{" "}
            <span className="font-medium text-cf-ocean underline decoration-cf-blue/30 underline-offset-2 group-hover:decoration-cf-blue">
              (650) 262-7464
            </span>
          </span>
          <span className="text-xs font-light text-cf-slate">
            Monday – Friday, 9am – 8pm ET
          </span>
        </span>
      </a>

      {/* Footer */}
      <p className="mt-6 text-xs font-light text-cf-slate">
        © {new Date().getFullYear()} CryoFuture, Inc. All rights reserved.
      </p>
    </main>
  );
}
