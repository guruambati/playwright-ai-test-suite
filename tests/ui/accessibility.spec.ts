/**
 * accessibility.spec.ts
 * =====================
 * Accessibility checks for AI application interfaces.
 *
 * Tests validate that API responses carry accessibility-safe
 * content (no raw markdown leaking, no XSS vectors) and that
 * the server's JSON responses are correctly structured for
 * screen-reader-friendly rendering.
 *
 * In a real project you'd also use @axe-core/playwright
 * to run WCAG checks on the full rendered page.
 */

import { test, expect } from '../../src/fixtures/ai-fixtures';
import { ResponseValidator } from '../../src/helpers/response-validator';

test.describe('Accessibility — Response Content Safety', () => {

  test('response does not contain raw script tags', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const content = aiClient.extractContent(body);
    expect(content).not.toContain('<script>');
    expect(content).not.toContain('</script>');
  });

  test('response does not contain raw onclick handlers', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const content = aiClient.extractContent(body);
    expect(content.toLowerCase()).not.toContain('onclick=');
    expect(content.toLowerCase()).not.toContain('onerror=');
  });

  test('response role is always assistant', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(body.choices[0].message.role).toBe('assistant');
  });

  test('finish_reason is a valid value', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const validReasons = ['stop', 'length', 'content_filter', 'tool_calls'];
    expect(validReasons).toContain(body.choices[0].finish_reason);
  });

  test('response content has no PII for display safety', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Tell me about Python' }],
    });
    const content = aiClient.extractContent(body);
    ResponseValidator.assertNoPii(content);
  });

});

test.describe('Accessibility — Page Structure via Browser', () => {

  test('server page has valid JSON body (parseable content)', async ({ page }) => {
    await page.goto('http://localhost:3131/health');
    const bodyText = await page.evaluate(() => document.body.innerText);
    const parsed   = JSON.parse(bodyText);
    expect(parsed).toHaveProperty('status');
  });

  test('API response id is a unique non-empty string', async ({ aiClient }) => {
    const { body: b1 } = await aiClient.chatCompletion({
      model: 'mock-gpt-4', messages: [{ role: 'user', content: 'First' }],
    });
    const { body: b2 } = await aiClient.chatCompletion({
      model: 'mock-gpt-4', messages: [{ role: 'user', content: 'Second' }],
    });
    expect(b1.id.length).toBeGreaterThan(0);
    expect(b2.id.length).toBeGreaterThan(0);
    expect(b1.id).not.toBe(b2.id);
  });

  test('response content has minimum readable length', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'What is Python?' }],
    });
    const content = aiClient.extractContent(body);
    // Ensure response is long enough to be meaningful (not truncated)
    ResponseValidator.assertMinLength(content, 10);
  });

  test('XSS attempt in prompt does not reflect back in response', async ({ page }) => {
    await page.goto('http://localhost:3131/health');

    const content = await page.evaluate(async () => {
      const res = await fetch('http://localhost:3131/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:    'mock-gpt-4',
          messages: [{
            role:    'user',
            content: '<script>alert("xss")</script>',
          }],
        }),
      });
      const data = await res.json();
      return data.choices[0].message.content as string;
    });

    expect(content).not.toContain('<script>');
    expect(content).not.toContain('alert("xss")');
  });

  test('response object has created timestamp in Unix format', async ({ aiClient }) => {
    const { body } = await aiClient.chatCompletion({
      model:    'mock-gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    // Unix timestamp should be > year 2020 in seconds
    expect(body.created).toBeGreaterThan(1577836800);
  });

});
