"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { SendIcon } from "lucide-react";

import { cn } from "@/lib/utils";
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

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_AGENT = {
  agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
  name: "CryoFuture Transport Agent",
  description: "AI Assistant",
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [textInput, setTextInput] = useState("");

  // Placeholder dynamic variable (you said tools will overwrite later)
  const contactIdPlaceholder = "1234";

  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const sessionStartedRef = useRef(false);

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
      // Only end if we actually started; avoid cancelling during connection in dev
      if (sessionStartedRef.current) {
        conversation.endSession().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const newRequest = useCallback(async () => {
    setMessages([]);
    setTextInput("");

    setAgentState("disconnecting");
    try {
      await conversation.endSession();
    } catch {}

    sessionStartedRef.current = false;
    startingRef.current = false;
    setAgentState("disconnected");

    // start fresh
    startTextSession();
  }, [conversation, startTextSession]);

  const isTransitioning =
    agentState === "connecting" || agentState === "disconnecting";
  const isConnected = agentState === "connected";

  return (
    <main className="mx-auto flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card
        className={cn(
          "flex h-[720px] w-full max-w-[580px] flex-col overflow-hidden shadow-xl"
        )}
      >
        <CardHeader className="flex shrink-0 flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <div className="ring-border relative size-10 overflow-hidden rounded-full ring-1">
              <Orb className="h-full w-full" />
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium leading-none">
                {DEFAULT_AGENT.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {isConnected
                  ? "Connected"
                  : isTransitioning
                    ? "Connecting..."
                    : "Starting..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={newRequest}
              className="rounded-md border px-3 py-1 text-sm"
              disabled={isTransitioning}
            >
              New request
            </button>

            <div
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                isConnected &&
                  "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
                isTransitioning && "animate-pulse bg-white/40",
                !isConnected && !isTransitioning && "bg-muted-foreground/40"
              )}
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <Conversation className="h-full">
            <ConversationContent className="flex min-w-0 flex-col gap-2 p-6 pb-2">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<Orb className="size-12" />}
                  title={
                    isTransitioning
                      ? "Starting conversation"
                      : "Start a conversation"
                  }
                  description={
                    isTransitioning
                      ? "Connecting..."
                      : "The agent will greet you automatically."
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

                      {/* Orb next to assistant messages (like the example screenshot) */}
                      {m.role === "assistant" && (
                        <div className="ring-border size-7 flex-shrink-0 self-end overflow-hidden rounded-full ring-1">
                          <Orb className="h-full w-full" />
                        </div>
                      )}
                    </Message>
                  </div>
                ))
              )}
            </ConversationContent>

            <ConversationScrollButton />
          </Conversation>
        </CardContent>

        <CardFooter className="shrink-0 border-t">
          <div className="flex w-full items-center gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={!isConnected}
            />

            <Button
              onClick={handleSendText}
              size="icon"
              variant="ghost"
              className="rounded-full"
              disabled={!textInput.trim() || !isConnected}
            >
              <SendIcon className="size-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}





