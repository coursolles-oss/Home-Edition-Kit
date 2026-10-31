import { describe, expect, it } from "vitest";
import type { DesignPlan, ProductPicks } from "@home-kit/shared";
import { MockAiService } from "../src/ai/mock";
import type { PickInput, PlanInput } from "../src/ai/types";
import { buildBrief, sanitizePlan } from "../src/brief/buildBrief";
import { SampleCatalog } from "../src/catalog/sample";
import { blankProfile, sampleAnalysis } from "./helpers";

const catalog = new SampleCatalog();

async function input(budget: number | null = 3000) {
  return {
    analysis: await sampleAnalysis(),
    profile: { ...blankProfile(), budget_usd: budget, styles_liked: ["scandinavian"] },
    messages: [],
  };
}

/** Mock AI with selectively overridden steps. */
class StubAi extends MockAiService {
  constructor(
    private readonly overrides: {
      plan?: (base: DesignPlan) => DesignPlan;
      picks?: (base: ProductPicks, input: PickInput) => ProductPicks;
    },
  ) {
    super();
  }
  override async planDesign(i: PlanInput) {
    const base = await super.planDesign(i);
    return this.overrides.plan ? this.overrides.plan(base) : base;
  }
  override async pickProducts(i: PickInput) {
    const base = await super.pickProducts(i);
    return this.overrides.picks ? this.overrides.picks(base, i) : base;
  }
}

describe("buildBrief", () => {
  it("returns real catalog products with a server-computed total", async () => {
    const brief = await buildBrief({ ai: new MockAiService(), catalog }, await input());
    const all = new Map(
      (await catalog.search({ category: "sofa", limit: 99 })).map((p) => [p.id, p]),
    );

    expect(brief.items.length).toBeGreaterThan(0);
    const priced = brief.items.filter((i) => i.product);
    expect(priced.length).toBeGreaterThan(0);
    expect(brief.total_cost_usd).toBeCloseTo(
      priced.reduce((s, i) => s + i.product!.price_usd, 0),
      2,
    );
    const sofa = brief.items.find((i) => i.slot_id === "sofa")!;
    expect(all.has(sofa.product!.id)).toBe(true);
    expect(brief.catalog).toEqual({ provider: "sample", is_sample_data: true, affiliate_disclosure: null });
  });

  it("drops a product id the model made up instead of passing it through", async () => {
    const ai = new StubAi({
      picks: (base) => ({
        ...base,
        picks: base.picks.map((p) =>
          p.slot_id === "sofa" ? { ...p, product_id: "totally-invented-sofa", rationale: "Lovely invented sofa" } : p,
        ),
      }),
    });
    const brief = await buildBrief({ ai, catalog }, await input());
    const sofa = brief.items.find((i) => i.slot_id === "sofa")!;
    expect(sofa.product).toBeNull();
    // The model's rationale described a product that doesn't exist, so it must not be shown.
    expect(sofa.rationale).not.toContain("invented");
  });

  it("rejects a real product that was not offered for that slot", async () => {
    const ai = new StubAi({
      picks: (base) => ({
        ...base,
        // A valid catalog id, but a rug is not a candidate for the sofa slot.
        picks: base.picks.map((p) => (p.slot_id === "sofa" ? { ...p, product_id: "rug-jute-natural" } : p)),
      }),
    });
    const brief = await buildBrief({ ai, catalog }, await input());
    expect(brief.items.find((i) => i.slot_id === "sofa")!.product).toBeNull();
  });

  it("handles slots the catalog cannot source", async () => {
    const ai = new StubAi({
      plan: (base) => ({
        ...base,
        slots: [
          ...base.slots,
          { slot_id: "chair", label: "Accent chair", category: "accent_chair", why: "Extra seating", max_price_usd: 300, search_terms: [], preferred_colors: [], priority: "nice_to_have" },
        ],
      }),
    });
    const brief = await buildBrief({ ai, catalog }, await input());
    const chair = brief.items.find((i) => i.slot_id === "chair")!;
    expect(chair.product).toBeNull();
    expect(chair.rationale).toMatch(/no matching item/i);
  });

  it("skips the pick call entirely when nothing is sourceable", async () => {
    let pickCalls = 0;
    const ai = new StubAi({
      plan: (base) => ({ ...base, slots: base.slots.slice(0, 1).map((s) => ({ ...s, category: "accent_chair" })) }),
      picks: (b) => {
        pickCalls++;
        return b;
      },
    });
    const brief = await buildBrief({ ai, catalog }, await input());
    expect(pickCalls).toBe(0);
    expect(brief.items[0]!.product).toBeNull();
    expect(brief.total_cost_usd).toBe(0);
  });

  it("flags over-budget briefs", async () => {
    const brief = await buildBrief({ ai: new MockAiService(), catalog }, await input(200));
    expect(brief.total_cost_usd).toBeGreaterThan(200);
    expect(brief.over_budget).toBe(true);
  });

  it("is never over budget when no budget was given", async () => {
    const brief = await buildBrief({ ai: new MockAiService(), catalog }, await input(null));
    expect(brief.budget_usd).toBeNull();
    expect(brief.over_budget).toBe(false);
  });
});

describe("sanitizePlan", () => {
  const slot = (id: string, priority: "essential" | "nice_to_have" = "essential") => ({
    slot_id: id,
    label: id,
    category: "rug" as const,
    why: "",
    max_price_usd: 100,
    search_terms: [],
    preferred_colors: [],
    priority,
  });
  const plan = (slots: DesignPlan["slots"]): DesignPlan => ({
    concept_name: "x",
    style_summary: "x",
    palette: [{ name: "a", hex: "#abcdef" }],
    layout_suggestions: [],
    slots,
  });

  it("makes duplicate slot ids unique", () => {
    const ids = sanitizePlan(plan([slot("rug"), slot("rug"), slot("rug")])).slots.map((s) => s.slot_id);
    expect(new Set(ids).size).toBe(3);
  });

  it("caps slots at 12 and keeps essentials when trimming", () => {
    const many = [
      ...Array.from({ length: 12 }, (_, i) => slot(`nice-${i}`, "nice_to_have")),
      slot("must-have", "essential"),
    ];
    const out = sanitizePlan(plan(many)).slots;
    expect(out).toHaveLength(12);
    expect(out.map((s) => s.slot_id)).toContain("must-have");
  });

  it("replaces malformed hex colours and uppercases valid ones", () => {
    const p = plan([slot("a")]);
    p.palette = [
      { name: "ok", hex: "#abcdef" },
      { name: "bad", hex: "red" },
      { name: "alsobad", hex: "#12345" },
    ];
    expect(sanitizePlan(p).palette.map((c) => c.hex)).toEqual(["#ABCDEF", "#CCCCCC", "#CCCCCC"]);
  });

  it("nulls out nonsense price ceilings", () => {
    const p = plan([
      { ...slot("a"), max_price_usd: -5 },
      { ...slot("b"), max_price_usd: Number.NaN },
      { ...slot("c"), max_price_usd: 0 },
    ]);
    expect(sanitizePlan(p).slots.map((s) => s.max_price_usd)).toEqual([null, null, null]);
  });
});
