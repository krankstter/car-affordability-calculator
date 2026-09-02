import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'cac-gemini-key';
const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export class GeminiError extends Error {
  constructor(message: string, readonly kind: 'no-key' | 'invalid-key' | 'rate-limit' | 'blocked' | 'network' | 'unknown') {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
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
    if (!key) throw new GeminiError('No Gemini API key set.', 'no-key');

    const body: Record<string, unknown> = {
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    };
    if (systemInstruction) {
      body['systemInstruction'] = { parts: [{ text: systemInstruction }] };
    }
    if (jsonMode) {
      body['generationConfig'] = { responseMimeType: 'application/json' };
    }

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify(body),
      });
    } catch {
      throw new GeminiError('Could not reach Gemini — check your internet connection.', 'network');
    }

    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new GeminiError('Gemini rejected the API key. Double-check it was copied correctly.', 'invalid-key');
      }
      if (res.status === 429) {
        throw new GeminiError('Gemini rate limit hit — wait a moment and try again.', 'rate-limit');
      }
      throw new GeminiError(`Gemini request failed (HTTP ${res.status}).`, 'unknown');
    }

    const data = await res.json();
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiError(`Gemini declined to respond (${blockReason}).`, 'blocked');
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new GeminiError('Gemini returned an unexpected response.', 'unknown');
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
