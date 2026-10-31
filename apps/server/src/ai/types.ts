import type {
  ChatMessage,
  DesignPlan,
  DesignProfile,
  ImageUpload,
  IntakeTurn,
  Product,
  ProductCategory,
  ProductPicks,
  RoomAnalysis,
} from "@home-kit/shared";

export type IntakeInput = {
  analysis: RoomAnalysis;
  profile: DesignProfile;
  messages: ChatMessage[];
};

export type PlanInput = IntakeInput & {
  /** How many products the catalog holds per category, so the plan only asks for things we can source. */
  availableCategories: Partial<Record<ProductCategory, number>>;
};

export type PickInput = {
  analysis: RoomAnalysis;
  profile: DesignProfile;
  plan: DesignPlan;
  /** Real catalog products per slot_id. The model may only choose from these. */
  candidates: Record<string, Product[]>;
};

/**
 * Everything the app needs from an LLM, behind an interface so the HTTP layer and brief
 * assembly can be tested (and the UI developed) without calling the real API.
 */
export interface AiService {
  readonly name: string;
  analyzeRoom(image: ImageUpload): Promise<RoomAnalysis>;
  intakeTurn(input: IntakeInput): Promise<IntakeTurn>;
  planDesign(input: PlanInput): Promise<DesignPlan>;
  pickProducts(input: PickInput): Promise<ProductPicks>;
}
