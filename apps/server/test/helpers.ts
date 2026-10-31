import { emptyProfile, type RoomAnalysis } from "@home-kit/shared";
import { MockAiService } from "../src/ai/mock";
import { createApp, type AppDeps } from "../src/app";
import { SampleCatalog } from "../src/catalog/sample";

export const testConfig: AppDeps["config"] = {
  CORS_ORIGINS: undefined,
  RATE_LIMIT_MAX: 1000,
  RATE_LIMIT_WINDOW_MIN: 15,
  TRUST_PROXY: 0,
};

export function makeApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    ai: new MockAiService(),
    catalog: new SampleCatalog(),
    config: testConfig,
    ...overrides,
  });
}

export async function sampleAnalysis(): Promise<RoomAnalysis> {
  return new MockAiService().analyzeRoom({ media_type: "image/jpeg", data_base64: "x" });
}

export const blankProfile = emptyProfile;

/** Smallest bytes that carry a JPEG signature; enough for the server's format check. */
export const TINY_JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
