import { Injectable, signal, computed } from '@angular/core';
import {
  AiProviderError,
  ChatTurn,
  MAX_ATTEMPTS,
  RETRYABLE_STATUSES,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  sleep,
} from './ai-http.util';

const STORAGE_KEY = 'cac-groq-key';
const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

@Injectable({ providedIn: 'root' })
export class GroqService {
  readonly apiKey = signal<string>(this.readStoredKey());
  readonly hasKey = computed(() => this.apiKey().trim().length > 0);

  setApiKey(key: string): void {
    const trimmed = key.trim();
    this.apiKey.set(trimmed);
    try {
      if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  }

  clearApiKey(): void {
    this.setApiKey('');
  }

  async generate(userText: string, systemInstruction?: string): Promise<string> {
    return this.call([{ role: 'user', text: userText }], systemInstruction);
  }

  async generateJson(userText: string, systemInstruction?: string): Promise<string> {
    return this.call([{ role: 'user', text: userText }], systemInstruction, true);
  }

  async chat(history: ChatTurn[], systemInstruction?: string): Promise<string> {
    return this.call(history, systemInstruction);
  }

  private async call(turns: ChatTurn[], systemInstruction?: string, jsonMode = false): Promise<string> {
    const key = this.apiKey().trim();
    if (!key) throw new AiProviderError('No Groq API key set.', 'no-key', 'Groq');

    const messages: { role: string; content: string }[] = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    for (const t of turns) {
      messages.push({ role: t.role === 'model' ? 'assistant' : 'user', content: t.text });
    }

    const body: Record<string, unknown> = { model: MODEL, messages };
    if (jsonMode) {
      body['response_format'] = { type: 'json_object' };
    }

    let res: Response | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        res = await fetchWithTimeout(
          ENDPOINT,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          },
          REQUEST_TIMEOUT_MS
        );
      } catch (err) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new AiProviderError('Groq took too long to respond — try again.', 'unavailable', 'Groq');
        }
        throw new AiProviderError('Could not reach Groq — check your internet connection.', 'network', 'Groq');
      }
      if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_DELAY_MS);
    }

    if (!res!.ok) {
      if (res!.status === 401 || res!.status === 403) {
        throw new AiProviderError('Groq rejected the API key. Double-check it was copied correctly.', 'invalid-key', 'Groq');
      }
      if (res!.status === 429) {
        throw new AiProviderError('Groq rate limit hit — wait a moment and try again.', 'rate-limit', 'Groq');
      }
      if (res!.status === 503 || res!.status === 500 || res!.status === 502 || res!.status === 504) {
        throw new AiProviderError("Groq's servers are temporarily overloaded. Already retried once — wait a moment and try again.", 'unavailable', 'Groq');
      }
      if (res!.status === 400) {
        throw new AiProviderError('Groq rejected the request — the API key may be malformed.', 'invalid-key', 'Groq');
      }
      throw new AiProviderError(`Groq request failed (HTTP ${res!.status}).`, 'unknown', 'Groq');
    }

    const data = await res!.json();
    const finishReason = data?.choices?.[0]?.finish_reason;
    if (finishReason === 'content_filter') {
      throw new AiProviderError('Groq declined to respond (content filter).', 'blocked', 'Groq');
    }
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new AiProviderError('Groq returned an unexpected response.', 'unknown', 'Groq');
    }
    return text;
  }

  private readStoredKey(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }
}
