import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../config/app-config.service';
import { ExternalServiceError } from '../common/exceptions/domain.exception';
import { AccountStatusService } from '../tenant-status/account-status.service';

/**
 * Adapter isolating the OpenAI provider (Responses API + embeddings). The
 * Realtime voice bridge is handled separately in the telephony layer. When no
 * API key is configured the adapter reports `isEnabled === false` so callers
 * can degrade gracefully (e.g. keyword-only knowledge retrieval).
 *
 * **Every request is tenant-scoped, and the tenant is checked here.** Both
 * methods take a `companyId` as their first argument and refuse to spend a token
 * for a tenant that is not ACTIVE. That signature is the design: this adapter is
 * the only door to paid OpenAI work outside the realtime bridge, so putting the
 * gate behind it means embeddings, knowledge indexing, retrieval and post-call
 * analysis are all covered by one check that no caller can forget to make. A
 * caller that has no tenant in hand cannot call these at all, which is the
 * intended outcome — there is no such work on this platform.
 *
 * Refusal returns empty rather than throwing. Every caller already degrades
 * gracefully when OpenAI is unconfigured, so a paused tenant travels the path
 * that is known to work instead of a new error path that is not.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;

  constructor(
    private readonly config: AppConfigService,
    private readonly accountStatus: AccountStatusService,
  ) {
    const apiKey = this.config.openai.apiKey;
    // Bounded timeout + retries: post-call analysis must never hang the call
    // pipeline; failures fall back to heuristic analysis upstream.
    this.client = apiKey ? new OpenAI({ apiKey, timeout: 60_000, maxRetries: 2 }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY not set — AI features are disabled until configured.');
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  private require(): OpenAI {
    if (!this.client) {
      throw new ExternalServiceError(
        'AI is not configured on this server (missing OPENAI_API_KEY).',
      );
    }
    return this.client;
  }

  /**
   * Generate embedding vectors for a batch of texts, on behalf of one tenant.
   *
   * Returns an empty array for a tenant that is not active: no request is made,
   * no vectors are produced, and no tokens are billed.
   */
  async embed(companyId: string, texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const gate = await this.accountStatus.ensureActive(
      companyId,
      'openai.embeddings',
      'create-embeddings',
    );
    if (!gate.allowed) return [];
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
   *
   * Returns null for a tenant that is not active — no request, no tokens. The
   * caller falls back to its heuristic path, which is the same path it already
   * takes when the model is unavailable.
   */
  async createStructuredResponse<T>(
    companyId: string,
    params: {
      instructions: string;
      input: string;
      schemaName: string;
      schema: Record<string, unknown>;
    },
  ): Promise<T | null> {
    const gate = await this.accountStatus.ensureActive(
      companyId,
      'openai.responses',
      'create-structured-response',
    );
    if (!gate.allowed) return null;
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
