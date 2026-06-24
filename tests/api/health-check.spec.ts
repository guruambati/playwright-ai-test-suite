/**
 * health-check.spec.ts
 * ====================
 * Tests for the health and readiness endpoints of the mock LLM server.
 * In a real project these would validate your AI service infrastructure.
 */

import { test, expect } from '../../src/fixtures/ai-fixtures';

test.describe('Health & Readiness', () => {

  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get('http://localhost:3131/health');
    expect(res.status()).toBe(200);
  });

  test('health response has status ok', async ({ aiClient }) => {
    const body = await aiClient.health();
    expect(body.status).toBe('ok');
  });

  test('health response includes timestamp', async ({ aiClient }) => {
    const body = await aiClient.health();
    expect(body.timestamp).toBeGreaterThan(0);
  });

  test('GET /v1/models returns model list', async ({ aiClient }) => {
    const body = await aiClient.listModels();
    expect(body.object).toBe('list');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('model list entries have id field', async ({ aiClient }) => {
    const body = await aiClient.listModels();
    for (const model of body.data) {
      expect(model).toHaveProperty('id');
      expect(typeof model.id).toBe('string');
    }
  });

  test('unknown route returns 404', async ({ request }) => {
    const res = await request.get('http://localhost:3131/v1/unknown-endpoint');
    expect(res.status()).toBe(404);
  });

  test('404 response has error message', async ({ request }) => {
    const res  = await request.get('http://localhost:3131/v1/unknown-endpoint');
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('message');
  });

});
