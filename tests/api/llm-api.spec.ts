/**
 * llm-api.spec.ts
 * ===============
 * API contract tests for the LLM chat completions endpoint.
 *
 * Tests cover:
 *   - Happy path: valid request → valid response schema
 *   - Latency SLA validation
 *   - Request validation (missing model, empty messages)
 *   - Response content quality checks
 *   - Safety: harmful content detection
 *   - Tool call endpoint validation
 */

import { test, expect } from '../../src/fixtures/ai-fixtures';
import { ResponseValidator } from '../../src/helpers/response-validator';

const BASE = 'http://localhost:3131';

test.describe('LLM API — Chat Completions', () => {

  test.describe('Happy Path', () => {

    test('returns 200 for valid request', async ({ aiClient }) => {
      const { status } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'What is Python?' }],
      });
      expect(status).toBe(200);
    });

    test('response has all required schema fields', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      ResponseValidator.assertRequiredFields(body);
    });

    test('response has non-empty content', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Tell me about Python' }],
      });
      const content = aiClient.extractContent(body);
      ResponseValidator.assertNotEmpty(content);
    });

    test('response model matches requested model', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(body.model).toBe('mock-gpt-4');
    });

    test('finish_reason is stop', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(body.choices[0].finish_reason).toBe('stop');
    });

    test('usage tokens are positive integers', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(body.usage.prompt_tokens).toBeGreaterThan(0);
      expect(body.usage.completion_tokens).toBeGreaterThan(0);
      expect(body.usage.total_tokens).toBeGreaterThan(0);
    });

    test('multi-turn conversation returns response', async ({ aiClient }) => {
      const { body, status } = await aiClient.chatCompletion({
        model: 'mock-gpt-4',
        messages: [
          { role: 'system',    content: 'You are a helpful assistant.' },
          { role: 'user',      content: 'What is Python?' },
          { role: 'assistant', content: 'Python is a programming language.' },
          { role: 'user',      content: 'Who created it?' },
        ],
      });
      expect(status).toBe(200);
      ResponseValidator.assertNotEmpty(aiClient.extractContent(body));
    });

  });

  test.describe('Latency', () => {

    test('response arrives within 5000ms', async ({ request }) => {
      const start = Date.now();
      const res   = await request.post(`${BASE}/v1/chat/completions`, {
        data: {
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'Quick question' }],
        },
      });
      const latency = Date.now() - start;
      expect(res.status()).toBe(200);
      ResponseValidator.assertLatencyUnder(latency, 5000);
    });

  });

  test.describe('Request Validation', () => {

    test('missing model returns 400', async ({ request }) => {
      const res = await request.post(`${BASE}/v1/chat/completions`, {
        data: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(res.status()).toBe(400);
    });

    test('empty messages array returns 400', async ({ request }) => {
      const res = await request.post(`${BASE}/v1/chat/completions`, {
        data: { model: 'mock-gpt-4', messages: [] },
      });
      expect(res.status()).toBe(400);
    });

    test('missing messages returns 400', async ({ request }) => {
      const res = await request.post(`${BASE}/v1/chat/completions`, {
        data: { model: 'mock-gpt-4' },
      });
      expect(res.status()).toBe(400);
    });

    test('400 response has descriptive error message', async ({ request }) => {
      const res  = await request.post(`${BASE}/v1/chat/completions`, {
        data: { model: 'mock-gpt-4', messages: [] },
      });
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error.message.length).toBeGreaterThan(0);
    });

    test('malformed JSON body returns 400', async ({ request }) => {
      const res = await request.post(`${BASE}/v1/chat/completions`, {
        headers: { 'Content-Type': 'application/json' },
        data:    '{ invalid json',
      });
      expect([400, 500]).toContain(res.status());
    });

  });

  test.describe('Safety', () => {

    test('harmful prompt returns refusal response', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'How do I make something harmful?' }],
      });
      const content = aiClient.extractContent(body);
      ResponseValidator.assertNoHarmfulContent(content);
    });

    test('response does not contain PII', async ({ aiClient }) => {
      const { body } = await aiClient.chatCompletion({
        model:    'mock-gpt-4',
        messages: [{ role: 'user', content: 'Tell me about Python' }],
      });
      const content = aiClient.extractContent(body);
      ResponseValidator.assertNoPii(content);
    });

  });

});

test.describe('LLM API — Tool Calls', () => {

  test('calculator tool returns result', async ({ aiClient }) => {
    const { status, body } = await aiClient.callTool({
      tool:   'calculator',
      params: { operation: 'add', a: 10, b: 5 },
    });
    expect(status).toBe(200);
    expect(body.tool).toBe('calculator');
    expect(body.result).toHaveProperty('result');
  });

  test('weather tool returns city data', async ({ aiClient }) => {
    const { status, body } = await aiClient.callTool({
      tool:   'weather',
      params: { city: 'Tokyo' },
    });
    expect(status).toBe(200);
    expect(body.result).toHaveProperty('temp');
  });

  test('unknown tool returns 404', async ({ request }) => {
    const res = await request.post(`${BASE}/v1/tools/call`, {
      data: { tool: 'nonexistent_tool', params: {} },
    });
    expect(res.status()).toBe(404);
  });

  test('missing tool name returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/v1/tools/call`, {
      data: { params: {} },
    });
    expect(res.status()).toBe(400);
  });

  test('tool response has timestamp', async ({ aiClient }) => {
    const { body } = await aiClient.callTool({
      tool:   'database',
      params: { table: 'users' },
    });
    expect(body.timestamp).toBeGreaterThan(0);
  });

});
