import request from "supertest";
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, type IntakeTurn } from "@home-kit/shared";
import { MockAiService } from "../src/ai/mock";
import { AiOutputError, AiRefusalError } from "../src/errors";
import { blankProfile, makeApp, sampleAnalysis, testConfig, TINY_JPEG_BASE64 } from "./helpers";

const jpeg = { media_type: "image/jpeg", data_base64: TINY_JPEG_BASE64 };

describe("GET /health", () => {
  it("reports the providers in use", async () => {
    const res = await request(makeApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ai: "mock", catalog: "sample" });
  });
});

describe("POST /api/room/analyze", () => {
  it("returns an analysis for a valid image", async () => {
    const res = await request(makeApp()).post("/api/room/analyze").send({ image: jpeg });
    expect(res.status).toBe(200);
    expect(res.body.analysis.is_room_photo).toBe(true);
    expect(res.body.analysis.room_type).toBeTruthy();
  });

  it("rejects unsupported media types", async () => {
    const res = await request(makeApp())
      .post("/api/room/analyze")
      .send({ image: { media_type: "image/gif", data_base64: TINY_JPEG_BASE64 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
  });

  it("rejects bytes that are not the declared image type", async () => {
    const res = await request(makeApp())
      .post("/api/room/analyze")
      .send({ image: { media_type: "image/png", data_base64: TINY_JPEG_BASE64 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_image");
  });

  it("rejects images over the 5 MB API limit", async () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    const res = await request(makeApp())
      .post("/api/room/analyze")
      .send({ image: { media_type: "image/jpeg", data_base64: big.toString("base64") } });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("image_too_large");
  });

  it("rejects malformed JSON", async () => {
    const res = await request(makeApp())
      .post("/api/room/analyze")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_json");
  });

  it("rejects a missing body", async () => {
    const res = await request(makeApp()).post("/api/room/analyze").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/intake", () => {
  it("opens the interview when there are no messages yet", async () => {
    const res = await request(makeApp())
      .post("/api/intake")
      .send({ analysis: await sampleAnalysis(), profile: blankProfile(), messages: [] });
    expect(res.status).toBe(200);
    const turn = res.body as IntakeTurn;
    expect(turn.reply).toBeTruthy();
    expect(turn.quick_replies.length).toBeGreaterThan(0);
    expect(turn.ready_for_brief).toBe(false);
  });

  it("walks the scripted interview to ready_for_brief and fills the profile", async () => {
    const app = makeApp();
    const analysis = await sampleAnalysis();
    let profile = blankProfile();
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    let turn: IntakeTurn | undefined;

    const answers = ["Make it cozier", "Scandinavian", "Around $2,000", "Nothing, start fresh"];
    for (const answer of [undefined, ...answers]) {
      if (answer) messages.push({ role: "user", content: answer });
      const res = await request(app).post("/api/intake").send({ analysis, profile, messages });
      expect(res.status).toBe(200);
      turn = res.body as IntakeTurn;
      profile = turn.profile;
      messages.push({ role: "assistant", content: turn.reply });
    }

    expect(turn!.ready_for_brief).toBe(true);
    expect(profile.goals).toEqual(["Make it cozier"]);
    expect(profile.styles_liked).toEqual(["Scandinavian"]);
    expect(profile.budget_usd).toBe(2000);
  });

  it("validates the request shape", async () => {
    const res = await request(makeApp())
      .post("/api/intake")
      .send({ analysis: {}, profile: blankProfile(), messages: [] });
    expect(res.status).toBe(400);
  });

  it("rejects a conversation that ends on an assistant message", async () => {
    const res = await request(makeApp())
      .post("/api/intake")
      .send({
        analysis: await sampleAnalysis(),
        profile: blankProfile(),
        messages: [{ role: "assistant", content: "Hello" }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
  });

  it("rejects over-long chat messages", async () => {
    const res = await request(makeApp())
      .post("/api/intake")
      .send({
        analysis: await sampleAnalysis(),
        profile: blankProfile(),
        messages: [{ role: "user", content: "x".repeat(4001) }],
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/brief", () => {
  it("returns a complete brief built from catalog products", async () => {
    const res = await request(makeApp())
      .post("/api/brief")
      .send({
        analysis: await sampleAnalysis(),
        profile: { ...blankProfile(), budget_usd: 2500, styles_liked: ["modern"] },
      });
    expect(res.status).toBe(200);
    expect(res.body.concept_name).toBeTruthy();
    expect(res.body.palette.length).toBeGreaterThan(0);
    expect(res.body.items.some((i: { product: unknown }) => i.product)).toBe(true);
    expect(res.body.catalog.is_sample_data).toBe(true);
  });
});

describe("error handling", () => {
  const body = async () => ({ analysis: await sampleAnalysis(), profile: blankProfile(), messages: [] });

  it("turns a model refusal into a friendly 422", async () => {
    class Refusing extends MockAiService {
      override async intakeTurn(): Promise<IntakeTurn> {
        throw new AiRefusalError("general_harms");
      }
    }
    const res = await request(makeApp({ ai: new Refusing() })).post("/api/intake").send(await body());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ai_refusal");
  });

  it("turns unusable model output into a 502", async () => {
    class Broken extends MockAiService {
      override async intakeTurn(): Promise<IntakeTurn> {
        throw new AiOutputError("bad");
      }
    }
    const res = await request(makeApp({ ai: new Broken() })).post("/api/intake").send(await body());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("ai_bad_output");
  });

  it("hides unexpected error details from the client", async () => {
    class Crashing extends MockAiService {
      override async intakeTurn(): Promise<IntakeTurn> {
        throw new Error("secret internal detail");
      }
    }
    const res = await request(makeApp({ ai: new Crashing() })).post("/api/intake").send(await body());
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret internal detail");
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(makeApp()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("CORS", () => {
  const allowOrigin = (res: request.Response) => res.headers["access-control-allow-origin"];

  it("by default allows pages served from localhost (Expo web dev) and nobody else", async () => {
    const app = makeApp();
    expect(allowOrigin(await request(app).get("/health").set("Origin", "http://localhost:8081"))).toBe(
      "http://localhost:8081",
    );
    expect(allowOrigin(await request(app).get("/health").set("Origin", "http://127.0.0.1:8082"))).toBe(
      "http://127.0.0.1:8082",
    );
    expect(allowOrigin(await request(app).get("/health").set("Origin", "https://evil.example"))).toBeUndefined();
    // Looks like localhost but isn't.
    expect(allowOrigin(await request(app).get("/health").set("Origin", "http://localhost.evil.example"))).toBeUndefined();
  });

  it("CORS_ORIGINS replaces the default with an explicit allow-list", async () => {
    const app = makeApp({ config: { ...testConfig, CORS_ORIGINS: "https://app.example.com" } });
    expect(allowOrigin(await request(app).get("/health").set("Origin", "https://app.example.com"))).toBe(
      "https://app.example.com",
    );
    expect(allowOrigin(await request(app).get("/health").set("Origin", "http://localhost:8081"))).toBeUndefined();
  });

  it("answers the browser's preflight check for a JSON POST", async () => {
    const res = await request(makeApp())
      .options("/api/intake")
      .set("Origin", "http://localhost:8081")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(res.status).toBe(204);
    expect(allowOrigin(res)).toBe("http://localhost:8081");
  });
});

describe("rate limiting", () => {
  it("returns 429 once the per-client limit is exceeded", async () => {
    const app = makeApp({ config: { ...testConfig, RATE_LIMIT_MAX: 2 } });
    const payload = { analysis: await sampleAnalysis(), profile: blankProfile(), messages: [] };
    expect((await request(app).post("/api/intake").send(payload)).status).toBe(200);
    expect((await request(app).post("/api/intake").send(payload)).status).toBe(200);
    const limited = await request(app).post("/api/intake").send(payload);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
  });
});
