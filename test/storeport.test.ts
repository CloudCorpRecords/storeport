import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchFullDocs,
  formatPayload,
  introspectGraphqlSchema,
  learnShopifyApi,
  promptShopifyDevAssistant,
  resolveBaseUrl,
  searchDocsChunks,
  validateComponentCodeblocks,
  validateGraphqlCodeblocks,
} from "../src/storeport.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

interface Captured {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeFetch(captured: Captured, body: unknown = { ok: true }): FetchFn {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    captured.url = url;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = init?.body;
    return jsonResponse(body);
  };
}

describe("search", () => {
  it("POSTs to the docs search path with query and maxNumResults, no auth header", async () => {
    const c: Captured = {};
    await searchDocsChunks(fakeFetch(c, { chunks: [] }), { query: "webhooks", maxNumResults: 5 });
    assert.equal(c.url, "https://shopify.dev/api/docs/search");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), { query: "webhooks", maxNumResults: 5 });
    assert.equal(c.headers?.Authorization, undefined);
  });

  it("omits maxNumResults when it is not given", async () => {
    const c: Captured = {};
    await searchDocsChunks(fakeFetch(c), { query: "checkout" });
    assert.deepEqual(JSON.parse(c.body ?? "{}"), { query: "checkout" });
  });
});

describe("fetch_full_docs", () => {
  it("GETs an absolute URL exactly as-is", async () => {
    const c: Captured = {};
    await fetchFullDocs(fakeFetch(c, { text: "page" }), {
      url: "https://shopify.dev/docs/apps/build/checkout",
    });
    assert.equal(c.url, "https://shopify.dev/docs/apps/build/checkout");
    assert.equal(c.method, "GET");
    assert.equal(c.body, undefined);
  });

  it("joins a relative path onto the base URL", async () => {
    const c: Captured = {};
    await fetchFullDocs(fakeFetch(c), { url: "/docs/api/admin-graphql" });
    assert.equal(c.url, "https://shopify.dev/docs/api/admin-graphql");
    assert.equal(c.method, "GET");
  });
});

describe("introspect", () => {
  it("POSTs query with apiVersion when given", async () => {
    const c: Captured = {};
    await introspectGraphqlSchema(fakeFetch(c, { types: [] }), {
      query: "Product",
      apiVersion: "2025-10",
    });
    assert.equal(c.url, "https://shopify.dev/api/graphql/introspect");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), { query: "Product", apiVersion: "2025-10" });
  });

  it("omits apiVersion entirely (not null) when it is not given", async () => {
    const c: Captured = {};
    await introspectGraphqlSchema(fakeFetch(c), { query: "Order" });
    const body = JSON.parse(c.body ?? "{}") as Record<string, unknown>;
    assert.deepEqual(body, { query: "Order" });
    assert.equal("apiVersion" in body, false);
  });
});

describe("learn and prompt", () => {
  it("learn POSTs api only, adding conversationId only when given", async () => {
    const bare: Captured = {};
    await learnShopifyApi(fakeFetch(bare), { api: "admin-graphql" });
    assert.equal(bare.url, "https://shopify.dev/api/assistant/learn");
    assert.deepEqual(JSON.parse(bare.body ?? "{}"), { api: "admin-graphql" });
    const withId: Captured = {};
    await learnShopifyApi(fakeFetch(withId), { api: "functions", conversationId: "conv-1" });
    assert.deepEqual(JSON.parse(withId.body ?? "{}"), {
      api: "functions",
      conversationId: "conv-1",
    });
  });

  it("prompt POSTs to the assistant prompt path", async () => {
    const c: Captured = {};
    await promptShopifyDevAssistant(fakeFetch(c, { answer: "use a metafield" }), {
      prompt: "How do I store extra product data?",
      conversationId: "conv-9",
    });
    assert.equal(c.url, "https://shopify.dev/api/assistant/prompt");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      prompt: "How do I store extra product data?",
      conversationId: "conv-9",
    });
  });
});

describe("validation tools", () => {
  it("validate-graphql POSTs content and optional apiVersion", async () => {
    const c: Captured = {};
    await validateGraphqlCodeblocks(fakeFetch(c, { results: [] }), {
      content: "```graphql\n{ shop { name } }\n```",
      apiVersion: "2025-10",
    });
    assert.equal(c.url, "https://shopify.dev/api/validation/graphql");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      content: "```graphql\n{ shop { name } }\n```",
      apiVersion: "2025-10",
    });
    const bare: Captured = {};
    await validateGraphqlCodeblocks(fakeFetch(bare), { content: "{ shop { name } }" });
    assert.deepEqual(JSON.parse(bare.body ?? "{}"), { content: "{ shop { name } }" });
  });

  it("validate-components POSTs content to its own path", async () => {
    const c: Captured = {};
    await validateComponentCodeblocks(fakeFetch(c, { results: [] }), {
      content: "<s-page heading=\"Hi\"></s-page>",
    });
    assert.equal(c.url, "https://shopify.dev/api/validation/components");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      content: "<s-page heading=\"Hi\"></s-page>",
    });
  });
});

describe("argument validation and errors", () => {
  it("rejects an empty query before any request is made", async () => {
    let called = false;
    const spy: FetchFn = async () => {
      called = true;
      return jsonResponse({});
    };
    await assert.rejects(() => searchDocsChunks(spy, { query: "   " }), /query must be a non-empty/);
    await assert.rejects(() => promptShopifyDevAssistant(spy, { prompt: "" }), /prompt/);
    await assert.rejects(() => fetchFullDocs(spy, { url: "" }), /url/);
    await assert.rejects(() => validateComponentCodeblocks(spy, { content: "" }), /content/);
    assert.equal(called, false);
  });

  it("surfaces HTTP 500 with the upstream detail", async () => {
    const failing: FetchFn = async () =>
      jsonResponse({ detail: "docs index unavailable" }, 500, "Internal Server Error");
    await assert.rejects(
      () => searchDocsChunks(failing, { query: "orders" }),
      /HTTP 500.*docs index unavailable/,
    );
  });
});

describe("base URL override and formatting", () => {
  it("honours an explicit baseUrl argument and the env-shaped default", async () => {
    const c: Captured = {};
    await searchDocsChunks(fakeFetch(c), { query: "x" }, "https://example.test/dev/");
    assert.equal(c.url, "https://example.test/dev/api/docs/search");
    assert.equal(resolveBaseUrl("https://example.test/dev/"), "https://example.test/dev");
    const prev = process.env.SHOPIFY_DEV_BASE_URL;
    process.env.SHOPIFY_DEV_BASE_URL = "https://mirror.example/";
    try {
      assert.equal(resolveBaseUrl(), "https://mirror.example");
    } finally {
      if (prev === undefined) delete process.env.SHOPIFY_DEV_BASE_URL;
      else process.env.SHOPIFY_DEV_BASE_URL = prev;
    }
  });

  it("formatPayload renders two-space JSON", () => {
    assert.equal(formatPayload({ a: 1 }), '{\n  "a": 1\n}');
  });
});
