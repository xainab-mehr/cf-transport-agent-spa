"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { SendIcon, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_AGENT = {
  agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
  name: "CryoFuture Support",
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
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="flex h-[600px] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#1a1a2e] px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">{DEFAULT_AGENT.name}</h1>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected && "bg-green-400",
                  isTransitioning && "animate-pulse bg-yellow-400",
                  !isConnected && !isTransitioning && "bg-gray-400"
                )}
              />
              <span className="text-xs text-gray-300">
                {isConnected ? "Online" : isTransitioning ? "Connecting..." : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1a2e]">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-gray-800">
                {isTransitioning ? "Connecting..." : "Hi there! 👋"}
              </h2>
              <p className="max-w-[280px] text-sm text-gray-500">
                {isTransitioning
                  ? "Please wait while we connect you."
                  : "How can we help you today? Send us a message and we'll get back to you as soon as possible."}
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
                        ? "rounded-br-md bg-[#1a1a2e] text-white"
                        : "rounded-bl-md bg-white text-gray-800 shadow-sm border border-gray-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          {/* Callout arrow */}
          <div className="mb-3 flex items-center justify-center gap-2 text-sm text-[#1a1a2e]">
            <span className="font-medium">Type here and book your transportation quote</span>
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
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              disabled={!isConnected}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-[#1a1a2e] focus:bg-white disabled:opacity-50"
            />
            <button
              onClick={handleSendText}
              disabled={!textInput.trim() || !isConnected}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a1a2e] text-white transition-colors hover:bg-[#2a2a4e] disabled:opacity-50 disabled:hover:bg-[#1a1a2e]"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-400">
            Powered by CryoFuture
          </p>
        </div>
      </div>
    </main>
  );
}
