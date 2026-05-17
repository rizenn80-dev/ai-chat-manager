import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getServerEnv } from "@/lib/env";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatRequestBody = { messages?: ChatMessage[] };

const SYSTEM_PROMPT =
  "You are AI Chat Manager, an assistant for a shoe store. Help with inventory, sales, customers, and restocking. Be concise and actionable.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { OPENAI_API_KEY } = getServerEnv();
        const apiKey = process.env.LOVABLE_API_KEY ?? OPENAI_API_KEY ?? undefined;
        if (!apiKey) {
          return new Response(
            "AI is not configured. Set OPENAI_API_KEY in .env.local or LOVABLE_API_KEY.",
            { status: 500 },
          );
        }

        let body: ChatRequestBody;
        try {
          body = (await request.json()) as ChatRequestBody;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const messages = body.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages array required", { status: 400 });
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Lovable-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text().catch(() => "");
          if (upstream.status === 429) {
            return new Response("Rate limit reached. Please try again in a moment.", { status: 429 });
          }
          if (upstream.status === 402) {
            return new Response("AI credits exhausted. Add credits in Settings → Workspace → Usage.", { status: 402 });
          }
          return new Response(errText || "Upstream error", { status: upstream.status });
        }

        // Transform OpenAI SSE -> plain text token stream for easy client consumption.
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") {
                    controller.close();
                    return;
                  }
                  try {
                    const json = JSON.parse(payload);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // ignore malformed chunk
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
