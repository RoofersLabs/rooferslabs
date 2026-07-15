import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../config/app-config.service';
import { ExternalServiceError } from '../common/exceptions/domain.exception';

/**
 * Adapter isolating the OpenAI provider (Responses API + embeddings). The
 * Realtime voice bridge is handled separately in the telephony layer. When no
 * API key is configured the adapter reports `isEnabled === false` so callers
 * can degrade gracefully (e.g. keyword-only knowledge retrieval).
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.openai.apiKey;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY not set — AI features are disabled until configured.');
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  private require(): OpenAI {
    if (!this.client) {
      throw new ExternalServiceError('AI is not configured on this server (missing OPENAI_API_KEY).');
    }
    return this.client;
  }

  /** Generate embedding vectors for a batch of texts. */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const client = this.require();
    try {
      const response = await client.embeddings.create({
        model: this.config.openai.embeddingModel,
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.error(`Embedding request failed: ${(error as Error).message}`);
      throw new ExternalServiceError('Failed to generate embeddings.');
    }
  }

  /**
   * Run the Responses API with a JSON schema to obtain a validated structured
   * object. Used for post-call lead extraction and summarization (M5).
   */
  async createStructuredResponse<T>(params: {
    instructions: string;
    input: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    const client = this.require();
    try {
      const response = await client.responses.create({
        model: this.config.openai.responsesModel,
        instructions: params.instructions,
        input: params.input,
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            schema: params.schema,
            strict: true,
          },
        },
      });
      const text = response.output_text;
      return JSON.parse(text) as T;
    } catch (error) {
      this.logger.error(`Responses API request failed: ${(error as Error).message}`);
      throw new ExternalServiceError('Failed to generate a structured AI response.');
    }
  }
}
