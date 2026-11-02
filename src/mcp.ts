/**
 * storeport MCP server. Tools: learn_shopify_api, search_docs_chunks,
 * fetch_full_docs, introspect_graphql_schema,
 * prompt_shopify_dev_assistant, validate_graphql_codeblocks,
 * validate_component_codeblocks.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas as explicit literals,
 * while zod still validates every tools/call argument set.
 *
 * The upstream Shopify developer service is keyless: no API key or
 * store token is read or required, and no missing-key error exists.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const LearnArgs = z.object({
  api: z.string(),
  conversationId: z.string().optional(),
});
const SearchArgs = z.object({
  query: z.string(),
  maxNumResults: z.number().optional(),
});
const FetchDocsArgs = z.object({ url: z.string() });
const IntrospectArgs = z.object({
  query: z.string(),
  apiVersion: z.string().optional(),
});
const PromptArgs = z.object({
  prompt: z.string(),
  conversationId: z.string().optional(),
});
const ValidateGraphqlArgs = z.object({
  content: z.string(),
  apiVersion: z.string().optional(),
});
const ValidateComponentsArgs = z.object({ content: z.string() });

const TOOLS = [
  {
    name: "learn_shopify_api",
    description: "Start or continue learning a Shopify API surface; returns the guided learning context for the named API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api: { type: "string", description: "The name of the Shopify API surface to learn (e.g. the API to return guided learning context for)." },
        conversationId: { type: "string", description: "Optional conversation identifier to continue an existing learning conversation." },
      },
      required: ["api"],
    },
  },
  {
    name: "search_docs_chunks",
    description: "Search Shopify developer documentation and return the most relevant chunks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query to match against Shopify developer documentation." },
        maxNumResults: { type: "number", description: "Optional maximum number of documentation chunks to return." },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_full_docs",
    description: "Fetch the full text of one Shopify documentation page by its URL or path.",
    inputSchema: {
      type: "object" as const,
      properties: { url: { type: "string", description: "The URL or path of the Shopify documentation page to fetch in full." } },
      required: ["url"],
    },
  },
  {
    name: "introspect_graphql_schema",
    description: "Introspect the Shopify Admin GraphQL schema: search types and fields matching a query term.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The term to search Shopify Admin GraphQL schema types and fields for." },
        apiVersion: { type: "string", description: "Optional Shopify API version to introspect the schema for." },
      },
      required: ["query"],
    },
  },
  {
    name: "prompt_shopify_dev_assistant",
    description: "Ask the Shopify developer assistant a question and return its answer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "The question or prompt to ask the Shopify developer assistant." },
        conversationId: { type: "string", description: "Optional conversation identifier to continue an existing assistant conversation." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "validate_graphql_codeblocks",
    description: "Validate GraphQL code blocks for the Shopify Admin API and return validation results per block.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "The content containing GraphQL code blocks to validate." },
        apiVersion: { type: "string", description: "Optional Shopify API version to validate the GraphQL code blocks against." },
      },
      required: ["content"],
    },
  },
  {
    name: "validate_component_codeblocks",
    description: "Validate Shopify component code blocks (Polaris/web components) in the given content.",
    inputSchema: {
      type: "object" as const,
      properties: { content: { type: "string", description: "The content containing Shopify component code blocks to validate." } },
      required: ["content"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "storeport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    let out: unknown;
    if (name === "learn_shopify_api") {
      out = await learnShopifyApi(fetchFn, LearnArgs.parse(args ?? {}));
    } else if (name === "search_docs_chunks") {
      out = await searchDocsChunks(fetchFn, SearchArgs.parse(args ?? {}));
    } else if (name === "fetch_full_docs") {
      out = await fetchFullDocs(fetchFn, FetchDocsArgs.parse(args ?? {}));
    } else if (name === "introspect_graphql_schema") {
      out = await introspectGraphqlSchema(fetchFn, IntrospectArgs.parse(args ?? {}));
    } else if (name === "prompt_shopify_dev_assistant") {
      out = await promptShopifyDevAssistant(fetchFn, PromptArgs.parse(args ?? {}));
    } else if (name === "validate_graphql_codeblocks") {
      out = await validateGraphqlCodeblocks(fetchFn, ValidateGraphqlArgs.parse(args ?? {}));
    } else if (name === "validate_component_codeblocks") {
      out = await validateComponentCodeblocks(fetchFn, ValidateComponentsArgs.parse(args ?? {}));
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
