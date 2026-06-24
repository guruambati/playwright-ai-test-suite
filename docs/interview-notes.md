# Interview Notes — Playwright AI Test Suite

## What I Built

A Playwright + TypeScript test suite for AI-powered applications. Three test
categories: API contract tests for the LLM completions and tool call endpoints,
UI tests that use Playwright's network interception to validate browser-side API
integration, and MCP tool-call validation patterns.

Includes a custom mock LLM server (Node.js, no dependencies) so all tests run
in CI without any real API key. GitHub Actions uploads HTML reports and trace
files as artifacts on every run.

## How I Would Explain It in an Interview

> "Testing AI applications with Playwright requires a different mindset from
> testing a standard web app. The outputs aren't deterministic, so you can't
> do exact string matching. Instead you validate schema, structure, latency,
> keyword presence, and safety properties.
>
> I structured the suite into three layers. API tests validate the contract
> between the frontend and the LLM backend — correct status codes, response
> shape, error handling, latency SLA. UI tests use Playwright's route interception
> to capture what the browser sends and receives, verifying the integration layer.
> MCP tests validate tool dispatch — parameters, routing, audit logging, and
> idempotency.
>
> Everything runs against a mock server so CI is fast and free. The mock server
> implements the same OpenAI chat completions contract, so you can swap it out
> for the real API by changing one environment variable."

## What QA Problem It Solves

1. **AI API contract regression** — API shape changes break the frontend silently
2. **Latency SLA** — response time exceeds acceptable user-experience threshold
3. **Safety in UI context** — harmful content or XSS patterns reach the DOM
4. **MCP tool audit** — which tools were called, with what parameters, in what order
5. **Multi-turn conversation** — session state breaks on the third or fourth turn
6. **Route interception for AI** — intercept and mock LLM responses to test UI
   behaviour without depending on actual model outputs

## Key Design Decisions Worth Discussing

**Why a custom mock server instead of Playwright's built-in route mocking?**
Playwright route mocking works per-page. A real AI app has multiple pages and
workers all hitting the same API. A shared server mock is more realistic and lets
you test retry logic, rate limiting, and stateful behaviour that per-page mocks
can't simulate.

**Why TypeScript?**
Type safety catches parameter mismatches before the test runs. The typed
`LLMApiClient` and `ResponseValidator` classes make tests self-documenting —
you can see what fields are expected without reading the raw JSON.

**Why separate api/, ui/, and mcp/ test directories?**
Each can be run independently in CI: `playwright test tests/api/` for fast smoke
tests, `tests/ui/` for regression, `tests/mcp/` for integration. Allows different
retry counts and timeout budgets per category.

**What does route interception prove that API tests don't?**
API tests call the server directly. Route interception proves that the browser's
JavaScript layer is sending the correct payload — the right model, the right
message format, the right headers. This catches frontend bugs that API tests miss.

## What I Would Add Next

1. **@axe-core/playwright** — inject axe accessibility engine into each page
   for automated WCAG 2.1 AA checks, especially important for chat interfaces
   used by screen reader users
2. **Streaming response validation** — intercept SSE chunks as they arrive,
   validate each token packet has the correct format before the full response
   is assembled
3. **Real MCP server integration** — wire the MCP test spec to an actual
   MCP server (using the `@modelcontextprotocol/sdk`) and test real tool
   registration, discovery, and invocation
4. **Visual regression** — capture screenshots of the chat UI and compare
   them across deployments to catch unintended layout changes
5. **Performance traces** — use Playwright's CDP integration to measure
   Time to First Byte and Time to Interactive for AI response rendering
