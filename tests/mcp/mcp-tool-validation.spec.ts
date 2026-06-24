/**
 * mcp-tool-validation.spec.ts
 * ============================
 * Test patterns for Model Context Protocol (MCP) tool call validation.
 *
 * MCP is a protocol that lets AI models call external tools in a
 * standardised way. These tests validate:
 *   - Tool dispatch returns correct results
 *   - Parameter passing is validated server-side
 *   - Tool call audit logs are accurate
 *   - Unknown tools are rejected cleanly
 *   - Tool call idempotency for read operations
 *
 * These tests simulate what you'd write for a Playwright MCP integration,
 * using the mock server's /v1/tools/call endpoint as a stand-in for a
 * real MCP tool server.
 */

import { test, expect } from '../../src/fixtures/ai-fixtures';

const BASE = 'http://localhost:3131';

test.describe('MCP — Tool Dispatch', () => {

  test('calculator tool dispatches successfully', async ({ aiClient }) => {
    const { status, body } = await aiClient.callTool({
      tool:   'calculator',
      params: { operation: 'add', a: 10, b: 5 },
    });
    expect(status).toBe(200);
    expect(body.tool).toBe('calculator');
  });

  test('calculator result is returned in response', async ({ aiClient }) => {
    const { body } = await aiClient.callTool({
      tool:   'calculator',
      params: { operation: 'add', a: 6, b: 7 },
    });
    expect(body.result).toHaveProperty('result');
  });

  test('weather tool returns city and temperature', async ({ aiClient }) => {
    const { status, body } = await aiClient.callTool({
      tool:   'weather',
      params: { city: 'Tokyo' },
    });
    expect(status).toBe(200);
    expect(body.result).toHaveProperty('temp');
    expect(body.result).toHaveProperty('condition');
  });

  test('database tool returns rows', async ({ aiClient }) => {
    const { status, body } = await aiClient.callTool({
      tool:   'database',
      params: { table: 'users' },
    });
    expect(status).toBe(200);
    expect(body.result).toHaveProperty('rows');
    expect(body.result).toHaveProperty('count');
  });

  test('tool response includes original params', async ({ aiClient }) => {
    const params = { operation: 'multiply', a: 3, b: 4 };
    const { body } = await aiClient.callTool({ tool: 'calculator', params });
    expect(body.params).toEqual(params);
  });

  test('tool response has timestamp', async ({ aiClient }) => {
    const { body } = await aiClient.callTool({
      tool:   'weather',
      params: { city: 'London' },
    });
    expect(typeof body.timestamp).toBe('number');
    expect(body.timestamp).toBeGreaterThan(0);
  });

});

test.describe('MCP — Parameter Validation', () => {

  test('unknown tool returns 404', async ({ request }) => {
    const res = await request.post(`${BASE}/v1/tools/call`, {
      data: { tool: 'nonexistent_tool', params: {} },
    });
    expect(res.status()).toBe(404);
  });

  test('unknown tool error has descriptive message', async ({ request }) => {
    const res  = await request.post(`${BASE}/v1/tools/call`, {
      data: { tool: 'unknown_tool', params: {} },
    });
    const body = await res.json();
    expect(body.error.message).toContain('unknown_tool');
  });

  test('missing tool name returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/v1/tools/call`, {
      data: { params: { a: 1 } },
    });
    expect(res.status()).toBe(400);
  });

  test('tool name is preserved in response', async ({ aiClient }) => {
    const { body } = await aiClient.callTool({
      tool:   'calculator',
      params: { operation: 'add', a: 1, b: 1 },
    });
    expect(body.tool).toBe('calculator');
  });

});

test.describe('MCP — Idempotency', () => {

  test('same read tool call returns same structure', async ({ aiClient }) => {
    const params = { table: 'users' };
    const { body: r1 } = await aiClient.callTool({ tool: 'database', params });
    const { body: r2 } = await aiClient.callTool({ tool: 'database', params });
    // Structure should be identical for read operations
    expect(r1.result).toHaveProperty('rows');
    expect(r2.result).toHaveProperty('rows');
    expect(r1.tool).toBe(r2.tool);
  });

  test('calculator same inputs same output', async ({ aiClient }) => {
    const params = { operation: 'multiply', a: 7, b: 8 };
    const { body: r1 } = await aiClient.callTool({ tool: 'calculator', params });
    const { body: r2 } = await aiClient.callTool({ tool: 'calculator', params });
    expect(r1.result).toEqual(r2.result);
  });

});

test.describe('MCP — Audit via Route Interception', () => {

  test('can capture and inspect MCP tool call payloads', async ({ page }) => {
    const capturedCalls: any[] = [];

    await page.route('**/v1/tools/call', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      capturedCalls.push(body);
      await route.continue();
    });

    await page.goto(`${BASE}/health`);
    await page.evaluate(async () => {
      await fetch('http://localhost:3131/v1/tools/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tool:   'calculator',
          params: { operation: 'add', a: 2, b: 3 },
        }),
      });
    });

    expect(capturedCalls.length).toBe(1);
    expect(capturedCalls[0].tool).toBe('calculator');
    expect(capturedCalls[0].params).toMatchObject({ operation: 'add' });
  });

  test('multiple tool calls all captured in audit', async ({ page }) => {
    const capturedCalls: any[] = [];

    await page.route('**/v1/tools/call', async (route) => {
      capturedCalls.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.continue();
    });

    await page.goto(`${BASE}/health`);
    await page.evaluate(async () => {
      const calls = [
        { tool: 'calculator', params: { operation: 'add', a: 1, b: 1 } },
        { tool: 'weather',    params: { city: 'Tokyo' } },
        { tool: 'database',   params: { table: 'users' } },
      ];
      for (const c of calls) {
        await fetch('http://localhost:3131/v1/tools/call', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(c),
        });
      }
    });

    expect(capturedCalls.length).toBe(3);
    const toolNames = capturedCalls.map((c) => c.tool);
    expect(toolNames).toContain('calculator');
    expect(toolNames).toContain('weather');
    expect(toolNames).toContain('database');
  });

});
