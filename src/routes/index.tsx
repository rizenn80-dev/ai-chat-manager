import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Footprints,
  Plus,
  Copy,
  Check,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatSidebar, ChatSidebarMobile } from "@/components/chat-sidebar";
import { useChatStore, type ChatMessage } from "@/stores/chat-store";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "AI Chat Manager — Shoe Store Assistant" },
      {
        name: "description",
        content:
          "AI Chat Manager for shoe store operations: inventory, sales, and customer support in one conversational interface.",
      },
    ],
  }),
});

const SUGGESTIONS = [
  "Show today's top selling sneakers",
  "Check stock for Nike Air Max size 10",
  "Summarize this week's revenue",
  "Draft a restock order for Adidas",
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Index() {
  const messages = useChatStore((s) => s.messages);
  const title = useChatStore((s) => s.title);
  const isResponding = useChatStore((s) => s.isResponding);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const newChat = useChatStore((s) => s.newChat);
  const { theme, toggle } = useTheme();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendMessage(text);
    setInput("");
  };

  return (
    <div className="flex h-dvh bg-gradient-to-b from-background to-muted/30">
      <ChatSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3 sm:py-4">
          <ChatSidebarMobile />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Footprints className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold leading-tight sm:text-base">
              AI Chat Manager
            </h1>
            <p className="truncate text-xs text-muted-foreground">{title}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            className="h-9 w-9"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={newChat}
            disabled={isResponding}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-3 sm:px-4">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="space-y-5 py-6 sm:space-y-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isResponding &&
              !messages.some((m) => m.pending) && (
                <div className="flex gap-3">
                  <Avatar role="assistant" />
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}
          </div>
        </div>

        {messages.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="sticky bottom-0 mb-3 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg shadow-primary/5 sm:mb-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory, sales, customers…"
            className="border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isResponding}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </main>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-gradient-to-br from-muted to-muted/60 text-foreground ring-1 ring-border",
      )}
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "group flex gap-2.5 sm:gap-3",
        isUser && "flex-row-reverse",
      )}
    >
      <Avatar role={message.role} />
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]",
          isUser && "items-end",
        )}
      >
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card text-card-foreground ring-1 ring-border",
          )}
        >
          {message.pending && !message.content ? (
            <TypingDots />
          ) : (
            message.content
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-2 px-1 text-[11px] text-muted-foreground",
            isUser && "flex-row-reverse",
          )}
        >
          <span suppressHydrationWarning>{formatTime(message.createdAt)}</span>
          {!isUser && !message.pending && message.content && (
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 opacity-0 transition hover:bg-accent hover:text-accent-foreground focus:opacity-100 group-hover:opacity-100"
              aria-label="Copy message"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}
