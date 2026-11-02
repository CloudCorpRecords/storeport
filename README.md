# storeport

storeport is a small companion for building on Shopify. Shopify's
developer surface is broad — many APIs, a large GraphQL schema, and a
lot of documentation — so storeport gathers the everyday developer
tasks into one place: start learning an API with guided context,
search the documentation and pull a full page when a chunk is not
enough, look up types and fields in the Admin GraphQL schema, ask
the developer assistant a direct question, and check GraphQL and
component code blocks before they ship. One binary serves a
command-line interface and a stdio MCP server.

No Shopify store token and no API key are required. The upstream is
Shopify's public developer service, and storeport sends no
authorization header. The base URL defaults to
`https://shopify.dev` and can be overridden with the
`SHOPIFY_DEV_BASE_URL` environment variable.

## Install

```bash
npx @reneturcios/storeport search "metafields"
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/storeport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

```bash
storeport learn admin-graphql
storeport learn functions --conversation-id conv-1
storeport search "checkout extensibility"
storeport search webhooks --max 5
storeport docs https://shopify.dev/docs/apps/build/checkout
storeport docs /docs/api/admin-graphql
storeport introspect Product
storeport introspect Order --api-version 2025-10
storeport ask "How do I store extra product data?"
storeport validate-graphql '{ shop { name } }'
storeport validate-components '<s-page heading="Hi"></s-page>'

storeport --version
```

Each command prints the upstream JSON payload. Exit codes: `0` on
success, `1` when a call fails (including an upstream API error),
`2` for usage errors. Empty queries, prompts, content, and URLs are
rejected before any request is made.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/storeport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "storeport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/storeport", "mcp"]
    }
  }
}
```

No `env` block is needed: the server is keyless.

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `learn_shopify_api` | `api` (required), `conversationId` (optional) | The guided learning context for the named API. |
| `search_docs_chunks` | `query` (required), `maxNumResults` (optional) | The most relevant documentation chunks. |
| `fetch_full_docs` | `url` (required) | The full text of one documentation page; an absolute URL is fetched as-is, a path is joined to the base URL. |
| `introspect_graphql_schema` | `query` (required), `apiVersion` (optional) | Admin GraphQL types and fields matching the term. |
| `prompt_shopify_dev_assistant` | `prompt` (required), `conversationId` (optional) | The developer assistant's answer. |
| `validate_graphql_codeblocks` | `content` (required), `apiVersion` (optional) | Validation results per GraphQL code block. |
| `validate_component_codeblocks` | `content` (required) | Validation results for Shopify component code blocks. |

All calls go to the Shopify developer service under the configured
base URL (default `https://shopify.dev`). This build covers a core
subset of the documented developer surface: Liquid/theme codeblock
validation, component validation for other frameworks, and
docs update/feedback tools are not included.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
