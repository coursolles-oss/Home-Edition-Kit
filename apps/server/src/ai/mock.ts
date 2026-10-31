import {
  emptyProfile,
  type DesignPlan,
  type DesignProfile,
  type ImageUpload,
  type IntakeTurn,
  type ProductPicks,
  type RoomAnalysis,
} from "@home-kit/shared";
import type { AiService, IntakeInput, PickInput, PlanInput } from "./types";

/**
 * Deterministic stand-in for Claude. Lets the mobile UI be developed and the server tested
 * with no API key and no spend (`AI_PROVIDER=mock`). Not smart; it follows a fixed script.
 */
export class MockAiService implements AiService {
  readonly name = "mock";

  async analyzeRoom(_image: ImageUpload): Promise<RoomAnalysis> {
    return {
      is_room_photo: true,
      room_type: "living room",
      current_style: "dated traditional",
      summary:
        "A mid-sized living room with a worn grey sofa facing a TV wall, beige walls and a small window. The space feels dim and a little cluttered.",
      dominant_colors: ["beige", "grey", "dark brown"],
      existing_furniture: [
        { item: "grey fabric sofa", condition: "worn cushions", keep_candidate: false },
        { item: "dark wood TV stand", condition: "solid, slightly dated", keep_candidate: true },
        { item: "small round side table", condition: "scuffed", keep_candidate: false },
      ],
      lighting: "One window on the left; no visible lamps, so the right side of the room is dark.",
      layout_notes: "Everything is pushed against the walls and the sofa blocks the window.",
      problem_areas: ["dark corner", "no focal point", "bare walls"],
      opportunities: ["layer lighting", "add a large rug to anchor the seating", "add art above the sofa"],
      photo_limitations: "Only one wall is visible, so the room's overall size is a guess.",
    };
  }

  async intakeTurn(input: IntakeInput): Promise<IntakeTurn> {
    const userMessages = input.messages.filter((m) => m.role === "user");
    const last = userMessages[userMessages.length - 1]?.content ?? "";
    const profile: DesignProfile = { ...emptyProfile(), ...input.profile };

    switch (userMessages.length) {
      case 0:
        return {
          reply:
            "Thanks, I can see a living room with a worn sofa and a dark corner. What's the main thing you'd like to change?",
          quick_replies: ["Make it cozier", "More storage", "Brighter and more open"],
          profile,
          ready_for_brief: false,
        };
      case 1:
        return {
          reply: "Got it. What style are you drawn to?",
          quick_replies: ["Modern", "Scandinavian", "Boho", "Mid-century"],
          profile: { ...profile, goals: [last] },
          ready_for_brief: false,
        };
      case 2:
        return {
          reply: "Nice choice. Roughly what's your total budget?",
          quick_replies: ["Under $1,000", "$1,000-$2,500", "$2,500+"],
          profile: { ...profile, styles_liked: [last] },
          ready_for_brief: false,
        };
      case 3: {
        const digits = last.match(/\d[\d,]*/g)?.map((d) => Number(d.replace(/,/g, ""))) ?? [];
        const budget = digits.length > 0 ? Math.max(...digits) : 1500;
        return {
          reply: "Is there anything in the room you definitely want to keep?",
          quick_replies: ["The TV stand", "Nothing, start fresh"],
          profile: { ...profile, budget_usd: budget },
          ready_for_brief: false,
        };
      }
      default:
        return {
          reply: "Perfect, I have what I need. Tap the button below to see your design.",
          quick_replies: [],
          profile: { ...profile, keep_items: /nothing|fresh/i.test(last) ? [] : [last] },
          ready_for_brief: true,
        };
    }
  }

  async planDesign(input: PlanInput): Promise<DesignPlan> {
    const style = input.profile.styles_liked[0] ?? "modern";
    return {
      concept_name: `Warm ${style[0]?.toUpperCase() ?? "M"}${style.slice(1)} Calm`,
      style_summary:
        "Soft, layered neutrals with warm wood and one confident accent colour, built around a comfortable sofa and better lighting for the dark corner.",
      palette: [
        { name: "Oat", hex: "#E8DFD0" },
        { name: "Warm Oak", hex: "#B58B5E" },
        { name: "Sage", hex: "#9CAF88" },
        { name: "Terracotta", hex: "#C66B4E" },
        { name: "Charcoal", hex: "#3B3B3B" },
      ],
      layout_suggestions: [
        "Pull the sofa off the wall and float it to define the seating area.",
        "Anchor the seating group with an 8x10 rug.",
        "Put a floor lamp in the dark corner and a table lamp by the sofa.",
        "Hang a large piece of art above the sofa as the focal point.",
      ],
      slots: [
        { slot_id: "sofa", label: "Sofa", category: "sofa", why: "The current sofa is worn and blocks the window.", max_price_usd: 1000, search_terms: ["linen", "performance"], preferred_colors: ["oat", "grey"], priority: "essential" },
        { slot_id: "rug", label: "Area rug", category: "rug", why: "Anchors the seating and adds warmth.", max_price_usd: 300, search_terms: ["wool", "washable"], preferred_colors: ["ivory", "rust"], priority: "essential" },
        { slot_id: "coffee-table", label: "Coffee table", category: "coffee_table", why: "Gives the seating group a centre.", max_price_usd: 300, search_terms: ["oak", "walnut"], preferred_colors: [], priority: "nice_to_have" },
        { slot_id: "floor-lamp", label: "Floor lamp", category: "floor_lamp", why: "Lights the dark corner.", max_price_usd: 150, search_terms: ["arc"], preferred_colors: ["brass"], priority: "essential" },
        { slot_id: "art", label: "Wall art", category: "wall_art", why: "Creates a focal point above the sofa.", max_price_usd: 140, search_terms: ["abstract"], preferred_colors: ["terracotta"], priority: "nice_to_have" },
        { slot_id: "pillows", label: "Throw pillows", category: "throw_pillows", why: "Adds colour and texture.", max_price_usd: 50, search_terms: [], preferred_colors: ["sage", "rust"], priority: "nice_to_have" },
        { slot_id: "plant", label: "Plant", category: "plant", why: "Brings life to the corner.", max_price_usd: 100, search_terms: [], preferred_colors: [], priority: "nice_to_have" },
      ],
    };
  }

  async pickProducts(input: PickInput): Promise<ProductPicks> {
    return {
      picks: input.plan.slots.map((slot) => {
        const first = input.candidates[slot.slot_id]?.[0];
        return {
          slot_id: slot.slot_id,
          product_id: first?.id ?? null,
          rationale: first
            ? `A good fit for your ${input.profile.styles_liked[0] ?? "chosen"} direction and the ${slot.label.toLowerCase()} budget.`
            : "Nothing suitable available.",
        };
      }),
      closing_note: "These pieces share a warm, neutral base so you can add colour gradually.",
    };
  }
}
