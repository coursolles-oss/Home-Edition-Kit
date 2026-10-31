import type { Product, ProductCategory } from "@home-kit/shared";

/*
 * SAMPLE DATA ONLY. Brands, products and prices are invented, and every link points at
 * example.com. This exists so the whole flow can be built and tested before a real product
 * source (affiliate feed / retailer API) is connected.
 */

type Row = [
  id: string,
  category: ProductCategory,
  name: string,
  brand: string,
  priceUsd: number,
  colors: string[],
  styles: string[],
  dimensions: string | null,
];

const rows: Row[] = [
  // Sofas & seating
  ["sofa-linen-oat", "sofa", "Linen Three-Seat Sofa", "Haven & Co", 899, ["oat", "beige"], ["modern", "scandinavian", "coastal"], '84 x 36 x 33 in'],
  ["sofa-velvet-green", "sofa", "Curved Velvet Sofa", "Oakline", 1249, ["forest green"], ["mid-century", "glam"], '80 x 35 x 31 in'],
  ["sofa-performance-grey", "sofa", "Performance Fabric Sofa", "Fernwood", 749, ["grey"], ["modern", "family-friendly"], '86 x 37 x 34 in'],
  ["sofa-boucle-cream", "sofa", "Boucle Sofa", "Haven & Co", 1099, ["cream"], ["modern", "japandi"], '82 x 38 x 30 in'],
  ["sectional-charcoal", "sectional", "L-Shaped Sectional", "Fernwood", 1399, ["charcoal"], ["modern", "family-friendly"], '112 x 66 x 34 in'],
  ["loveseat-navy", "loveseat", "Compact Loveseat", "Oakline", 549, ["navy"], ["modern", "traditional"], '58 x 33 x 33 in'],
  ["armchair-rattan", "armchair", "Rattan Armchair", "Cove & Cane", 329, ["natural"], ["boho", "coastal"], '29 x 31 x 32 in'],
  ["armchair-leather-cognac", "armchair", "Leather Club Chair", "Oakline", 599, ["cognac", "brown"], ["traditional", "mid-century"], '31 x 33 x 31 in'],
  ["armchair-swivel-sage", "armchair", "Swivel Accent Chair", "Haven & Co", 289, ["sage", "green"], ["modern", "japandi"], '28 x 29 x 30 in'],
  ["ottoman-round-tan", "ottoman", "Round Storage Ottoman", "Fernwood", 119, ["tan"], ["modern", "family-friendly"], '24 x 24 x 17 in'],

  // Tables & storage
  ["coffee-walnut", "coffee_table", "Walnut Coffee Table", "Oakline", 299, ["walnut", "brown"], ["mid-century"], '44 x 24 x 16 in'],
  ["coffee-marble-round", "coffee_table", "Round Marble Coffee Table", "Gilt & Grain", 389, ["white", "gold"], ["glam", "modern"], '34 x 34 x 17 in'],
  ["coffee-oak-light", "coffee_table", "Light Oak Coffee Table", "Haven & Co", 219, ["oak", "natural"], ["scandinavian", "japandi"], '42 x 22 x 16 in'],
  ["side-brass", "side_table", "Brass Side Table", "Gilt & Grain", 89, ["brass", "gold"], ["glam", "mid-century"], '16 x 16 x 22 in'],
  ["side-oak-nesting", "side_table", "Oak Nesting Side Tables", "Haven & Co", 129, ["oak", "natural"], ["scandinavian", "japandi"], '2-piece set'],
  ["console-slim-black", "console_table", "Slim Entry Console", "Fernwood", 179, ["black"], ["modern", "industrial"], '40 x 12 x 31 in'],
  ["tv-walnut", "tv_stand", "Walnut Media Console", "Oakline", 449, ["walnut", "brown"], ["mid-century"], '60 x 16 x 24 in'],
  ["tv-oak-white", "tv_stand", "White Oak Media Console", "Haven & Co", 399, ["oak", "white"], ["scandinavian", "modern"], '58 x 16 x 22 in'],
  ["bookcase-black-5", "bookshelf", "5-Tier Open Bookcase", "Fernwood", 169, ["black"], ["industrial", "modern"], '30 x 12 x 72 in'],
  ["bookcase-oak-ladder", "bookshelf", "Oak Ladder Shelf", "Haven & Co", 139, ["oak", "natural"], ["scandinavian", "boho"], '24 x 14 x 68 in'],
  ["cabinet-rattan-door", "storage_cabinet", "Rattan Door Cabinet", "Cove & Cane", 349, ["natural"], ["boho", "coastal"], '32 x 15 x 32 in'],
  ["shelf-floating-walnut", "wall_shelf", "Floating Wall Shelves, Set of 3 (needs mounting)", "Fernwood", 59, ["walnut", "brown"], ["modern", "mid-century"], '3-piece set'],

  // Rugs
  ["rug-wool-ivory", "rug", "Wool Blend Area Rug 8x10", "Haven & Co", 289, ["ivory", "grey"], ["modern", "scandinavian"], '8 x 10 ft'],
  ["rug-washable-rust", "rug", "Washable Vintage-Style Rug 8x10", "Fernwood", 199, ["rust", "navy"], ["traditional", "boho", "family-friendly"], '8 x 10 ft'],
  ["rug-jute-natural", "rug", "Woven Jute Rug 8x10", "Cove & Cane", 179, ["natural", "beige"], ["coastal", "boho"], '8 x 10 ft'],
  ["rug-geo-grey-5x8", "rug", "Low-Pile Geometric Rug 5x8", "Fernwood", 129, ["grey", "white"], ["modern"], '5 x 8 ft'],

  // Lighting
  ["lamp-arc-brass", "floor_lamp", "Arc Floor Lamp", "Gilt & Grain", 139, ["brass", "gold"], ["mid-century", "modern"], '72 in tall'],
  ["lamp-paper-lantern", "floor_lamp", "Paper Lantern Floor Lamp", "Haven & Co", 49, ["white"], ["japandi", "scandinavian"], '58 in tall'],
  ["lamp-ceramic-sage", "table_lamp", "Ceramic Table Lamp", "Cove & Cane", 69, ["sage", "cream"], ["modern", "coastal"], '24 in tall'],
  ["lamp-brass-task", "table_lamp", "Brass Task Lamp", "Gilt & Grain", 59, ["brass"], ["mid-century", "industrial"], '20 in tall'],
  ["pendant-rattan", "pendant_light", "Rattan Pendant Light", "Cove & Cane", 99, ["natural"], ["boho", "coastal"], '18 in wide'],

  // Walls & windows
  ["art-abstract-terracotta", "wall_art", "Abstract Canvas Print 36x48", "Studio Nine", 129, ["terracotta", "cream"], ["modern", "boho"], '36 x 48 in'],
  ["art-botanical-set", "wall_art", "Botanical Print Set of 3", "Studio Nine", 69, ["green", "cream"], ["coastal", "traditional"], '3 x 16 x 20 in'],
  ["mirror-round-brass", "mirror", "Round Brass Mirror 30in", "Gilt & Grain", 109, ["brass", "gold"], ["glam", "mid-century"], '30 in diameter'],
  ["mirror-arched-floor", "mirror", "Arched Floor Mirror", "Fernwood", 159, ["black"], ["modern"], '24 x 70 in'],
  ["curtains-linen-oat", "curtains", "Linen-Blend Curtains, 2 Panels", "Haven & Co", 59, ["oat", "white"], ["coastal", "scandinavian"], '52 x 84 in each'],
  ["curtains-velvet-navy", "curtains", "Blackout Velvet Curtains, 2 Panels", "Oakline", 79, ["navy", "green"], ["glam", "traditional"], '52 x 84 in each'],

  // Soft goods & greenery
  ["pillows-textured-warm", "throw_pillows", "Textured Pillow Covers, Set of 4", "Studio Nine", 34, ["mustard", "rust", "cream"], ["boho", "modern"], '18 x 18 in'],
  ["pillows-linen-sage", "throw_pillows", "Solid Linen Pillows, Set of 2", "Haven & Co", 39, ["sage", "oat"], ["japandi", "scandinavian", "coastal"], '20 x 20 in'],
  ["throw-chunky-cream", "throw_blanket", "Chunky Knit Throw", "Haven & Co", 59, ["cream"], ["scandinavian", "boho"], '50 x 60 in'],
  ["throw-waffle-grey", "throw_blanket", "Waffle Cotton Throw", "Fernwood", 39, ["grey", "sage"], ["modern", "family-friendly"], '50 x 70 in'],
  ["plant-faux-fiddle", "plant", "Faux Fiddle Leaf Fig, 5 ft", "Greenhouse", 89, ["green"], ["modern", "traditional"], '60 in tall'],
  ["plant-snake-live", "plant", "Live Snake Plant", "Greenhouse", 29, ["green"], ["modern", "japandi"], '18 in tall'],
  ["planter-ceramic-12", "planter", "Ceramic Planter 12in", "Greenhouse", 34, ["white", "terracotta"], ["modern", "boho"], '12 in diameter'],
  ["basket-seagrass", "storage_basket", "Woven Seagrass Basket", "Cove & Cane", 39, ["natural"], ["boho", "coastal"], '16 x 16 x 14 in'],

  // Bedroom
  ["bed-upholstered-queen", "bed_frame", "Upholstered Queen Bed", "Oakline", 599, ["grey", "oat"], ["modern", "traditional"], 'Queen'],
  ["bed-oak-platform", "bed_frame", "Solid Oak Platform Bed, Queen", "Haven & Co", 799, ["oak", "natural"], ["scandinavian", "japandi", "mid-century"], 'Queen'],
  ["nightstand-oak", "nightstand", "Oak Nightstand", "Haven & Co", 139, ["oak", "natural"], ["scandinavian", "mid-century"], '18 x 15 x 22 in'],
  ["dresser-6-walnut", "dresser", "6-Drawer Dresser", "Oakline", 449, ["walnut", "brown"], ["mid-century"], '56 x 18 x 32 in'],

  // Work & dining
  ["desk-standing", "desk", "Electric Standing Desk", "Fernwood", 349, ["white", "oak"], ["modern"], '55 x 28 in'],
  ["desk-writing-compact", "desk", "Compact Writing Desk", "Haven & Co", 179, ["oak", "white"], ["scandinavian", "japandi"], '42 x 20 x 30 in'],
  ["chair-ergo-mesh", "desk_chair", "Ergonomic Mesh Chair", "Fernwood", 249, ["black", "grey"], ["modern"], null],
  ["dining-table-oak-round", "dining_table", "Round Oak Dining Table", "Haven & Co", 549, ["oak", "natural"], ["scandinavian", "mid-century"], '48 in diameter'],
  ["dining-chair-cane-2", "dining_chair", "Cane-Back Dining Chairs, Set of 2", "Cove & Cane", 189, ["natural", "black"], ["boho", "mid-century"], '2-piece set'],
];

export const SAMPLE_RETAILER = "Sample Store";

export const SAMPLE_PRODUCTS: Product[] = rows.map(
  ([id, category, name, brand, price_usd, colors, styles, dimensions]) => ({
    id,
    category,
    name,
    brand,
    retailer: SAMPLE_RETAILER,
    price_usd,
    colors,
    styles,
    dimensions,
    image_url: null,
    url: `https://example.com/sample-products/${id}`,
  }),
);
