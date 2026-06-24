/**
 * mock-llm-server.ts
 * ==================
 * Lightweight Node.js HTTP server that mimics the OpenAI Chat Completions API.
 * No real API key required — returns deterministic mock responses.
 *
 * Endpoints:
 *   GET  /health                  → 200 { status: "ok" }
 *   POST /v1/chat/completions     → mock LLM response
 *   POST /v1/tools/call           → mock tool dispatch result
 *   GET  /v1/models               → list of mock models
 *
 * Run: node src/mocks/mock-llm-server.js
 */

import http from 'http';

const PORT = 3131;

// ── Mock response bank ────────────────────────────────────────
const MOCK_RESPONSES: Record<string, string> = {
  default:    'This is a mock LLM response for testing purposes.',
  python:     'Python is a high-level, general-purpose programming language created by Guido van Rossum.',
  capital:    'The capital of France is Paris.',
  json:       '{"name": "Alice", "score": 95, "advice": "Practice daily."}',
  harmful:    'I cannot assist with that request.',
  empty_test: '',
};

function pickResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('python'))           return MOCK_RESPONSES.python;
  if (lower.includes('capital'))          return MOCK_RESPONSES.capital;
  if (lower.includes('json'))             return MOCK_RESPONSES.json;
  if (lower.includes('bomb') ||
      lower.includes('hack') ||
      lower.includes('harmful'))          return MOCK_RESPONSES.harmful;
  if (lower.includes('empty'))            return MOCK_RESPONSES.empty_test;
  return MOCK_RESPONSES.default;
}

function buildCompletionResponse(content: string, model: string) {
  return {
    id:      `chatcmpl-mock-${Date.now()}`,
    object:  'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index:         0,
        message:       { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens:     10,
      completion_tokens: content.split(' ').length,
      total_tokens:      10 + content.split(' ').length,
    },
  };
}

// ── Request body parser ───────────────────────────────────────
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end',  () => {
      try   { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
  });
}

// ── Route handlers ────────────────────────────────────────────
function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const url    = req.url ?? '/';
  const method = req.method ?? 'GET';

  // ── GET /health ─────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    return sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
  }

  // ── GET /v1/models ──────────────────────────────────────
  if (method === 'GET' && url === '/v1/models') {
    return sendJson(res, 200, {
      object: 'list',
      data: [
        { id: 'mock-gpt-4',        object: 'model' },
        { id: 'mock-gpt-3.5',      object: 'model' },
        { id: 'mock-claude-sonnet', object: 'model' },
      ],
    });
  }

  // ── POST /v1/chat/completions ───────────────────────────
  if (method === 'POST' && url === '/v1/chat/completions') {
    let body: any;
    try {
      body = await parseBody(req);
    } catch {
      return sendJson(res, 400, { error: { message: 'Invalid JSON body' } });
    }

    // Validate required fields
    if (!body.model) {
      return sendJson(res, 400, { error: { message: "'model' is required" } });
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return sendJson(res, 400, {
        error: { message: "'messages' must be a non-empty array" },
      });
    }

    const lastMessage = body.messages[body.messages.length - 1];
    const prompt      = lastMessage?.content ?? '';
    const content     = pickResponse(prompt);

    // Simulate latency
    await new Promise((r) => setTimeout(r, 50));

    return sendJson(res, 200, buildCompletionResponse(content, body.model));
  }

  // ── POST /v1/tools/call ─────────────────────────────────
  if (method === 'POST' && url === '/v1/tools/call') {
    let body: any;
    try {
      body = await parseBody(req);
    } catch {
      return sendJson(res, 400, { error: { message: 'Invalid JSON body' } });
    }

    const { tool, params } = body;
    if (!tool) {
      return sendJson(res, 400, { error: { message: "'tool' is required" } });
    }

    // Mock tool responses
    const toolResults: Record<string, unknown> = {
      calculator: { result: 42,         operation: params?.operation ?? 'unknown' },
      weather:    { city: params?.city, temp: 22, condition: 'sunny', unit: 'celsius' },
      database:   { rows: [{ id: 1, name: 'Alice' }], count: 1 },
    };

    const result = toolResults[tool];
    if (!result) {
      return sendJson(res, 404, {
        error: { message: `Unknown tool: '${tool}'` },
      });
    }

    return sendJson(res, 200, {
      tool,
      params,
      result,
      timestamp: Date.now(),
    });
  }

  // ── 404 ─────────────────────────────────────────────────
  return sendJson(res, 404, {
    error: { message: `Route not found: ${method} ${url}` },
  });
}

// ── Start server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    sendJson(res, 500, { error: { message: 'Internal server error' } });
  }
});

server.listen(PORT, () => {
  console.log(`Mock LLM server running at http://localhost:${PORT}`);
});

export default server;
