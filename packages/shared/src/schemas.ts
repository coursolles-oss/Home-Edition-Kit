import { z } from "zod";

/*
 * Two kinds of schema live here:
 *
 *  1. "Model output" schemas (RoomAnalysis, IntakeTurn, DesignPlan, ProductPicks).
 *     These are handed to Claude as the structured-output format, so they stick to
 *     plain types/enums/arrays and put guidance in `.describe()` instead of using
 *     numeric/length constraints (which structured outputs don't enforce).
 *
 *  2. "Request/response" schemas used to validate HTTP traffic on the server.
 *     Those can use ordinary zod constraints freely.
 */

// ---------------------------------------------------------------------------
// Catalog vocabulary
// ---------------------------------------------------------------------------

export const PRODUCT_CATEGORIES = [
  "sofa",
  "sectional",
  "loveseat",
  "armchair",
  "accent_chair",
  "ottoman",
  "coffee_table",
  "side_table",
  "console_table",
  "tv_stand",
  "bookshelf",
  "storage_cabinet",
  "wall_shelf",
  "rug",
  "floor_lamp",
  "table_lamp",
  "pendant_light",
  "wall_art",
  "mirror",
  "curtains",
  "throw_pillows",
  "throw_blanket",
  "plant",
  "planter",
  "storage_basket",
  "bed_frame",
  "nightstand",
  "dresser",
  "desk",
  "desk_chair",
  "dining_table",
  "dining_chair",
] as const;

export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  retailer: z.string(),
  category: ProductCategorySchema,
  price_usd: z.number(),
  colors: z.array(z.string()),
  styles: z.array(z.string()),
  dimensions: z.string().nullable(),
  image_url: z.string().nullable(),
  url: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

// ---------------------------------------------------------------------------
// 1. Room analysis (model output)
// ---------------------------------------------------------------------------

export const FurnitureItemSchema = z.object({
  item: z.string().describe('Short name, e.g. "grey fabric sofa".'),
  condition: z
    .string()
    .describe("Brief note on visible condition, material or style."),
  keep_candidate: z
    .boolean()
    .describe("True if it looks worth keeping in a redesign."),
});

export const RoomAnalysisSchema = z.object({
  is_room_photo: z
    .boolean()
    .describe("False if the image is not a photo of an interior room."),
  room_type: z
    .string()
    .describe('e.g. "living room", "bedroom", "home office", "unknown".'),
  current_style: z
    .string()
    .describe('The style the room reads as today, e.g. "dated traditional".'),
  summary: z
    .string()
    .describe("Two or three plain sentences describing the room as it is."),
  dominant_colors: z.array(z.string()),
  existing_furniture: z.array(FurnitureItemSchema),
  lighting: z
    .string()
    .describe("Natural/artificial light observations, including problem spots."),
  layout_notes: z
    .string()
    .describe("How the space is arranged and how traffic would flow."),
  problem_areas: z.array(z.string()),
  opportunities: z.array(z.string()),
  photo_limitations: z
    .string()
    .describe(
      "What cannot be judged from this one photo (room size, other walls, ceiling height...). Empty string if nothing.",
    ),
});
export type RoomAnalysis = z.infer<typeof RoomAnalysisSchema>;

// ---------------------------------------------------------------------------
// 2. User profile + intake conversation (model output)
// ---------------------------------------------------------------------------

export const DesignProfileSchema = z.object({
  goals: z
    .array(z.string())
    .describe('What the user wants from the redesign, e.g. "cozier", "more storage".'),
  styles_liked: z.array(z.string()),
  styles_disliked: z.array(z.string()),
  colors_liked: z.array(z.string()),
  colors_disliked: z.array(z.string()),
  budget_usd: z
    .number()
    .nullable()
    .describe("Total budget in US dollars, or null if not yet known."),
  budget_flexibility: z
    .enum(["strict", "flexible"])
    .nullable()
    .describe("null if not yet known."),
  keep_items: z
    .array(z.string())
    .describe("Existing pieces the user wants to keep."),
  household: z
    .array(z.string())
    .describe('Who/what uses the room, e.g. "two kids", "large dog".'),
  tenure: z.enum(["renting", "owning"]).nullable(),
  constraints: z
    .array(z.string())
    .describe('Practical limits, e.g. "cannot paint walls", "no drilling".'),
  room_dimensions: z
    .string()
    .nullable()
    .describe('As the user gave them, e.g. "about 12 x 14 ft". null if unknown.'),
  notes: z.array(z.string()).describe("Anything else worth remembering."),
});
export type DesignProfile = z.infer<typeof DesignProfileSchema>;

export function emptyProfile(): DesignProfile {
  return {
    goals: [],
    styles_liked: [],
    styles_disliked: [],
    colors_liked: [],
    colors_disliked: [],
    budget_usd: null,
    budget_flexibility: null,
    keep_items: [],
    household: [],
    tenure: null,
    constraints: [],
    room_dimensions: null,
    notes: [],
  };
}

