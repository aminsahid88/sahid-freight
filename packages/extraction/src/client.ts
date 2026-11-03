/**
 * Model client for extraction. One interface, two implementations:
 *  - AnthropicExtractor: the real thing (Claude vision via the official SDK,
 *    structured output validated against the contract schema).
 *  - FakeExtractor: deterministic, for tests and the offline evaluator; serves
 *    canned responses keyed by file hash.
 *
 * Model IDs and prompt versions come from the caller (env), never hard-coded.
 */
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { receiptExtraction, type ReceiptExtraction } from "./contract";
import type { PassPrompt } from "./prompts";

export type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export type DocumentMime = "application/pdf";
export type ExtractableMime = ImageMime | DocumentMime;

export const EXTRACTABLE_MIMES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

export interface ExtractionInput {
  bytes: Uint8Array;
  mimeType: ExtractableMime;
  prompt: PassPrompt;
  model: string;
  /** Effort level forwarded to the model; "low" is enough for literal transcription. */
  effort?: "low" | "medium" | "high";
}

export interface ExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ExtractionOutput {
  /** Contract-shaped result, or null when the model's output did not validate. */
  result: ReceiptExtraction | null;
  /** Raw text/JSON returned, kept verbatim for the audit trail. */
  raw: unknown;
  usage: ExtractionUsage;
  latencyMs: number;
  model: string;
  stopReason: string | null;
  error: string | null;
}

export interface Extractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionOutput>;
}

// Strict schema for structured output: same shape as the contract, with the
// field map expressed as a fixed object so the model is held to known keys.
const fieldSchema = z.object({
  raw_text: z.string().nullable(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  legibility: z.enum(["clear", "partial", "unreadable"]),
});
const FIELD_KEYS = ["transaction_date", "time", "vendor", "seller_address", "state", "unit_number", "odometer", "driver_name", "purchaser_name", "payment_method", "card_last4", "pump_number", "receipt_total", "currency"] as const;
const fieldsSchema = z.object(Object.fromEntries(FIELD_KEYS.map((k) => [k, fieldSchema])) as Record<(typeof FIELD_KEYS)[number], typeof fieldSchema>);
const lineSchema = z.object({
  description_raw: z.string(),
  category: z.enum(["motor_fuel", "reefer_fuel", "def", "non_fuel", "tax", "fee", "discount", "credit"]),
  fuel_type: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.enum(["gal", "L", "each"]).nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable(),
  legibility: z.enum(["clear", "partial", "unreadable"]),
});
export const modelOutputSchema = z.object({
  receipts: z.array(z.object({ region_hint: z.string().nullable(), fields: fieldsSchema, line_items: z.array(lineSchema) })),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export class AnthropicExtractor implements Extractor {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  constructor(opts: { apiKey?: string; client?: Anthropic } = {}) {
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async extract(input: ExtractionInput): Promise<ExtractionOutput> {
    const started = Date.now();
    const content: Anthropic.ContentBlockParam[] =
      input.mimeType === "application/pdf"
        ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(input.bytes) } }]
        : [{ type: "image", source: { type: "base64", media_type: input.mimeType, data: toBase64(input.bytes) } }];
    content.push({ type: "text", text: input.prompt.user });

    try {
      const response = await this.client.messages.parse({
        model: input.model,
        max_tokens: 8000,
        system: [{ type: "text", text: input.prompt.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(modelOutputSchema), effort: input.effort ?? "low" },
      });
      const usage: ExtractionUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      };
      const parsed = response.parsed_output;
      const validated = parsed ? receiptExtraction.safeParse(parsed) : null;
      return {
        result: validated?.success ? validated.data : null,
        raw: parsed ?? response.content,
        usage,
        latencyMs: Date.now() - started,
        model: response.model,
        stopReason: response.stop_reason,
        error: response.stop_reason === "refusal" ? "refusal" : validated && !validated.success ? "contract_validation_failed" : parsed ? null : "no_parsed_output",
      };
    } catch (err) {
      const e = err as Error & { status?: number };
      return {
        result: null,
        raw: null,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        latencyMs: Date.now() - started,
        model: input.model,
        stopReason: null,
        error: `${e.name}${e.status ? ` ${e.status}` : ""}: ${e.message}`,
      };
    }
  }
}

/** Deterministic stand-in: answers from a map of sha256 → contract output. */
export class FakeExtractor implements Extractor {
  readonly name = "fake";
  readonly calls: Array<{ sha256: string; pass: "A" | "B"; model: string }> = [];
  constructor(private readonly answers: Map<string, ReceiptExtraction | ((pass: "A" | "B") => ReceiptExtraction)>, private readonly opts: { latencyMs?: number; tokens?: number } = {}) {}

  async extract(input: ExtractionInput): Promise<ExtractionOutput> {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    this.calls.push({ sha256, pass: input.prompt.pass, model: input.model });
    const answer = this.answers.get(sha256);
    const result = typeof answer === "function" ? answer(input.prompt.pass) : (answer ?? null);
    return {
      result,
      raw: result,
      usage: { inputTokens: this.opts.tokens ?? 1500, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 },
      latencyMs: this.opts.latencyMs ?? 1,
      model: input.model,
      stopReason: result ? "end_turn" : null,
      error: result ? null : "no_fake_answer",
    };
  }
}

/** USD per million tokens, from the provider's published list (checked 2026-11-03). Unknown models cost 0 and are flagged. */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** Cost as a decimal string with 5 places (matches ExtractionRun.costUsd). Integer micro-dollar math, no floats on money. */
export function estimateCostUsd(model: string, usage: ExtractionUsage): { costUsd: string; known: boolean } {
  const p = MODEL_PRICES_USD_PER_MTOK[model];
  if (!p) return { costUsd: "0.00000", known: false };
  // price per token in units of 1e-11 USD to keep integers exact: (usd/MTok) * 1e5 = units per token when cost expressed in 1e-11.
  const unit = (usd: number) => Math.round(usd * 100000); // 1e-11 USD per token
  const total =
    BigInt(usage.inputTokens) * BigInt(unit(p.input)) +
    BigInt(usage.outputTokens) * BigInt(unit(p.output)) +
    BigInt(usage.cacheReadTokens) * BigInt(unit(p.cacheRead)) +
    BigInt(usage.cacheWriteTokens) * BigInt(unit(p.cacheWrite));
  // total is in 1e-11 USD; we want 5 decimals (1e-5): divide by 1e6 with rounding.
  const scaled = (total + 500000n) / 1000000n;
  const whole = scaled / 100000n;
  const frac = (scaled % 100000n).toString().padStart(5, "0");
  return { costUsd: `${whole}.${frac}`, known: true };
}
