import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { z } from "zod";
import {
  AnalyzeRequestSchema,
  BriefRequestSchema,
  IntakeRequestSchema,
  type AnalyzeResponse,
  type ApiError,
  type IntakeResponse,
} from "@home-kit/shared";
import type { AiService } from "./ai/types";
import { buildBrief } from "./brief/buildBrief";
import type { CatalogProvider } from "./catalog/types";
import type { Config } from "./config";
import { AiOutputError, AiRefusalError, HttpError } from "./errors";
import { log } from "./log";
import { assertValidImage } from "./util/image";

export type AppDeps = {
  ai: AiService;
  catalog: CatalogProvider;
  config: Pick<Config, "CORS_ORIGINS" | "RATE_LIMIT_MAX" | "RATE_LIMIT_WINDOW_MIN" | "TRUST_PROXY">;
};

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Base64 of a 5 MB image is ~6.7 MB; leave a little room for the JSON envelope. */
const JSON_BODY_LIMIT = "8mb";

function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, "invalid_request", `Invalid request. ${detail}`);
  }
  return result.data;
}

export function createApp({ ai, catalog, config }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);

  // Browsers refuse cross-origin calls unless the server opts in. By default only pages served
  // from this same machine (e.g. the Expo web dev server on localhost:8081) are allowed, so
  // trying the app in a browser works with zero setup. CORS_ORIGINS overrides this.
  if (config.CORS_ORIGINS) {
    const origins = config.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
    app.use(cors({ origin: origins.includes("*") ? true : origins }));
  } else {
    app.use(cors({ origin: LOCALHOST_ORIGIN }));
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ai: ai.name, catalog: catalog.name });
  });

  const api = express.Router();
  // Every /api request can cost real money (model calls), so cap per-client volume.
  api.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MIN * 60_000,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: { code: "rate_limited", message: "Too many requests. Please try again in a bit." },
      } satisfies ApiError,
    }),
  );
  api.use(express.json({ limit: JSON_BODY_LIMIT }));

  api.post("/room/analyze", async (req, res) => {
    const { image } = parseBody(AnalyzeRequestSchema, req.body);
    assertValidImage(image);
    const analysis = await ai.analyzeRoom(image);
    res.json({ analysis } satisfies AnalyzeResponse);
  });

  api.post("/intake", async (req, res) => {
    const input = parseBody(IntakeRequestSchema, req.body);
    const turn = await ai.intakeTurn(input);
    res.json(turn satisfies IntakeResponse);
  });

  api.post("/brief", async (req, res) => {
    const input = parseBody(BriefRequestSchema, req.body);
    res.json(await buildBrief({ ai, catalog }, input));
  });

  app.use("/api", api);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } } satisfies ApiError);
  });
  app.use(errorHandler);

  return app;
}

function send(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } } satisfies ApiError);
}

// Express identifies error handlers by their four-argument signature.
function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return send(res, err.status, err.code, err.message);

  // body-parser errors carry a `type` string.
  const bodyErrorType = (err as { type?: string } | null)?.type;
  if (bodyErrorType === "entity.too.large") {
    return send(res, 413, "payload_too_large", "That upload is too large. Try a smaller photo.");
  }
  if (bodyErrorType === "entity.parse.failed") {
    return send(res, 400, "invalid_json", "Request body is not valid JSON.");
  }

  if (err instanceof AiRefusalError) {
    log.warn("model refusal", { route: req.path, category: err.category });
    return send(
      res,
      422,
      "ai_refusal",
      "The assistant couldn't help with that request. Try rephrasing or using a different photo.",
    );
  }
  if (err instanceof AiOutputError) {
    log.error("bad model output", { route: req.path, message: err.message });
    return send(res, 502, "ai_bad_output", "The assistant gave an unusable answer. Please try again.");
  }

  if (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError
  ) {
    log.warn("model unavailable", { route: req.path, name: err.name });
    return send(res, 503, "ai_unavailable", "The design assistant is busy right now. Please try again shortly.");
  }
  if (err instanceof Anthropic.APIError) {
    // Auth/permission/bad-request errors are our bug or configuration, not the user's fault.
    log.error("model api error", { route: req.path, status: err.status, message: err.message });
    return send(res, 500, "ai_error", "Something went wrong on our side. Please try again later.");
  }

  log.error("unhandled error", { route: req.path, message: err instanceof Error ? err.message : String(err) });
  return send(res, 500, "internal", "Something went wrong. Please try again.");
}
