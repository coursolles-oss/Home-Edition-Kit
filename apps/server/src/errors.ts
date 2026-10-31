/** An error with an HTTP status and a stable machine-readable code the app can branch on. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** The model declined the request (safety classifier) and no fallback produced an answer. */
export class AiRefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`Model declined the request${category ? ` (category: ${category})` : ""}.`);
    this.name = "AiRefusalError";
  }
}

/** The model responded, but not with output matching the expected schema. */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}
