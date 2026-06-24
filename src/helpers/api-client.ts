/**
 * api-client.ts
 * =============
 * Typed wrapper around the LLM API for use in Playwright API tests.
 * Works against the mock server in tests and can be pointed at a
 * real endpoint by changing BASE_URL.
 */

import { APIRequestContext } from '@playwright/test';

// ── Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model:       string;
  messages:    ChatMessage[];
  temperature?: number;
  max_tokens?:  number;
}

export interface ChatCompletionResponse {
  id:      string;
  object:  string;
  created: number;
  model:   string;
  choices: Array<{
    index:         number;
    message:       ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens:     number;
    completion_tokens: number;
    total_tokens:      number;
  };
}

export interface ToolCallRequest {
  tool:   string;
  params: Record<string, unknown>;
}

export interface ToolCallResponse {
  tool:      string;
  params:    Record<string, unknown>;
  result:    unknown;
  timestamp: number;
}

// ── Client class ──────────────────────────────────────────────

export class LLMApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string = 'http://localhost:3131',
  ) {}

  async health(): Promise<{ status: string; timestamp: number }> {
    const res = await this.request.get(`${this.baseUrl}/health`);
    return res.json();
  }

  async listModels(): Promise<{ object: string; data: Array<{ id: string }> }> {
    const res = await this.request.get(`${this.baseUrl}/v1/models`);
    return res.json();
  }

  async chatCompletion(
    payload: ChatCompletionRequest,
  ): Promise<{ status: number; body: ChatCompletionResponse }> {
    const start = Date.now();
    const res   = await this.request.post(
      `${this.baseUrl}/v1/chat/completions`,
      { data: payload },
    );
    const body        = await res.json();
    body._latency_ms  = Date.now() - start;
    return { status: res.status(), body };
  }

  async callTool(
    payload: ToolCallRequest,
  ): Promise<{ status: number; body: ToolCallResponse }> {
    const res  = await this.request.post(
      `${this.baseUrl}/v1/tools/call`,
      { data: payload },
    );
    return { status: res.status(), body: await res.json() };
  }

  /** Helper: get just the assistant message text */
  extractContent(body: ChatCompletionResponse): string {
    return body.choices?.[0]?.message?.content ?? '';
  }
}
