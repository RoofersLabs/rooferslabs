import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { RagService } from './rag.service';

/**
 * AI integration layer. Owns the OpenAI adapter and RAG retrieval; extended in
 * M5 with the conversation/summary services and in M6 with the Realtime voice
 * bridge. Exported so knowledge, telephony, and call modules can consume it.
 */
@Module({
  providers: [OpenAiService, RagService],
  exports: [OpenAiService, RagService],
})
export class AiModule {}