export const IntakeTurnSchema = z.object({
  reply: z
    .string()
    .describe(
      "What the assistant says next: one or two short sentences, ending in at most one question.",
    ),
  quick_replies: z
    .array(z.string())
    .describe(
      "Zero to four short tappable answers to the question just asked. Empty when the question is open-ended.",
    ),
  profile: DesignProfileSchema.describe(
    "The COMPLETE updated profile after the user's latest message. Carry forward everything still true; change or remove anything the user corrected.",
  ),
  ready_for_brief: z
    .boolean()
    .describe(
      "True once there is enough to design (goals, style direction and budget are known) or the user asked to see results now.",
    ),
});
export type IntakeTurn = z.infer<typeof IntakeTurnSchema>;

// ---------------------------------------------------------------------------
// 3. Design plan + product picks (model output)
// ---------------------------------------------------------------------------

export const PaletteColorSchema = z.object({
  name: z.string(),
  hex: z.string().describe('Hex colour such as "#A1B2C3".'),
});

export const PlanSlotSchema = z.object({
  slot_id: z.string().describe('Short unique id, e.g. "sofa", "rug", "lamp-1".'),
  label: z.string().describe('Human label, e.g. "Sofa".'),
  category: ProductCategorySchema,
  why: z.string().describe("One sentence on why the room needs this."),
  max_price_usd: z
    .number()
    .nullable()
    .describe("Price ceiling for this slot in US dollars, or null for no cap."),
  search_terms: z
    .array(z.string())
    .describe("Keywords describing the ideal product, e.g. 'linen', 'curved'."),
  preferred_colors: z.array(z.string()),
  priority: z.enum(["essential", "nice_to_have"]),
});

export const DesignPlanSchema = z.object({
  concept_name: z.string().describe('Evocative short name, e.g. "Warm Coastal Calm".'),
  style_summary: z
    .string()
    .describe("Two or three sentences describing the new look and why it fits this user."),
  palette: z.array(PaletteColorSchema).describe("Four or five colours."),
  layout_suggestions: z
    .array(z.string())
    .describe("Three to five concrete layout/arrangement changes."),
  slots: z.array(PlanSlotSchema).describe("Six to twelve products to source."),
});
export type DesignPlan = z.infer<typeof DesignPlanSchema>;

export const ProductPickSchema = z.object({
  slot_id: z.string(),
  product_id: z
    .string()
    .nullable()
    .describe(
      "The id of ONE candidate for this slot, copied exactly, or null if none of the candidates fit.",
    ),
  rationale: z
    .string()
    .describe("One sentence tying the choice to this user's stated preferences."),
});

export const ProductPicksSchema = z.object({
  picks: z.array(ProductPickSchema),
  closing_note: z
    .string()
    .describe("One or two sentences on how the pieces work together and any trade-offs."),
});
export type ProductPicks = z.infer<typeof ProductPicksSchema>;

// ---------------------------------------------------------------------------
// HTTP contract
// ---------------------------------------------------------------------------

/** Anthropic accepts images up to 5 MB; base64 inflates by ~4/3. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ImageUploadSchema = z.object({
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data_base64: z.string().min(1),
});
export type ImageUpload = z.infer<typeof ImageUploadSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AnalyzeRequestSchema = z.object({ image: ImageUploadSchema });
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = { analysis: RoomAnalysis };

export const IntakeRequestSchema = z
  .object({
    analysis: RoomAnalysisSchema,
    profile: DesignProfileSchema,
    messages: z.array(ChatMessageSchema).max(60),
  })
  .refine((r) => r.messages.length === 0 || r.messages[r.messages.length - 1]!.role === "user", {
    message: "The conversation must end with a user message.",
    path: ["messages"],
  });
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;
export type IntakeResponse = IntakeTurn;

export const BriefRequestSchema = z.object({
  analysis: RoomAnalysisSchema,
  profile: DesignProfileSchema,
  messages: z.array(ChatMessageSchema).max(60).default([]),
});
export type BriefRequest = z.infer<typeof BriefRequestSchema>;

export const BriefItemSchema = z.object({
  slot_id: z.string(),
  label: z.string(),
  why: z.string(),
  priority: z.enum(["essential", "nice_to_have"]),
  max_price_usd: z.number().nullable(),
  product: ProductSchema.nullable(),
  rationale: z.string(),
});
export type BriefItem = z.infer<typeof BriefItemSchema>;

export const DesignBriefSchema = z.object({
  concept_name: z.string(),
  style_summary: z.string(),
  palette: z.array(PaletteColorSchema),
  layout_suggestions: z.array(z.string()),
  items: z.array(BriefItemSchema),
  total_cost_usd: z.number(),
  budget_usd: z.number().nullable(),
  over_budget: z.boolean(),
  closing_note: z.string(),
  catalog: z.object({
    provider: z.string(),
    is_sample_data: z.boolean(),
    affiliate_disclosure: z.string().nullable(),
  }),
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

export type ApiError = { error: { code: string; message: string } };
