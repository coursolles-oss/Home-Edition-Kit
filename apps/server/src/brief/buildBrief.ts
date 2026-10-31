import type {
  BriefItem,
  BriefRequest,
  DesignBrief,
  DesignPlan,
  Product,
  ProductPicks,
} from "@home-kit/shared";
import type { AiService } from "../ai/types";
import type { CatalogProvider } from "../catalog/types";

const MAX_SLOTS = 12;
const MAX_PALETTE = 6;
const FALLBACK_HEX = "#CCCCCC";
const HEX = /^#[0-9a-fA-F]{6}$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turns the interview into a shoppable design brief.
 *
 *   1. Claude drafts a plan: concept, palette, layout ideas, and "slots" (things to buy).
 *   2. We search the real catalog for each slot.
 *   3. Claude picks one product per slot, but only from the candidates we found.
 *   4. We validate the picks and compute totals ourselves. Model output is never trusted
 *      for product ids, links or arithmetic.
 */
export async function buildBrief(
  deps: { ai: AiService; catalog: CatalogProvider },
  input: BriefRequest,
): Promise<DesignBrief> {
  const { ai, catalog } = deps;

  const availableCategories = await catalog.categoryCounts();
  const plan = sanitizePlan(await ai.planDesign({ ...input, availableCategories }));

  const candidates: Record<string, Product[]> = {};
  await Promise.all(
    plan.slots.map(async (slot) => {
      candidates[slot.slot_id] = await catalog.search({
        category: slot.category,
        maxPriceUsd: slot.max_price_usd,
        keywords: slot.search_terms,
        colors: slot.preferred_colors,
        styles: input.profile.styles_liked,
        avoidColors: input.profile.colors_disliked,
      });
    }),
  );

  // Only ask the model to choose for slots that have something to choose from.
  const sourceable = plan.slots.filter((s) => (candidates[s.slot_id]?.length ?? 0) > 0);
  const picks: ProductPicks =
    sourceable.length > 0
      ? await ai.pickProducts({
          analysis: input.analysis,
          profile: input.profile,
          plan: { ...plan, slots: sourceable },
          candidates,
        })
      : { picks: [], closing_note: "" };

  const pickBySlot = new Map(picks.picks.map((p) => [p.slot_id, p]));

  const items: BriefItem[] = plan.slots.map((slot) => {
    const slotCandidates = candidates[slot.slot_id] ?? [];
    const pick = pickBySlot.get(slot.slot_id);
    // A product only counts if its id is one of the candidates we actually offered.
    const product = pick?.product_id
      ? (slotCandidates.find((p) => p.id === pick.product_id) ?? null)
      : null;

    let rationale: string;
    if (product) {
      rationale = pick?.rationale ?? "";
    } else if (slotCandidates.length === 0) {
      rationale = "No matching item in the catalog yet.";
    } else if (pick && pick.product_id == null && pick.rationale) {
      rationale = pick.rationale;
    } else {
      rationale = "None of the available options were a good fit.";
    }

    return {
      slot_id: slot.slot_id,
      label: slot.label,
      why: slot.why,
      priority: slot.priority,
      max_price_usd: slot.max_price_usd,
      product,
      rationale,
    };
  });

  const total = round2(items.reduce((sum, i) => sum + (i.product?.price_usd ?? 0), 0));
  const budget = input.profile.budget_usd;

  return {
    concept_name: plan.concept_name,
    style_summary: plan.style_summary,
    palette: plan.palette,
    layout_suggestions: plan.layout_suggestions,
    items,
    total_cost_usd: total,
    budget_usd: budget,
    over_budget: budget != null && total > budget,
    closing_note: picks.closing_note,
    catalog: {
      provider: catalog.name,
      is_sample_data: catalog.isSampleData,
      affiliate_disclosure: catalog.affiliateDisclosure,
    },
  };
}

/** Defensive clean-up of the model's plan before it drives searches and reaches the app. */
export function sanitizePlan(plan: DesignPlan): DesignPlan {
  const seen = new Set<string>();
  const slots = plan.slots
    .map((slot, index) => ({ slot, index }))
    // Essentials first so the cap never drops them; stable within a priority.
    .sort(
      (a, b) =>
        Number(a.slot.priority === "nice_to_have") - Number(b.slot.priority === "nice_to_have") ||
        a.index - b.index,
    )
    .slice(0, MAX_SLOTS)
    .sort((a, b) => a.index - b.index)
    .map(({ slot }) => {
      let id = slot.slot_id.trim() || slot.category;
      for (let n = 2; seen.has(id); n++) id = `${slot.slot_id.trim() || slot.category}-${n}`;
      seen.add(id);
      const cap = slot.max_price_usd;
      return {
        ...slot,
        slot_id: id,
        max_price_usd: cap != null && Number.isFinite(cap) && cap > 0 ? cap : null,
      };
    });

  const palette = plan.palette.slice(0, MAX_PALETTE).map((c) => ({
    name: c.name,
    hex: HEX.test(c.hex.trim()) ? c.hex.trim().toUpperCase() : FALLBACK_HEX,
  }));

  return { ...plan, slots, palette };
}
