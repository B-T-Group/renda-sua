import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BedrockLunaService } from '../ai/bedrock-luna.service';
import {
  buildIdDocumentSystemPrompt,
  buildIdDocumentUserPrompt,
} from './id-document-ai-review.prompt';
import {
  ID_DOCUMENT_PROMPT_VERSION,
  IdDocumentModelResult,
} from './id-document-ai-review.types';

@Injectable()
export class IdDocumentAiReviewModelService {
  constructor(
    private readonly configService: ConfigService,
    private readonly bedrockLunaService: BedrockLunaService
  ) {}

  async reviewIdDocument(params: {
    imageUrl: string;
    expectedName: string;
    alternateNames: string[];
    documentType: string;
  }): Promise<{
    result: IdDocumentModelResult;
    modelMeta: Record<string, unknown>;
  }> {
    const model = this.bedrockLunaService.resolveModel(
      this.configService.get<string>('idDocumentAiReview.model')
    );
    const started = Date.now();
    const content = this.buildContent(params);
    const result = await this.bedrockLunaService.complete({
      model,
      messages: [
        { role: 'system', content: buildIdDocumentSystemPrompt() },
        { role: 'user', content },
      ],
      maxTokens: 600,
      temperature: 0,
      jsonObject: true,
      reasoningEffort: 'low',
      timeoutMs: 90000,
    });
    return {
      result: this.parseResult(JSON.parse(result.text)),
      modelMeta: {
        provider: 'bedrock',
        model: result.model,
        prompt_version: ID_DOCUMENT_PROMPT_VERSION,
        latency_ms: Date.now() - started,
        usage: result.usage,
      },
    };
  }

  private buildContent(params: {
    imageUrl: string;
    expectedName: string;
    alternateNames: string[];
    documentType: string;
  }) {
    return [
      {
        type: 'text',
        text: buildIdDocumentUserPrompt({
          expectedName: params.expectedName,
          alternateNames: params.alternateNames,
          documentType: params.documentType,
        }),
      },
      {
        type: 'image_url',
        image_url: { url: params.imageUrl, detail: 'high' },
      },
    ];
  }

  parseResult(raw: Record<string, unknown>): IdDocumentModelResult {
    const confidence =
      typeof raw.confidence === 'number'
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0;
    return {
      isIdDocument: raw.isIdDocument === true,
      extractedName:
        raw.extractedName == null || raw.extractedName === ''
          ? null
          : String(raw.extractedName),
      nameMatches: raw.nameMatches === true,
      confidence,
      reasons: Array.isArray(raw.reasons)
        ? raw.reasons.map((r) => String(r))
        : [],
    };
  }
}
