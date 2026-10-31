import Anthropic from "@anthropic-ai/sdk";
import { ClaudeAiService } from "./ai/claude";
import { MockAiService } from "./ai/mock";
import type { AiService } from "./ai/types";
import { createApp } from "./app";
import { SampleCatalog } from "./catalog/sample";
import { loadConfig } from "./config";
import { log } from "./log";

const config = loadConfig();

let ai: AiService;
if (config.AI_PROVIDER === "mock") {
  ai = new MockAiService();
  log.warn("AI_PROVIDER=mock: returning canned responses, no model calls are made");
} else {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    log.warn(
      "ANTHROPIC_API_KEY is not set. Requests will fail unless another credential source is configured. " +
        "Set the key in apps/server/.env, or run with AI_PROVIDER=mock for UI development.",
    );
  }
  // Credentials resolve from the environment (ANTHROPIC_API_KEY, etc.); never hardcode a key.
  ai = new ClaudeAiService({ client: new Anthropic(), model: config.CLAUDE_MODEL });
}

const catalog = new SampleCatalog();
const app = createApp({ ai, catalog, config });

app.listen(config.PORT, () => {
  log.info("server listening", { port: config.PORT, ai: ai.name, model: config.CLAUDE_MODEL, catalog: catalog.name });
});
