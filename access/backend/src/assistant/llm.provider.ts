import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmReply {
  content: string;
  usage?: { prompt: number; completion: number } | null;
}

/**
 * Cliente LLM agnóstico (API estilo OpenAI "chat completions"). Por defecto
 * apunta a **GLM** servido por Cloudflare Workers AI (`@cf/zai-org/glm-5.2`),
 * pero al hablar el formato OpenAI sirve cualquier proveedor compatible solo
 * cambiando variables de entorno (`ASSISTANT_*`), sin tocar código.
 *
 * Confidencialidad: la API key viaja únicamente en el header Authorization;
 * nunca se loguea ni se devuelve al cliente. GLM es un modelo "thinking": se
 * elimina el bloque de razonamiento antes de devolver la respuesta.
 */
@Injectable()
export class LlmProvider {
  private readonly logger = new Logger('AssistantLlm');
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly disableThinking: boolean;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('ASSISTANT_BASE_URL') ?? '').replace(/\/+$/, '');
    this.apiKey = config.get<string>('ASSISTANT_API_KEY') ?? '';
    this.model = config.get<string>('ASSISTANT_MODEL') ?? '@cf/zai-org/glm-4.7-flash';
    this.maxTokens = config.get<number>('ASSISTANT_MAX_TOKENS', 700);
    this.temperature = config.get<number>('ASSISTANT_TEMPERATURE', 0.4);
    this.timeoutMs = config.get<number>('ASSISTANT_TIMEOUT_MS', 22000);
    // GLM es un modelo "thinking": gasta tokens razonando en un campo aparte y
    // deja `content` vacío. Para un chat ágil lo desactivamos (verificado en
    // Cloudflare con chat_template_kwargs.enable_thinking=false).
    this.disableThinking = config.get<string>('ASSISTANT_DISABLE_THINKING', 'true') !== 'false';
  }

  get configured(): boolean {
    return !!this.baseUrl && !!this.apiKey;
  }

  /** Un turno de chat. Devuelve el texto del asistente (sin bloque de razonamiento). */
  async chat(messages: ChatMessage[]): Promise<LlmReply> {
    if (!this.configured) throw new Error('assistant_not_configured');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    };
    // Desactiva el razonamiento del modelo (GLM) para respuestas directas y rápidas.
    if (this.disableThinking) payload.chat_template_kwargs = { enable_thinking: false };
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') throw new Error('assistant_timeout');
      throw new Error('assistant_unreachable');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.warn(`LLM HTTP ${res.status}: ${detail.slice(0, 180)}`);
      throw new Error(`assistant_http_${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = data?.choices?.[0]?.message?.content ?? '';
    return {
      content: stripThinking(raw),
      usage: data?.usage
        ? {
            prompt: Number(data.usage.prompt_tokens ?? 0),
            completion: Number(data.usage.completion_tokens ?? 0),
          }
        : null,
    };
  }
}

/** Quita el bloque de razonamiento de modelos "thinking" (GLM, DeepSeek-R1, etc.). */
function stripThinking(content: string): string {
  return (content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\/?(?:think|thinking|reasoning|analysis|reflection)>/gi, '')
    .trim();
}
