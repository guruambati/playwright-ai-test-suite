/**
 * ai-fixtures.ts
 * ==============
 * Custom Playwright fixtures for the AI test suite.
 *
 * Provides:
 *   - aiClient  : pre-built LLMApiClient bound to the mock server
 *   - aiPage    : page navigated to the mock chat UI
 *   - validator : ResponseValidator class (for convenience re-export)
 */

import { test as base, expect } from '@playwright/test';
import { LLMApiClient } from '../helpers/api-client';
import { ResponseValidator } from '../helpers/response-validator';

// ── Fixture types ─────────────────────────────────────────────
type AIFixtures = {
  aiClient:  LLMApiClient;
  validator: typeof ResponseValidator;
};

// ── Extended test with AI fixtures ────────────────────────────
export const test = base.extend<AIFixtures>({

  aiClient: async ({ request }, use) => {
    const client = new LLMApiClient(request, 'http://localhost:3131');
    await use(client);
  },

  validator: async ({}, use) => {
    await use(ResponseValidator);
  },
});

export { expect };
