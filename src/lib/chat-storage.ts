import type { ChatMessage } from "@/stores/chat-store";

export type SavedChat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

type ChatStoragePayload = {
  chats: SavedChat[];
  activeChatId: string;
};

const STORAGE_KEY = "ai-chat-manager:sessions";

export const DEFAULT_CHAT_TITLE = "New Chat";

export function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Hi! I'm your AI Chat Manager for the shoe store. Ask me about inventory, sales, customers, or restocking.",
    createdAt: Date.now(),
  };
}

export function createEmptyChat(id?: string): SavedChat {
  const now = Date.now();
  return {
    id: id ?? newChatId(),
    title: DEFAULT_CHAT_TITLE,
    messages: [createWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
  };
}

export function newChatId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return DEFAULT_CHAT_TITLE;
  return clean.length > 48 ? clean.slice(0, 48) + "…" : clean;
}

export function hasUserMessages(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "user");
}

export function loadChatStorage(): ChatStoragePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatStoragePayload;
    if (!Array.isArray(parsed.chats) || !parsed.activeChatId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveChatStorage(payload: ChatStoragePayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function sortChatsByRecent(chats: SavedChat[]): SavedChat[] {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
}
