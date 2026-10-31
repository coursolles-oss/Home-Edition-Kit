import type { Product, ProductCategory } from "@home-kit/shared";
import { SAMPLE_PRODUCTS } from "./sampleData";
import type { CatalogProvider, CatalogQuery } from "./types";

const DEFAULT_LIMIT = 6;
/** Products up to this far over a slot's ceiling are still offered (the model decides). */
const PRICE_TOLERANCE = 1.1;

const norm = (s: string) => s.toLowerCase().trim();

/** True when `needle` (a word or phrase) appears in any of the haystack strings. */
function anyContains(haystack: string[], needle: string): boolean {
  const n = norm(needle);
  return n.length > 0 && haystack.some((h) => norm(h).includes(n) || n.includes(norm(h)));
}

export class SampleCatalog implements CatalogProvider {
  readonly name = "sample";
  readonly isSampleData = true;
  readonly affiliateDisclosure = null;

  constructor(private readonly products: Product[] = SAMPLE_PRODUCTS) {}

  async search(q: CatalogQuery): Promise<Product[]> {
    const limit = q.limit ?? DEFAULT_LIMIT;
    const inCategory = this.products.filter((p) => p.category === q.category);
    if (inCategory.length === 0) return [];

    const cap = q.maxPriceUsd ?? null;
    const affordable =
      cap == null ? inCategory : inCategory.filter((p) => p.price_usd <= cap * PRICE_TOLERANCE);

    // Nothing within the ceiling: offer the cheapest options anyway so the model (and the user)
    // can see what the category costs, rather than silently showing nothing.
    const pool =
      affordable.length > 0
        ? affordable
        : [...inCategory].sort((a, b) => a.price_usd - b.price_usd).slice(0, 2);

    return pool
      .map((p) => ({ p, score: this.score(p, q) }))
      .sort((a, b) => b.score - a.score || a.p.price_usd - b.p.price_usd)
      .slice(0, limit)
      .map((x) => x.p);
  }

  async categoryCounts(): Promise<Partial<Record<ProductCategory, number>>> {
    const counts: Partial<Record<ProductCategory, number>> = {};
    for (const p of this.products) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }

  private score(p: Product, q: CatalogQuery): number {
    const text = [p.name, ...p.colors, ...p.styles];
    let score = 0;
    for (const k of q.keywords ?? []) if (anyContains(text, k)) score += 2;
    for (const c of q.colors ?? []) if (anyContains(p.colors, c)) score += 2;
    for (const s of q.styles ?? []) if (anyContains(p.styles, s)) score += 1.5;
    for (const c of q.avoidColors ?? []) if (anyContains(p.colors, c)) score -= 3;
    return score;
  }
}
