/**
 * storeport types.
 *
 * Shapes follow the documented Shopify developer surface: learning
 * and assistant tools are keyed by an API / prompt plus an optional
 * conversation id, docs tools take a query or a page URL, schema
 * introspection and GraphQL validation accept an optional API
 * version, and component validation takes content only. HTTP access
 * is described by a minimal response surface so tests can inject a
 * fake fetch and never touch the network.
 */

export interface LearnShopifyApiOptions {
  api: string;
  conversationId?: string;
}

export interface SearchDocsChunksOptions {
  query: string;
  maxNumResults?: number;
}

export interface FetchFullDocsOptions {
  url: string;
}

export interface IntrospectGraphqlSchemaOptions {
  query: string;
  apiVersion?: string;
}

export interface PromptShopifyDevAssistantOptions {
  prompt: string;
  conversationId?: string;
}

export interface ValidateGraphqlCodeblocksOptions {
  content: string;
  apiVersion?: string;
}

export interface ValidateComponentCodeblocksOptions {
  content: string;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
