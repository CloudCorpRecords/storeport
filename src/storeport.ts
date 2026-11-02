/**
 * storeport core: seven tools against the Shopify developer surface.
 *
 * The upstream is the keyless Shopify developer service at
 * https://shopify.dev — no store token, no API key, and no auth
 * header. The base can be overridden with the SHOPIFY_DEV_BASE_URL
 * environment variable, or per call with the optional baseUrl
 * argument every function accepts.
 *
 *   learn_shopify_api               POST /api/assistant/learn
 *   search_docs_chunks              POST /api/docs/search
 *   fetch_full_docs                 GET  <url as-is, or base + path>
 *   introspect_graphql_schema       POST /api/graphql/introspect
 *   prompt_shopify_dev_assistant    POST /api/assistant/prompt
 *   validate_graphql_codeblocks     POST /api/validation/graphql
 *   validate_component_codeblocks   POST /api/validation/components
 *
 * These endpoint paths are docs-derived reconstructions (see the
 * fixture _source and BUILD-REPORT): they are the first check at
 * publish-wave live smoke and were not hand-probed here.
 *
 * Empty query / prompt / content / url arguments are rejected
 * before any request is made. HTTP failures surface the status plus
 * the upstream message/detail when its JSON body provides one. All
 * HTTP goes through an injected FetchFn so everything is testable
 * offline.
 */
import type {
  FetchFn,
  FetchFullDocsOptions,
  IntrospectGraphqlSchemaOptions,
  LearnShopifyApiOptions,
  PromptShopifyDevAssistantOptions,
  SearchDocsChunksOptions,
  ValidateComponentCodeblocksOptions,
  ValidateGraphqlCodeblocksOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const API_BASE = "https://shopify.dev";

export const BASE_URL_ENV = "SHOPIFY_DEV_BASE_URL";

/** Resolve the effective base URL: explicit arg, then env, then const. */
export function resolveBaseUrl(baseUrl?: string): string {
  const raw =
    (typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : undefined) ??
    (typeof process.env[BASE_URL_ENV] === "string" && process.env[BASE_URL_ENV]?.trim()
      ? (process.env[BASE_URL_ENV] as string).trim()
      : undefined) ??
    API_BASE;
  return raw.replace(/\/+$/, "");
}

function requireText(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPayload(response: {
  json(): Promise<unknown>;
  text(): Promise<string>;
}): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }
}

async function callShopify(
  fetchFn: FetchFn,
  pathOrUrl: string,
  init: { method?: string; body?: unknown } = {},
  baseUrl?: string,
): Promise<unknown> {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${resolveBaseUrl(baseUrl)}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  let response;
  try {
    response = await fetchFn(url, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `Shopify dev request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        const parts = ["message", "detail", "error"]
          .map((k) => (typeof payload[k] === "string" ? (payload[k] as string) : ""))
          .filter(Boolean);
        if (parts.length) detail = `: ${parts.join(" - ")}`;
      } else if (typeof payload === "string" && payload.trim()) {
        detail = `: ${payload.trim()}`;
      }
    } catch {
      // A non-JSON error body still reports its HTTP status below.
    }
    throw new Error(
      `Shopify dev request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  return readPayload(response);
}

/** Start or continue learning a Shopify API surface. */
export async function learnShopifyApi(
  fetchFn: FetchFn,
  options: LearnShopifyApiOptions,
  baseUrl?: string,
): Promise<unknown> {
  const api = requireText(options.api, "api");
  const body: Record<string, unknown> = { api };
  if (options.conversationId !== undefined) body.conversationId = options.conversationId;
  return callShopify(fetchFn, "/api/assistant/learn", { method: "POST", body }, baseUrl);
}

/** Search Shopify developer documentation chunks. */
export async function searchDocsChunks(
  fetchFn: FetchFn,
  options: SearchDocsChunksOptions,
  baseUrl?: string,
): Promise<unknown> {
  const query = requireText(options.query, "query");
  const body: Record<string, unknown> = { query };
  if (options.maxNumResults !== undefined) body.maxNumResults = options.maxNumResults;
  return callShopify(fetchFn, "/api/docs/search", { method: "POST", body }, baseUrl);
}

/** Fetch the full text of one documentation page by URL or path. */
export async function fetchFullDocs(
  fetchFn: FetchFn,
  options: FetchFullDocsOptions,
  baseUrl?: string,
): Promise<unknown> {
  const url = requireText(options.url, "url");
  return callShopify(fetchFn, url, { method: "GET" }, baseUrl);
}

/** Introspect the Shopify Admin GraphQL schema for a query term. */
export async function introspectGraphqlSchema(
  fetchFn: FetchFn,
  options: IntrospectGraphqlSchemaOptions,
  baseUrl?: string,
): Promise<unknown> {
  const query = requireText(options.query, "query");
  const body: Record<string, unknown> = { query };
  if (options.apiVersion !== undefined) body.apiVersion = options.apiVersion;
  return callShopify(fetchFn, "/api/graphql/introspect", { method: "POST", body }, baseUrl);
}

/** Ask the Shopify developer assistant a question. */
export async function promptShopifyDevAssistant(
  fetchFn: FetchFn,
  options: PromptShopifyDevAssistantOptions,
  baseUrl?: string,
): Promise<unknown> {
  const prompt = requireText(options.prompt, "prompt");
  const body: Record<string, unknown> = { prompt };
  if (options.conversationId !== undefined) body.conversationId = options.conversationId;
  return callShopify(fetchFn, "/api/assistant/prompt", { method: "POST", body }, baseUrl);
}

/** Validate GraphQL code blocks for the Shopify Admin API. */
export async function validateGraphqlCodeblocks(
  fetchFn: FetchFn,
  options: ValidateGraphqlCodeblocksOptions,
  baseUrl?: string,
): Promise<unknown> {
  const content = requireText(options.content, "content");
  const body: Record<string, unknown> = { content };
  if (options.apiVersion !== undefined) body.apiVersion = options.apiVersion;
  return callShopify(fetchFn, "/api/validation/graphql", { method: "POST", body }, baseUrl);
}

/** Validate Shopify component code blocks in the given content. */
export async function validateComponentCodeblocks(
  fetchFn: FetchFn,
  options: ValidateComponentCodeblocksOptions,
  baseUrl?: string,
): Promise<unknown> {
  const content = requireText(options.content, "content");
  const body: Record<string, unknown> = { content };
  return callShopify(fetchFn, "/api/validation/components", { method: "POST", body }, baseUrl);
}

/** Render an upstream payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}
