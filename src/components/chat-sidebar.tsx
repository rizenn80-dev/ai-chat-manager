import { useEffect, useState } from "react";
import { MessageSquare, PanelLeft, Plus } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function ChatList({
  onSelect,
  className,
}: {
  onSelect?: () => void;
  className?: string;
}) {
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const selectChat = useChatStore((s) => s.selectChat);
  const newChat = useChatStore((s) => s.newChat);
  const isResponding = useChatStore((s) => s.isResponding);
  const hydrated = useChatStore((s) => s.hydrated);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-b border-border/60 p-3">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
          onClick={() => {
            newChat();
            onSelect?.();
          }}
          disabled={isResponding}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {!hydrated && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Loading chats…
            </p>
          )}
          {hydrated && chats.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No saved chats yet
            </p>
          )}
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                type="button"
                disabled={isResponding}
                onClick={() => {
                  selectChat(chat.id);
                  onSelect?.();
                }}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted/80",
                  isResponding && !isActive && "opacity-50",
                )}
              >
                <span className="flex items-center gap-2 font-medium leading-snug">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{chat.title}</span>
                </span>
                <span className="pl-5 text-[11px] text-muted-foreground">
                  {formatRelativeTime(chat.updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ChatSidebar() {
  const hydrate = useChatStore((s) => s.hydrate);
  const isMobile = useIsMobile();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isMobile) {
    return null;
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border/60 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your chats
        </h2>
      </div>
      <ChatList className="min-h-0 flex-1" />
    </aside>
  );
}

export function ChatSidebarMobile() {
  const isResponding = useChatStore((s) => s.isResponding);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          aria-label="Open chat list"
          disabled={isResponding}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-sm">Your chats</SheetTitle>
        </SheetHeader>
        <ChatList
          className="h-[calc(100%-3.5rem)]"
          onSelect={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
