/**
 * Minimal structured logger. Never pass user photos or chat text in here: room photos and
 * conversations are private, so logs carry only metadata (route, status, token counts).
 */
const silent = () => process.env.NODE_ENV === "test";

function emit(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  if (silent()) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(line);
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
};
