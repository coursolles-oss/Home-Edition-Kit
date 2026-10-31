import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ClaudeAiService } from "../src/ai/claude";
import { AiOutputError, AiRefusalError } from "../src/errors";
import { blankProfile, sampleAnalysis, TINY_JPEG_BASE64 } from "./helpers";

/** Fake of the one SDK method we use; records the request and returns a canned response. */
function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn().mockResolvedValue({
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5 },
    ...response,
  });
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { client, parse };
}

const lastRequest = (parse: ReturnType<typeof vi.fn>) => parse.mock.calls.at(-1)![0];

describe("ClaudeAiService request shape", () => {
  it("analyzeRoom sends the image first, with structured output and fallbacks on", async () => {
    const analysis = await sampleAnalysis();
    const { client, parse } = fakeClient({ parsed_output: analysis });
    const ai = new ClaudeAiService({ client, model: "claude-opus-5-5" });

    const result = await ai.analyzeRoom({ media_type: "image/jpeg", data_base64: TINY_JPEG_BASE64 });
    expect(result).toEqual(analysis);

    const req = lastRequest(parse);
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.fallbacks).toBe("default");
    expect(req.output_config.effort).toBe("medium");
    expect(req.output_config.format.type).toBe("json_schema");

    const content = req.messages[0].content;
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: TINY_JPEG_BASE64 },
    });
    expect(content[1].type).toBe("text");
  });

  it("never sends parameters this model rejects", async () => {
    const { client, parse } = fakeClient({ parsed_output: await sampleAnalysis() });
    const ai = new ClaudeAiService({ client, model: "claude-opus-5-5" });
    await ai.analyzeRoom({ media_type: "image/jpeg", data_base64: TINY_JPEG_BASE64 });

    const req = lastRequest(parse);
    for (const key of ["thinking", "temperature", "top_p", "top_k", "tool_choice"]) {
      expect(req).not.toHaveProperty(key);
    }
  });

  it("intakeTurn opens with a user message and keeps the profile out of the cached system prefix", async () => {
    const turn = { reply: "hi", quick_replies: [], profile: blankProfile(), ready_for_brief: false };
    const { client, parse } = fakeClient({ parsed_output: turn });
    const ai = new ClaudeAiService({ client, model: "claude-opus-5-5" });
    const profile = { ...blankProfile(), budget_usd: 1234 };

    await ai.intakeTurn({ analysis: await sampleAnalysis(), profile, messages: [] });

    const req = lastRequest(parse);
    expect(req.output_config.effort).toBe("low");
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    // Profile rides on the last user message...
    const texts = req.messages[0].content.map((b: { text: string }) => b.text).join("\n");
    expect(texts).toContain("<current_profile>");
    expect(texts).toContain("1234");
    // ...so the cache breakpoint (on the room analysis) covers only stable content.
    const systemText = req.system.map((b: { text: string }) => b.text).join("\n");
    expect(systemText).toContain("<room_analysis>");
    expect(systemText).not.toContain("1234");
    expect(req.system.at(-1).cache_control).toEqual({ type: "ephemeral" });
  });

  it("intakeTurn replays prior turns in order", async () => {
    const turn = { reply: "ok", quick_replies: [], profile: blankProfile(), ready_for_brief: false };
    const { client, parse } = fakeClient({ parsed_output: turn });
    const ai = new ClaudeAiService({ client, model: "claude-opus-5-5" });

    await ai.intakeTurn({
      analysis: await sampleAnalysis(),
      profile: blankProfile(),
      messages: [
        { role: "user", content: "Make it cozier" },
        { role: "assistant", content: "What style?" },
        { role: "user", content: "Boho" },
      ],
    });

    const roles = lastRequest(parse).messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["user", "assistant", "user"]);
  });

  it("intakeTurn refuses to run when the conversation ends on an assistant message", async () => {
    const { client } = fakeClient({ parsed_output: {} });
    const ai = new ClaudeAiService({ client, model: "claude-opus-5-5" });
    await expect(
      ai.intakeTurn({
        analysis: await sampleAnalysis(),
        profile: blankProfile(),
        messages: [{ role: "assistant", content: "Hello" }],
      }),
    ).rejects.toThrow(/must end with a user message/);
  });

  it("uses the configured model", async () => {
    const { client, parse } = fakeClient({ parsed_output: await sampleAnalysis() });
    const ai = new ClaudeAiService({ client, model: "some-other-model" });
    await ai.analyzeRoom({ media_type: "image/jpeg", data_base64: TINY_JPEG_BASE64 });
    expect(lastRequest(parse).model).toBe("some-other-model");
  });
});

describe("ClaudeAiService response handling", () => {
  const img = { media_type: "image/jpeg" as const, data_base64: TINY_JPEG_BASE64 };

  it("throws AiRefusalError when the model refuses, even if parsed output is absent", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: null },
      parsed_output: null,
    });
    const err = await new ClaudeAiService({ client, model: "m" }).analyzeRoom(img).catch((e) => e);
    expect(err).toBeInstanceOf(AiRefusalError);
    expect((err as AiRefusalError).category).toBe("cyber");
  });

  it("throws AiOutputError when output could not be parsed (e.g. truncated)", async () => {
    const { client } = fakeClient({ stop_reason: "max_tokens", parsed_output: null });
    await expect(new ClaudeAiService({ client, model: "m" }).analyzeRoom(img)).rejects.toBeInstanceOf(
      AiOutputError,
    );
  });
});
