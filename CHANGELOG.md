# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `storeport learn|search|docs|introspect|ask|validate-graphql|validate-components`
  and `storeport mcp`; the upstream Shopify developer service is keyless, so no
  token or API key is read or required.
- MCP server (`storeport mcp`, stdio) with seven tools: `learn_shopify_api`,
  `search_docs_chunks`, `fetch_full_docs`, `introspect_graphql_schema`,
  `prompt_shopify_dev_assistant`, `validate_graphql_codeblocks`, and
  `validate_component_codeblocks`.
- Calls go to the Shopify developer service under `https://shopify.dev`
  (overridable via `SHOPIFY_DEV_BASE_URL`) with no authorization header;
  HTTP failures surface the status plus the upstream message/detail when present.
- `fetch_full_docs` fetches an absolute URL as-is and joins a relative
  path onto the base URL; optional fields such as `apiVersion` and
  `conversationId` are omitted from request bodies when not given.
- Empty queries, prompts, content, and URLs fail honestly before any
  request is made.
- All HTTP goes through an injectable fetch function, so the test
  suite runs entirely on hand-written fixtures with no network access.
