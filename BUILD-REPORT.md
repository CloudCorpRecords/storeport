# storeport — Build Report

MCP Rebuild 100, Tier B. Clean-room rebuild of Shopify's developer
MCP server (Shopify/dev-mcp), built from the public Shopify dev MCP
documentation captured in
`harness/fixtures/shopify-tools-original.json` only. The fixture
was created for this build from the public Shopify dev MCP
documentation (Shopify/dev-mcp README, from public docs knowledge
2026-10-26), marked `"_source": docs-derived CORE SUBSET ...
labelled core-subset ... Not hand-probed`. Local build only —
nothing pushed or published, and no live network call was made or
claimed at any point.

Identity: repo `storeport`, npm `@reneturcios/storeport`,
MCP name `io.github.CloudCorpRecords/storeport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `storeport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Shopify developer docs, API learning,
  GraphQL introspection, and code validation." = **81 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/storeport:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/storeport"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`learn`, `search`, `docs`,
  `introspect`, `ask`, `validate-graphql`, `validate-components`,
  `mcp`, `--version`; exit 2 usage / 1 API error), `src/mcp.ts`,
  `src/types.ts`, `src/storeport.ts` (core logic, `VERSION = "0.1.0"`)
- `test/storeport.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to storeport)

## Tools implemented (7/7, core subset)

`learn_shopify_api`, `search_docs_chunks`, `fetch_full_docs`,
`introspect_graphql_schema`, `prompt_shopify_dev_assistant`,
`validate_graphql_codeblocks`, `validate_component_codeblocks` —
the labelled core subset recorded in the fixture `_source`.

**Subset omissions (recorded in the fixture `_source`):** Liquid /
theme codeblock validation, component validation for other
frameworks beyond the one validate tool, docs update/feedback
tools, and any store-admin data tools (the dev MCP has none) were
NOT rebuilt. Parity 100.0% is against the 7-tool labelled subset
only, never the full documented surface.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the public spec
  and break exact schema parity. Zod still validates every
  `tools/call`.
- Auth follows the original: the Shopify developer service is
  **keyless** — no store token, no API key, no authorization header,
  and no missing-key error is invented. The base URL defaults to
  `https://shopify.dev` and is overridable via the
  `SHOPIFY_DEV_BASE_URL` environment variable, or per call with the
  optional `baseUrl` argument every core function accepts.
- Endpoints on the base (all POST JSON except docs fetch):
  learn → `/api/assistant/learn` `{api, conversationId?}`;
  search → `/api/docs/search` `{query, maxNumResults?}`;
  fetch docs → GET, an absolute URL used as-is and a relative path
  joined onto the base; introspect → `/api/graphql/introspect`
  `{query, apiVersion?}`; prompt → `/api/assistant/prompt`
  `{prompt, conversationId?}`; validate GraphQL →
  `/api/validation/graphql` `{content, apiVersion?}`; validate
  components → `/api/validation/components` `{content}`. Optional
  fields are omitted from bodies when not given, never sent as null.
- **Endpoint paths are docs-derived reconstructions and MUST be the
  first check at publish-wave live smoke** (same honesty class as
  earlier builds' flagged endpoints).
- Empty query / prompt / content / url arguments are rejected
  before any request is made. HTTP failures surface the status plus
  the upstream `message` / `detail` / `error` when its JSON body
  provides one.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written fixtures —
  **no live call was performed**.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 14
ℹ pass 14
ℹ fail 0
```
Covers: search POST path+body (with and without maxNumResults, and
no Authorization header sent); fetch_full_docs absolute URL GET
as-is and relative path joined to the base; introspect body with
apiVersion and without (field absent, not null); learn including
conversationId only when given; prompt path+body; both validate
paths+bodies; empty query/prompt/url/content rejected before any
request (fetch asserted not called); HTTP 500 surfacing status plus
upstream detail; base URL override via an explicit baseUrl argument
and via the SHOPIFY_DEV_BASE_URL env-shaped default; and
formatPayload two-space JSON.

### 3. CLI / MCP smoke
`--version` → `0.1.0`; unknown command exits 2 with Usage. MCP
`initialize` over stdio → `serverInfo: {"name":"storeport",
"version":"0.1.0"}`. Live upstream calls were **not** run (egress
blocked; no live call claimed).

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/shopify-tools-original.json \
    --rebuild "stdio:node .../builds/storeport/dist/cli.js mcp" \
    --out .../builds/storeport/parity-out
verdict=PASS parity_pct=100.0 original_tools=7 rebuild_tools=7 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 7/7.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was copied from modelrun's and its identity
fields edited (top-level `name`, root package `name`, root package
`bin` key → storeport; dependency ranges are identical, so the tree
is unchanged). **Clean lockfile regen required before publish**
(regenerate with no `node_modules` present); do not publish from
this lockfile as-is. `node_modules` here is a copy of modelrun's;
`.bin/tsc` / `.bin/tsx` verified working after `chmod +x` on the
copied `.bin`.

## Gaps / honest notes

- Core subset only: the omitted groups listed above (Liquid/theme
  validation, other-framework component validation, docs
  update/feedback tools) are outside this build. Store-admin data
  tools do not exist in the original dev MCP and none were invented.
- Endpoint paths are docs-derived reconstructions, not hand-probed:
  they are the **first check at publish-wave live smoke**. Request
  bodies, response handling, and any hosted assistant/learning
  behaviour behind those paths may drift from the live service.
- No live Shopify call was made (VM egress is blocked). Request
  construction is written against the documented paths and payload
  shapes; live payload drift is unverified until the publish wave
  can smoke. Behaviour parity is tool/schema + docs-contract, not
  live-proven.
- Upstream responses are returned as-is (JSON payloads rendered
  with two-space formatting); a docs page that returns non-JSON
  text is passed through the payload reader's text fallback.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
