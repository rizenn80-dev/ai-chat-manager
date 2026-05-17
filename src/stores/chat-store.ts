import { create } from "zustand";
import {
  createEmptyChat,
  createWelcomeMessage,
  deriveTitle,
  hasUserMessages,
  loadChatStorage,
  newChatId,
  saveChatStorage,
  sortChatsByRecent,
  type SavedChat,
} from "@/lib/chat-storage";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  createdAt: number;
};

type ChatState = {
  hydrated: boolean;
  chats: SavedChat[];
  activeChatId: string;
  messages: ChatMessage[];
  title: string;
  isResponding: boolean;
  error: string | null;
  hydrate: () => void;
  selectChat: (id: string) => void;
  newChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  persistActiveChat: () => void;
};

function snapshotActiveChat(state: ChatState): SavedChat {
  return {
    id: state.activeChatId,
    title: state.title,
    messages: state.messages,
    createdAt:
      state.chats.find((c) => c.id === state.activeChatId)?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

function upsertChat(chats: SavedChat[], chat: SavedChat): SavedChat[] {
  const index = chats.findIndex((c) => c.id === chat.id);
  if (index === -1) return sortChatsByRecent([chat, ...chats]);
  const next = [...chats];
  next[index] = chat;
  return sortChatsByRecent(next);
}

function dropEmptyChats(chats: SavedChat[], keepId: string): SavedChat[] {
  return chats.filter(
    (c) => c.id === keepId || hasUserMessages(c.messages),
  );
}

function writeStorage(chats: SavedChat[], activeChatId: string) {
  saveChatStorage({ chats, activeChatId });
}

export const useChatStore = create<ChatState>()((set, get) => ({
  hydrated: false,
  chats: [],
  activeChatId: "",
  messages: [createWelcomeMessage()],
  title: "New Chat",
  isResponding: false,
  error: null,

  hydrate: () => {
    if (get().hydrated) return;

    let stored = loadChatStorage();

    if (!stored && typeof window !== "undefined") {
      try {
        const legacyRaw = localStorage.getItem("ai-chat-manager:conversation");
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as {
            messages?: ChatMessage[];
            title?: string;
          };
          if (legacy.messages?.length) {
            const migrated = createEmptyChat();
            migrated.messages = legacy.messages;
            migrated.title = legacy.title ?? migrated.title;
            migrated.updatedAt = Date.now();
            stored = { chats: [migrated], activeChatId: migrated.id };
            writeStorage(stored.chats, stored.activeChatId);
            localStorage.removeItem("ai-chat-manager:conversation");
          }
        }
      } catch {
        // ignore corrupt legacy storage
      }
    }

    if (stored && stored.chats.length > 0) {
      const active =
        stored.chats.find((c) => c.id === stored.activeChatId) ?? stored.chats[0];
      set({
        hydrated: true,
        chats: sortChatsByRecent(stored.chats),
        activeChatId: active.id,
        messages: active.messages,
        title: active.title,
        isResponding: false,
        error: null,
      });
      return;
    }

    const initial = createEmptyChat();
    set({
      hydrated: true,
      chats: [initial],
      activeChatId: initial.id,
      messages: initial.messages,
      title: initial.title,
      isResponding: false,
      error: null,
    });
    writeStorage([initial], initial.id);
  },

  persistActiveChat: () => {
    const state = get();
    if (!state.activeChatId) return;

    const snapshot = snapshotActiveChat(state);
    const chats = upsertChat(state.chats, snapshot);
    writeStorage(chats, state.activeChatId);
    set({ chats });
  },

  selectChat: (id) => {
    const state = get();
    if (id === state.activeChatId || state.isResponding) return;

    const snapshot = snapshotActiveChat(state);
    let chats = dropEmptyChats(upsertChat(state.chats, snapshot), id);

    const target = chats.find((c) => c.id === id);
    if (!target) return;

    writeStorage(chats, id);
    set({
      chats,
      activeChatId: id,
      messages: target.messages,
      title: target.title,
      error: null,
    });
  },

  newChat: () => {
    const state = get();
    if (state.isResponding) return;

    let chats = state.chats;
    if (hasUserMessages(state.messages)) {
      chats = upsertChat(chats, snapshotActiveChat(state));
    }

    const chat = createEmptyChat();
    chats = dropEmptyChats(
      sortChatsByRecent([chat, ...chats.filter((c) => c.id !== chat.id)]),
      chat.id,
    );
    writeStorage(chats, chat.id);

    set({
      chats,
      activeChatId: chat.id,
      messages: chat.messages,
      title: chat.title,
      isResponding: false,
      error: null,
    });
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().isResponding) return;

    const userMsg: ChatMessage = {
      id: newChatId(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const placeholderId = newChatId();
    const placeholder: ChatMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      pending: true,
      createdAt: Date.now(),
    };

    const hadUserMessage = get().messages.some((m) => m.role === "user");

    set((s) => ({
      messages: [...s.messages, userMsg, placeholder],
      isResponding: true,
      error: null,
      title: hadUserMessage ? s.title : deriveTitle(trimmed),
    }));

    const history = get()
      .messages.filter((m) => m.id !== placeholderId && m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    const finish = (updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      set((s) => {
        const messages = updater(s.messages);
        const snapshot = snapshotActiveChat({
          ...s,
          messages,
          isResponding: false,
        });
        const chats = upsertChat(s.chats, snapshot);
        writeStorage(chats, s.activeChatId);
        return { messages, isResponding: false, chats };
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === placeholderId ? { ...m, content: acc, pending: false } : m,
          ),
        }));
      }

      finish((messages) =>
        messages.map((m) =>
          m.id === placeholderId
            ? { ...m, content: acc || "(no response)", pending: false }
            : m,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      set((s) => ({ error: message }));
      finish((messages) =>
        messages.map((m) =>
          m.id === placeholderId
            ? { ...m, content: `⚠️ ${message}`, pending: false }
            : m,
        ),
      );
    }
  },
}));
