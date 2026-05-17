import { z } from "zod";

const urlSchema = z.string().url();
const keySchema = z.string().min(1, "must not be empty");

const openAiKeySchema = z
  .string()
  .min(1, "must not be empty")
  .refine((v) => v.startsWith("sk-"), "must start with sk-")
  .refine(
    (v) => !/replace|your-openai|example/i.test(v),
    "replace the placeholder with a real OpenAI API key",
  );

const serverEnvSchema = z
  .object({
    SUPABASE_URL: urlSchema,
    SUPABASE_ANON_KEY: keySchema,
    OPENAI_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLovable = Boolean(process.env.LOVABLE_API_KEY?.trim());
    if (hasLovable) return;

    const result = openAiKeySchema.safeParse(data.OPENAI_API_KEY);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ["OPENAI_API_KEY"] });
      }
    }
  });

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: urlSchema,
  VITE_SUPABASE_ANON_KEY: keySchema,
});

export type ServerEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  OPENAI_API_KEY: string | undefined;
};
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function firstDefined(getter: (key: string) => string | undefined, keys: string[]) {
  for (const key of keys) {
    const value = getter(key);
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function formatZodError(error: z.ZodError, label: string): string {
  const details = error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return `Invalid ${label} environment:\n${details}\n\nCopy .env.example to .env.local and set the required variables.`;
}

function parseEnv<T>(
  schema: z.ZodSchema<T>,
  raw: Record<string, string | undefined>,
  label: string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(formatZodError(result.error, label));
  }
  return result.data;
}

function loadServerRaw(): Record<string, string | undefined> {
  const fromProcess = (key: string) => process.env[key];
  return {
    SUPABASE_URL: firstDefined(fromProcess, ["SUPABASE_URL", "VITE_SUPABASE_URL"]),
    SUPABASE_ANON_KEY: firstDefined(fromProcess, [
      "SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]),
    OPENAI_API_KEY: firstDefined(fromProcess, ["OPENAI_API_KEY"]),
  };
}

function loadClientRaw(): Record<string, string | undefined> {
  const fromMeta = (key: string) => import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return {
    VITE_SUPABASE_URL: firstDefined(fromMeta, ["VITE_SUPABASE_URL"]),
    VITE_SUPABASE_ANON_KEY: firstDefined(fromMeta, [
      "VITE_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]),
  };
}

let cachedServerEnv: ServerEnv | undefined;
let cachedClientEnv: ClientEnv | undefined;

/** Validated server-only environment (Supabase + OpenAI). */
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseEnv(serverEnvSchema, loadServerRaw(), "server");
  }
  return cachedServerEnv;
}

/** Validated client-safe environment (VITE_* only). */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = parseEnv(clientEnvSchema, loadClientRaw(), "client");
  }
  return cachedClientEnv;
}

/** Fail fast when the server boots or handles a request. */
export function assertServerEnv(): ServerEnv {
  return getServerEnv();
}

/** Fail fast in the browser before creating Supabase clients. */
export function assertClientEnv(): ClientEnv {
  return getClientEnv();
}
