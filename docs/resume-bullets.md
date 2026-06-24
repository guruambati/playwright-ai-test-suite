# Resume Bullets — Playwright AI Test Suite

## Option A — AI SDET / QA Automation Engineer focus

- Built a Playwright + TypeScript end-to-end test suite for AI applications with
  45+ tests across three layers: LLM API contract tests (schema, latency, safety),
  browser-context UI tests using network route interception, and MCP tool-call
  audit validation; integrated with GitHub Actions CI with HTML report and trace
  file artifact upload

## Option B — AI QA Engineer / GenAI QA focus

- Designed and implemented a custom mock LLM server (Node.js, zero dependencies)
  enabling full CI test runs without real API keys; test suite validates response
  schema contracts, latency SLAs, PII detection, XSS safety, and MCP tool dispatch
  idempotency across Chromium

## Option C — QA Automation / Test Infrastructure focus

- Developed reusable TypeScript helpers (LLMApiClient, ResponseValidator) and
  custom Playwright fixtures for AI test suites; CI workflow on GitHub Actions
  uploads playwright-report and test-results as artifacts on every push and PR

## Notes on Usage

- Strongest talking points for AI-focused roles:
  - "I use Playwright's route interception to capture and assert on the exact
    payload the browser sends to the LLM — catching frontend bugs that server-side
    API tests miss entirely"
  - "The mock server implements the OpenAI completions contract so tests are
    portable — point at a real endpoint with one environment variable"
- For SDET roles:
  - "The three-directory structure (api/, ui/, mcp/) lets CI run fast smoke tests
    against tests/api/ on every push and full regression against all directories
    only on main"
