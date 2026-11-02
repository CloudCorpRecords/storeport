#!/usr/bin/env node
/**
 * storeport CLI.
 *
 *   storeport learn <api> [--conversation-id id]
 *   storeport search <query> [--max n]
 *   storeport docs <url>
 *   storeport introspect <query> [--api-version v]
 *   storeport ask <prompt> [--conversation-id id]
 *   storeport validate-graphql <content> [--api-version v]
 *   storeport validate-components <content>
 *   storeport mcp
 *
 * The upstream Shopify developer service is keyless; no token or API
 * key is required. The base URL defaults to https://shopify.dev and
 * can be overridden with SHOPIFY_DEV_BASE_URL.
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  fetchFullDocs,
  formatPayload,
  introspectGraphqlSchema,
  learnShopifyApi,
  promptShopifyDevAssistant,
  searchDocsChunks,
  validateComponentCodeblocks,
  validateGraphqlCodeblocks,
  VERSION,
} from "./storeport.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  storeport learn <api> [--conversation-id id]
  storeport search <query> [--max n]
  storeport docs <url>
  storeport introspect <query> [--api-version v]
  storeport ask <prompt> [--conversation-id id]
  storeport validate-graphql <content> [--api-version v]
  storeport validate-components <content>
  storeport mcp
  storeport --version`);
  process.exit(2);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function withoutFlags(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.includes(args[i])) i++;
    else out.push(args[i]);
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const known = [
    "learn", "search", "docs", "introspect", "ask",
    "validate-graphql", "validate-components",
  ];
  if (!known.includes(cmd)) usage();
  try {
    let out: unknown;
    if (cmd === "learn") {
      const pos = withoutFlags(rest, ["--conversation-id"]);
      if (!pos[0]) usage();
      out = await learnShopifyApi(fetchFn, {
        api: pos[0],
        conversationId: flagValue(rest, "--conversation-id"),
      });
    } else if (cmd === "search") {
      const pos = withoutFlags(rest, ["--max"]);
      if (!pos[0]) usage();
      const maxRaw = flagValue(rest, "--max");
      const max = maxRaw !== undefined ? Number(maxRaw) : undefined;
      if (maxRaw !== undefined && (!Number.isFinite(max) || (max as number) <= 0)) usage();
      out = await searchDocsChunks(fetchFn, { query: pos[0], maxNumResults: max });
    } else if (cmd === "docs") {
      if (!rest[0]) usage();
      out = await fetchFullDocs(fetchFn, { url: rest[0] });
    } else if (cmd === "introspect") {
      const pos = withoutFlags(rest, ["--api-version"]);
      if (!pos[0]) usage();
      out = await introspectGraphqlSchema(fetchFn, {
        query: pos[0],
        apiVersion: flagValue(rest, "--api-version"),
      });
    } else if (cmd === "ask") {
      const pos = withoutFlags(rest, ["--conversation-id"]);
      if (!pos[0]) usage();
      out = await promptShopifyDevAssistant(fetchFn, {
        prompt: pos[0],
        conversationId: flagValue(rest, "--conversation-id"),
      });
    } else if (cmd === "validate-graphql") {
      const pos = withoutFlags(rest, ["--api-version"]);
      if (!pos[0]) usage();
      out = await validateGraphqlCodeblocks(fetchFn, {
        content: pos[0],
        apiVersion: flagValue(rest, "--api-version"),
      });
    } else {
      if (!rest[0]) usage();
      out = await validateComponentCodeblocks(fetchFn, { content: rest[0] });
    }
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
