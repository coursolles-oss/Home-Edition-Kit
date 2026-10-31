import type { Product, ProductCategory } from "@home-kit/shared";

export type CatalogQuery = {
  category: ProductCategory;
  /** Ceiling in USD; products modestly over it are still considered. null/undefined = no cap. */
  maxPriceUsd?: number | null;
  keywords?: string[];
  colors?: string[];
  styles?: string[];
  /** Colours the user dislikes; matching products rank lower. */
  avoidColors?: string[];
  limit?: number;
};

/**
 * Where products come from. The sample provider ships with the repo; a real one (an affiliate
 * network feed, a retailer API, a shopping-search API) implements the same interface.
 */
export interface CatalogProvider {
  readonly name: string;
  /** True when products and links are placeholders, so the UI can say so. */
  readonly isSampleData: boolean;
  /** Required disclosure text when links earn commission (e.g. FTC rules); null when none. */
  readonly affiliateDisclosure: string | null;
  search(query: CatalogQuery): Promise<Product[]>;
  categoryCounts(): Promise<Partial<Record<ProductCategory, number>>>;
}
