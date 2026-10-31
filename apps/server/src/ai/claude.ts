import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  DesignPlanSchema,
  IntakeTurnSchema,
  ProductPicksSchema,
  RoomAnalysisSchema,
  type DesignPlan,
  type ImageUpload,
  type IntakeTurn,
  type ProductPicks,
  type RoomAnalysis,
} from "@home-kit/shared";
import { AiOutputError, AiRefusalError } from "../errors";
import { log } from "../log";
import { INTAKE_SYSTEM, PICK_SYSTEM, PLAN_SYSTEM, ROOM_ANALYSIS_SYSTEM } from "./prompts";
import type { AiService, IntakeInput, PickInput, PlanInput } from "./types";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Thinking is adaptive on this model; `effort` is the dial. Chat-style turns run at "low" for
 * latency; the two steps that need real design judgement run at "medium".
 */
const EFFORT = {
  analyzeRoom: "medium",
  intakeTurn: "low",
  planDesign: "medium",
  pickProducts: "low",
} as const satisfies Record<string, Effort>;

/** Thinking tokens count toward max_tokens, so leave generous room. Our JSON outputs are small. */
const MAX_TOKENS = 16_000;

type SystemBlock = Anthropic.Beta.BetaTextBlockParam;
type Message = Anthropic.Beta.BetaMessageParam;

export type ClaudeAiOptions = {
  client: Anthropic;
  model: string;
};

export class ClaudeAiService implements AiService {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: ClaudeAiOptions) {
    this.client = opts.client;
    this.model = opts.model;
  }

  analyzeRoom(image: ImageUpload): Promise<RoomAnalysis> {
    return this.parse({
      label: "analyzeRoom",
      schema: RoomAnalysisSchema,
      effort: EFFORT.analyzeRoom,
      system: [{ type: "text", text: ROOM_ANALYSIS_SYSTEM }],
      messages: [
        {
          role: "user",
          content: [
            // Image first, then the instruction.
            {
              type: "image",
              source: { type: "base64", media_type: image.media_type, data: image.data_base64 },
            },
            { type: "text", text: "Analyze this room." },
          ],
        },
      ],
    });
  }

  async intakeTurn(input: IntakeInput): Promise<IntakeTurn> {
    const history: Message[] =
      input.messages.length > 0
        ? input.messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: "user", content: "Hi! I've just uploaded a photo of my room." }];

    // The profile changes every turn, so it rides on the last user message rather than in the
    // system prompt; that keeps the system prefix (instructions + room analysis) cacheable.
    const last = history[history.length - 1];
    if (!last || last.role !== "user") {
      // The HTTP layer validates this, so reaching here is a programming error, not bad input.
      throw new Error("intakeTurn: conversation must end with a user message.");
    }
    const lastText = typeof last.content === "string" ? last.content : "";
    history[history.length - 1] = {
      role: "user",
      content: [
        { type: "text", text: lastText },
        {
          type: "text",
          text: `<current_profile>\n${JSON.stringify(input.profile)}\n</current_profile>`,
        },
      ],
    };

    return this.parse({
      label: "intakeTurn",
      schema: IntakeTurnSchema,
      effort: EFFORT.intakeTurn,
      system: [
        { type: "text", text: INTAKE_SYSTEM },
        {
          type: "text",
          text: `<room_analysis>\n${JSON.stringify(input.analysis)}\n</room_analysis>`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: history,
    });
  }

  planDesign(input: PlanInput): Promise<DesignPlan> {
    const transcript = input.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    return this.parse({
      label: "planDesign",
      schema: DesignPlanSchema,
      effort: EFFORT.planDesign,
      system: [{ type: "text", text: PLAN_SYSTEM }],
      messages: [
        {
          role: "user",
          content: [
            `<room_analysis>\n${JSON.stringify(input.analysis)}\n</room_analysis>`,
            `<profile>\n${JSON.stringify(input.profile)}\n</profile>`,
            `<interview_transcript>\n${transcript || "(none)"}\n</interview_transcript>`,
            `<catalog_counts_by_category>\n${JSON.stringify(input.availableCategories)}\n</catalog_counts_by_category>`,
            "Create the redesign plan.",
          ].join("\n\n"),
        },
      ],
    });
  }

  pickProducts(input: PickInput): Promise<ProductPicks> {
    // Send only what the choice needs: the plan's slots and a compact view of each candidate.
    const slots = input.plan.slots.map((slot) => ({
      slot_id: slot.slot_id,
      label: slot.label,
      priority: slot.priority,
      max_price_usd: slot.max_price_usd,
      why: slot.why,
      candidates: (input.candidates[slot.slot_id] ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price_usd: p.price_usd,
        colors: p.colors,
        styles: p.styles,
        dimensions: p.dimensions,
      })),
    }));

    return this.parse({
      label: "pickProducts",
      schema: ProductPicksSchema,
      effort: EFFORT.pickProducts,
      system: [{ type: "text", text: PICK_SYSTEM }],
      messages: [
        {
          role: "user",
          content: [
            `<concept>\n${JSON.stringify({
              concept_name: input.plan.concept_name,
              style_summary: input.plan.style_summary,
              palette: input.plan.palette,
            })}\n</concept>`,
            `<profile>\n${JSON.stringify(input.profile)}\n</profile>`,
            `<slots>\n${JSON.stringify(slots)}\n</slots>`,
            "Choose a product for every slot.",
          ].join("\n\n"),
        },
      ],
    });
  }

  /**
   * One place that talks to the API. Structured output means the reply is validated against the
   * schema; `fallbacks: "default"` asks the API to retry on another model server-side if the
   * safety classifiers decline a benign request.
   */
  private async parse<S extends z.ZodType>(args: {
    label: string;
    schema: S;
    effort: Effort;
    system: SystemBlock[];
    messages: Message[];
  }): Promise<z.infer<S>> {
    const started = Date.now();
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: args.system,
      messages: args.messages,
      output_config: {
        effort: args.effort,
        format: betaZodOutputFormat(args.schema),
      },
    });

    log.info("claude call", {
      step: args.label,
      model: response.model,
      stop_reason: response.stop_reason,
      ms: Date.now() - started,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    });

    // Check the stop reason before reading content.
    if (response.stop_reason === "refusal") {
      throw new AiRefusalError(response.stop_details?.category ?? null);
    }
    if (response.parsed_output == null) {
      throw new AiOutputError(
        `${args.label}: response did not match the expected schema (stop_reason=${response.stop_reason}).`,
      );
    }
    return response.parsed_output as z.infer<S>;
  }
}
