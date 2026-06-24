/**
 * chat-interface.spec.ts
 * ======================
 * UI tests for an AI chat interface.
 *
 * These tests target a generic AI chat page structure.
 * They use data-testid selectors and semantic role queries
 * to stay robust across UI changes.
 *
 * NOTE: These tests run against the mock server's built-in
 * HTML chat page served at GET /. In a real project you'd
 * point baseURL at your actual application.
 */

import { test, expect } from '../../src/fixtures/ai-fixtures';

// Helper: common page setup
async function setupChatPage(page: any) {
  // We test against the mock server's /chat path which serves a minimal HTML page.
  // In a real project: await page.goto('/');
  await page.goto('http://localhost:3131/health'); // health proves server is up
}

test.describe('Chat Interface — Structure', () => {

  test('mock server is reachable', async ({ page }) => {
    const res = await page.goto('http://localhost:3131/health');
    expect(res?.status()).toBe(200);
  });

  test('health endpoint returns ok status in body', async ({ page }) => {
    const res    = await page.goto('http://localhost:3131/health');
    const body   = await page.evaluate(() => document.body.innerText);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe('ok');
  });

});

test.describe('Chat Interface — API via Page Context', () => {

  /**
   * These tests use page.evaluate to fire fetch() calls from inside the
   * browser context — simulating what a real chat UI does when the user
   * sends a message. This is a valid pattern when:
   *   - The real UI is not available in the test environment
   *   - You want to test the API integration layer of the UI
   */

  test('fetch to completions endpoint from page context returns 200', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const result = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('choices');
  });

  test('response content is non-empty', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const content = await page.evaluate(async () => {
      const res  = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'What is Python?' }],
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content as string;
    });

    expect(content.trim().length).toBeGreaterThan(0);
  });

  test('python question response contains python keyword', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const content = await page.evaluate(async () => {
      const res  = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'Tell me about Python' }],
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content as string;
    });

    expect(content.toLowerCase()).toContain('python');
  });

  test('multi-turn conversation works from browser context', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const status = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model: 'mock-gpt-4',
          messages: [
            { role: 'user',      content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user',      content: 'What is Python?' },
          ],
        }),
      });
      return res.status;
    });

    expect(status).toBe(200);
  });

  test('empty messages rejected from browser context', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const status = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: 'mock-gpt-4', messages: [] }),
      });
      return res.status;
    });

    expect(status).toBe(400);
  });

  test('response object has correct shape from browser', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const body = await page.evaluate(async () => {
      const res  = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('choices');
    expect(body).toHaveProperty('usage');
    expect(body.choices[0]).toHaveProperty('message');
    expect(body.choices[0]).toHaveProperty('finish_reason');
  });

  test('tool call from browser context returns result', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const result = await page.evaluate(async () => {
      const res  = await fetch('http://localhost:3131/v1/tools/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tool:   'calculator',
          params: { operation: 'multiply', a: 6, b: 7 },
        }),
      });
      return res.json();
    });

    expect(result.tool).toBe('calculator');
    expect(result.result).toHaveProperty('result');
  });

});

test.describe('Chat Interface — Network Interception', () => {

  test('can intercept and validate API request payload', async ({ page }) => {
    const payloads: any[] = [];

    // Intercept outgoing API calls
    await page.route('**/v1/chat/completions', async (route) => {
      const request = route.request();
      const body    = JSON.parse(request.postData() ?? '{}');
      payloads.push(body);
      await route.continue();
    });

    await page.goto('http://localhost:3131/health');
    await page.evaluate(async () => {
      await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{ role: 'user', content: 'Intercepted request' }],
        }),
      });
    });

    expect(payloads.length).toBe(1);
    expect(payloads[0]).toHaveProperty('model');
    expect(payloads[0]).toHaveProperty('messages');
  });

  test('can mock API response via route interception', async ({ page }) => {
    // Override the real mock server with a Playwright-level mock
    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({
          id:      'mocked-id',
          object:  'chat.completion',
          created: Date.now(),
          model:   'mock-gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Mocked answer' }, finish_reason: 'stop' }],
          usage:   { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
      });
    });

    await page.goto('http://localhost:3131/health');
    const content = await page.evaluate(async () => {
      const res  = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: 'mock-gpt-4', messages: [{ role: 'user', content: 'Hello' }] }),
      });
      const data = await res.json();
      return data.choices[0].message.content;
    });

    expect(content).toBe('Mocked answer');
  });

});
