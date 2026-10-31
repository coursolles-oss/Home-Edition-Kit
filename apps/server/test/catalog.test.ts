import { describe, expect, it } from "vitest";
import { SampleCatalog } from "../src/catalog/sample";

const catalog = new SampleCatalog();

describe("SampleCatalog.search", () => {
  it("only returns products from the requested category", async () => {
    const results = await catalog.search({ category: "rug" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.category === "rug")).toBe(true);
  });

  it("returns nothing for a category the catalog does not carry", async () => {
    expect(await catalog.search({ category: "accent_chair" })).toEqual([]);
  });

  it("respects the price ceiling (with a small tolerance)", async () => {
    const results = await catalog.search({ category: "sofa", maxPriceUsd: 800 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.price_usd <= 800 * 1.1)).toBe(true);
  });

  it("offers the cheapest options when nothing fits under the ceiling", async () => {
    const results = await catalog.search({ category: "sofa", maxPriceUsd: 100 });
    expect(results).toHaveLength(2);
    expect(results[0]!.price_usd).toBeGreaterThan(100);
    const allPrices = (await catalog.search({ category: "sofa", limit: 99 })).map((p) => p.price_usd);
    expect(Math.min(...results.map((p) => p.price_usd))).toBe(Math.min(...allPrices));
  });

  it("ranks products matching keywords and colours first", async () => {
    const results = await catalog.search({
      category: "rug",
      keywords: ["jute"],
      colors: ["natural"],
    });
    expect(results[0]!.id).toBe("rug-jute-natural");
  });

  it("ranks products matching liked styles above others", async () => {
    const results = await catalog.search({ category: "coffee_table", styles: ["scandinavian"] });
    expect(results[0]!.styles).toContain("scandinavian");
  });

  it("pushes disliked colours down", async () => {
    const without = await catalog.search({ category: "sofa", colors: ["green"] });
    expect(without[0]!.colors).toContain("forest green");
    const avoiding = await catalog.search({ category: "sofa", avoidColors: ["green"], limit: 99 });
    expect(avoiding[avoiding.length - 1]!.colors).toContain("forest green");
  });

  it("honours the limit", async () => {
    expect(await catalog.search({ category: "rug", limit: 2 })).toHaveLength(2);
  });
});

describe("SampleCatalog metadata", () => {
  it("flags itself as sample data and counts products per category", async () => {
    expect(catalog.isSampleData).toBe(true);
    const counts = await catalog.categoryCounts();
    expect(counts.rug).toBe(4);
    expect(counts.accent_chair).toBeUndefined();
  });

  it("uses placeholder links only", async () => {
    const all = await catalog.search({ category: "sofa", limit: 99 });
    expect(all.every((p) => p.url.startsWith("https://example.com/"))).toBe(true);
  });
});
