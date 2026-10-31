import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** "claude" calls the Anthropic API; "mock" returns canned data (UI development, no API spend). */
  AI_PROVIDER: z.enum(["claude", "mock"]).default("claude"),
  CLAUDE_MODEL: z.string().min(1).default("claude-opus-5-5"),
  /**
   * Comma-separated browser origins allowed by CORS. Native mobile apps do not need CORS;
   * this is only for Expo web / browser testing. "*" allows any origin (development only).
   */
  CORS_ORIGINS: z.string().optional(),
  /** Requests per window per client IP, across all /api routes. Every request can cost money. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  /** Number of reverse-proxy hops in front of the server (so rate limiting sees the real client IP). */
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid server configuration: ${problems}`);
  }
  return parsed.data;
}
