import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { ChatCompletionRequest } from './chat-completion.types';
import { DeepseekService } from './deepseek.service';
import { GenerateDescriptionDto } from './dto/generate-description.dto';

export interface GenerateDescriptionResponse {
  success: boolean;
  description: string;
  message: string;
  error?: string;
}

export interface CleanupProductImageResponse {
  b64_json: string;
}

interface OpenAIImageEditResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export interface ImageItemSuggestionResult {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  description?: string;
  price?: number | null;
  currency?: string | null;
  barcodeValues?: string[] | null;
  weight?: number | null;
  weightUnit?: string | null;
  dimensions?: string | null;
}

/** AI refinement for an existing catalog item (price/currency excluded). */
export interface ItemRefinementSuggestionResult {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  description?: string;
  sku?: string;
  model?: string;
  color?: string;
  /** Suggested search tags in English (lowercase keywords). */
  suggestedTagsEn?: string[];
  /** Suggested search tags in French (lowercase keywords). */
  suggestedTagsFr?: string[];
  barcodeValues?: string[] | null;
  weight?: number | null;
  weightUnit?: string | null;
  dimensions?: string | null;
  isFragile?: boolean | null;
  isPerishable?: boolean | null;
  requiresSpecialHandling?: boolean | null;
  minOrderQuantity?: number | null;
  maxOrderQuantity?: number | null;
}

/** AI extraction for rental catalog items (vision). */
export interface RentalImageSuggestionResult {
  name?: string;
  description?: string;
  rentalCategoryName?: string;
  suggestedTags?: string[];
  currency?: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiImagesEditsUrl = 'https://api.openai.com/v1/images/edits';

  constructor(
    private readonly configService: ConfigService,
    private readonly deepseekService: DeepseekService
  ) {}

  async generateProductDescription(
    dto: GenerateDescriptionDto
  ): Promise<GenerateDescriptionResponse> {
    try {
      this.logger.log(`Generating description for product: ${dto.name}`);

      const prompt = this.buildPrompt(dto);

      const request: ChatCompletionRequest = {
        model: this.deepseekService.defaultChatModel,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(dto.language || 'en'),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      };

      const response = await this.deepseekService.chatCompletions(
        request,
        30000
      );

      const rawDesc = response.choices?.[0]?.message?.content;
      const description =
        typeof rawDesc === 'string' ? rawDesc.trim() : undefined;

      if (!description) {
        this.logger.error('No description generated from DeepSeek');
        throw new HttpException(
          'No description generated',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      this.logger.log(
        `Successfully generated description for product: ${dto.name}`
      );

      return {
        success: true,
        description,
        message: 'Product description generated successfully',
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate description for product: ${dto.name}`,
        error
      );

      if (error instanceof HttpException) {
        throw error;
      }

      // Handle axios errors
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status: number } };
        if (axiosError.response?.status === 401) {
          throw new HttpException(
            'Invalid DeepSeek API key',
            HttpStatus.UNAUTHORIZED
          );
        }

        if (axiosError.response?.status === 429) {
          throw new HttpException(
            'DeepSeek API rate limit exceeded. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      if (error && typeof error === 'object' && 'code' in error) {
        const timeoutError = error as { code?: string };
        if (timeoutError.code === 'ECONNABORTED') {
          throw new HttpException(
            'Request timeout. Please try again.',
            HttpStatus.REQUEST_TIMEOUT
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new HttpException(
        {
          success: false,
          message: 'Failed to generate product description',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private buildPrompt(dto: GenerateDescriptionDto): string {
    const language = dto.language === 'fr' ? 'French' : 'English';

    let prompt = `Generate a compelling e-commerce 2 lines product description in ${language} for the following product:\n\n`;
    prompt += `Product Name: ${dto.name}\n`;

    if (dto.sku) {
      prompt += `SKU: ${dto.sku}\n`;
    }

    if (dto.category) {
      prompt += `Category: ${dto.category}\n`;
    }

    if (dto.subCategory) {
      prompt += `Subcategory: ${dto.subCategory}\n`;
    }

    if (dto.brand) {
      prompt += `Brand: ${dto.brand}\n`;
    }

    if (dto.price && dto.currency) {
      prompt += `Price: ${dto.price} ${dto.currency}\n`;
    }

    if (dto.weight && dto.weightUnit) {
      prompt += `Weight: ${dto.weight} ${dto.weightUnit}\n`;
    }

    prompt += `\nRequirements:
    - Write in ${language}
    - 2-3 sentences maximum
    - Focus on benefits, not just features
    - Use compelling, sales-oriented language
    - Include relevant keywords naturally
    - Make it engaging and persuasive
    - Avoid generic phrases
    - Tailor the tone to the product type and target market
    
    Generate the description now:`;

    return prompt;
  }

  async cleanupProductImage(
    imageUrl: string
  ): Promise<CleanupProductImageResponse> {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new HttpException(
        'OpenAI API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    try {
      const body = {
        images: [{ image_url: imageUrl }],
        prompt:
          'Clean up this product image. Remove background clutter. Add a simple background with a few subtle items or props for color (e.g. plants, fabric, or complementary objects). Keep the product as the clear focal point for e-commerce.',
        model: 'gpt-image-1.5',
        n: 1,
        output_format: 'png',
        background: 'opaque',
      };

      this.logger.log('Sending image URL to OpenAI for cleanup');
      const editResponse = await axios.post<OpenAIImageEditResponse>(
        this.openaiImagesEditsUrl,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 60000, // 60s for image processing
          maxBodyLength: 50 * 1024 * 1024,
        }
      );

      const b64_json =
        editResponse.data?.data?.[0]?.b64_json ??
        (editResponse.data as unknown as { b64_json?: string })?.b64_json;
      if (!b64_json) {
        this.logger.error('No image data in OpenAI response');
        throw new HttpException(
          'No image data returned from cleanup',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      this.logger.log('Image cleanup completed successfully');
      return { b64_json };
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup product image', error);
      if (error instanceof HttpException) throw error;
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status: number } };
        if (axiosError.response?.status === 401) {
          throw new HttpException(
            'Invalid OpenAI API key',
            HttpStatus.UNAUTHORIZED
          );
        }
        if (axiosError.response?.status === 429) {
          throw new HttpException(
            'OpenAI API rate limit exceeded. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as { code?: string };
        if (err.code === 'ECONNABORTED') {
          throw new HttpException(
            'Request timeout. Please try again.',
            HttpStatus.REQUEST_TIMEOUT
          );
        }
      }
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpException(
        { message: 'Failed to cleanup image', error: message },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private getSystemPrompt(language: string): string {
    const languageText = language === 'fr' ? 'French' : 'English';

    return `You are a professional product description writer specializing in e-commerce. Your expertise includes:
    - Creating compelling, SEO-optimized product descriptions
    - Highlighting key features and benefits
    - Writing in ${languageText} for international markets
    - Understanding different product categories and their unique selling points
    - Creating descriptions that drive sales and engagement
    
    Always focus on:
    - Customer benefits over technical features
    - Emotional connection with the target audience
    - Clear, concise, and persuasive language
    - Natural keyword integration
    - Professional tone appropriate for business customers`;
  }

  async generateImageItemSuggestions(input: {
    imageUrl: string;
    caption?: string | null;
    altText?: string | null;
    defaultCurrency?: string;
    preferredLanguage?: string | null;
  }): Promise<ImageItemSuggestionResult> {
    const defaultCurrency = input.defaultCurrency || 'XAF';
    const descriptionLanguage = this.resolvePreferredLanguage(
      input.preferredLanguage
    );
    const languageLabel =
      descriptionLanguage === 'fr' ? 'French' : 'English';
    const textContextParts: string[] = [];
    if (input.caption) {
      textContextParts.push(`Caption: ${input.caption}`);
    }
    if (input.altText) {
      textContextParts.push(`Alt text: ${input.altText}`);
    }
    const textContext = textContextParts.join('\n');

    const systemPrompt =
      'You are an AI assistant that performs OCR on product images and extracts structured product data for e-commerce.';

    const userText = `
You are given a product image. First, try to decode any barcode(s) visible on the image. If a barcode is decoded, use it as the strongest signal for identifying the product.
Then, use OCR on the image and any visible labels/price tags to extract:
- Product name
- Category name
- Subcategory name
- Brand name
- A short 2–3 sentence e-commerce description in English
 - A short 2–3 sentence e-commerce description in ${languageLabel}
- The product price as a number (no currency symbol)
- The currency code (3-letter code). If no currency symbol or code is visible, default to "${defaultCurrency}".
- Any decoded barcode values (EAN/UPC/etc) if readable.
- Product weight as a number (if visible)
- Weight unit (e.g. g, kg, ml, l)
- Product dimensions string (e.g. 20x10x5 cm) if visible.

Additional text context from the image record (may be empty):
${textContext || 'N/A'}

Return ONLY a single JSON object with this exact shape:
{
  "name": string | null,
  "categoryName": string | null,
  "subCategoryName": string | null,
  "brandName": string | null,
  "description": string | null,
  "price": number | null,
  "currency": string | null,
  "barcodeValues": string[] | null,
  "weight": number | null,
  "weightUnit": string | null,
  "dimensions": string | null
}

Do not include any explanation outside of the JSON.
The "description" field MUST be written in ${languageLabel}.`;

    const request: ChatCompletionRequest = {
      model: this.deepseekService.defaultChatModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `${userText}\n\nImage URL: ${input.imageUrl}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.1,
    };

    try {
      this.logger.log(
        `Generating image item suggestions for image: ${input.imageUrl}`
      );
      const response = await this.deepseekService.chatCompletions(
        request,
        40000
      );

      const rawContent = response.choices?.[0]?.message?.content;
      const contentString = this.messageContentToString(rawContent);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(contentString) as Record<string, unknown>;
      } catch (parseError: unknown) {
        this.logger.error(
          'Failed to parse JSON from image item suggestions',
          parseError
        );
        parsed = {};
      }

      const suggestion: ImageItemSuggestionResult = {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        categoryName:
          typeof parsed.categoryName === 'string' ? parsed.categoryName : undefined,
        subCategoryName:
          typeof parsed.subCategoryName === 'string'
            ? parsed.subCategoryName
            : undefined,
        brandName:
          typeof parsed.brandName === 'string' ? parsed.brandName : undefined,
        description:
          typeof parsed.description === 'string' ? parsed.description : undefined,
        price:
          typeof parsed.price === 'number'
            ? parsed.price
            : parsed.price != null
            ? Number(parsed.price) || null
            : null,
        currency:
          typeof parsed.currency === 'string' ? parsed.currency : defaultCurrency,
        barcodeValues: Array.isArray(parsed.barcodeValues)
          ? (parsed.barcodeValues as unknown[]).filter(
              (v): v is string => typeof v === 'string'
            )
          : null,
        weight:
          typeof parsed.weight === 'number'
            ? parsed.weight
            : parsed.weight != null
            ? Number(parsed.weight) || null
            : null,
        weightUnit: typeof parsed.weightUnit === 'string' ? parsed.weightUnit : null,
        dimensions:
          typeof parsed.dimensions === 'string' ? parsed.dimensions : null,
      };
      const barcode = suggestion.barcodeValues?.find((v) => !!v)?.trim();
      if (!barcode) {
        return suggestion;
      }

      const lookup = await this.lookupProductByBarcode(barcode);
      if (!lookup) {
        return suggestion;
      }

      return {
        ...suggestion,
        name: lookup.name || suggestion.name,
        brandName: lookup.brandName || suggestion.brandName,
        categoryName: lookup.categoryName || suggestion.categoryName,
        subCategoryName: lookup.subCategoryName || suggestion.subCategoryName,
        weight: lookup.weight ?? suggestion.weight,
        weightUnit: lookup.weightUnit ?? suggestion.weightUnit,
        dimensions: lookup.dimensions ?? suggestion.dimensions,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to generate image item suggestions for image: ${input.imageUrl}`,
        error
      );
      // Fallback: minimal suggestion using caption/alt text only
      return {
        name: input.caption || input.altText || undefined,
        categoryName: undefined,
        subCategoryName: undefined,
        brandName: undefined,
        description: undefined,
        price: null,
        currency: defaultCurrency,
        barcodeValues: null,
        weight: null,
        weightUnit: null,
        dimensions: null,
      };
    }
  }

  async generateItemRefinementSuggestions(input: {
    itemSnapshot: Record<string, unknown>;
    imageUrls: string[];
    preferredLanguage?: string | null;
  }): Promise<ItemRefinementSuggestionResult> {
    const descriptionLanguage = this.resolvePreferredLanguage(
      input.preferredLanguage
    );
    const languageLabel =
      descriptionLanguage === 'fr' ? 'French' : 'English';
    const userText = this.buildItemRefinementPrompt(
      input.itemSnapshot,
      languageLabel
    );
    const imageUrlsText = input.imageUrls.length
      ? `\n\nImage URLs:\n${input.imageUrls.map((u) => `- ${u}`).join('\n')}`
      : '';
    const request: ChatCompletionRequest = {
      model: this.deepseekService.defaultChatModel,
      messages: [
        {
          role: 'system',
          content:
            'You refine e-commerce product listings using catalog data and product photos. Never invent a new price or currency.',
        },
        { role: 'user', content: `${userText}${imageUrlsText}` },
      ],
      max_tokens: 700,
      temperature: 0.2,
    };
    return this.runItemRefinementCompletion(request);
  }

  private buildItemRefinementPrompt(
    item: Record<string, unknown>,
    languageLabel: string
  ): string {
    const json = JSON.stringify(item, null, 2);
    return `
You are refining an existing product listing. Current catalog fields (JSON):
${json}

You are also given one or more product images (main image first). Use OCR and visual cues together with the existing fields to suggest improved, accurate catalog content.

Rules:
- Do NOT output price or currency (they are managed separately).
- The "description", categoryName, subCategoryName MUST be written in ${languageLabel}.
- Suggestions for categoryName and subCategoryName should be short and concise and one word related to the product and shoud not take into account the existing categoryName and subCategoryName.
- Tags MUST be provided in BOTH languages: English and French and should be short and concise and one word related to the product, at most 5 tags per language.
- Prefer small, justified improvements; keep names truthful to what is visible.
- If a field should stay as-is, repeat the current value or omit if unchanged.
- Only specify dimensions/weight/weightUnit if they are visible on the image.

Return ONLY a single JSON object with this exact shape (null allowed for unknowns):
{
  "name": string | null,
  "categoryName": string | null,
  "subCategoryName": string | null,
  "brandName": string | null,
  "description": string | null,
  "sku": string | null,
  "model": string | null,
  "color": string | null,
  "suggestedTagsEn": string[] | null,
  "suggestedTagsFr": string[] | null,
  "barcodeValues": string[] | null,
  "weight": number | null,
  "weightUnit": string | null,
  "dimensions": string | null,
  "isFragile": boolean | null,
  "isPerishable": boolean | null,
  "requiresSpecialHandling": boolean | null,
  "minOrderQuantity": number | null,
  "maxOrderQuantity": number | null
}

Do not include any text outside the JSON.`;
  }

  private async runItemRefinementCompletion(
    request: ChatCompletionRequest
  ): Promise<ItemRefinementSuggestionResult> {
    try {
      const response = await this.deepseekService.chatCompletions(
        request,
        90000
      );
      const rawContent = response.choices?.[0]?.message?.content;
      const contentString = this.messageContentToString(rawContent);
      const jsonString = this.coerceJsonObjectString(contentString);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonString) as Record<string, unknown>;
      } catch (parseError: unknown) {
        this.logger.error(
          'Failed to parse JSON from item refinement',
          parseError
        );
        parsed = {};
      }
      const suggestion = this.mapParsedItemRefinement(parsed);
      return this.mergeBarcodeLookup(suggestion);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to generate item refinement suggestions', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to refine item with AI',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private messageContentToString(raw: unknown): string {
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw)) {
      return raw
        .map((p) => {
          if (!p || typeof p !== 'object') return '';
          const rec = p as Record<string, unknown>;
          return typeof rec.text === 'string' ? rec.text : '';
        })
        .join('\n');
    }
    return String(raw ?? '');
  }

  private coerceJsonObjectString(input: string): string {
    const trimmed = input.trim();
    const fenceMatch = trimmed.match(
      /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );
    if (fenceMatch?.[1]) {
      return fenceMatch[1].trim();
    }
    return trimmed;
  }

  private mapParsedItemRefinement(
    parsed: Record<string, unknown>
  ): ItemRefinementSuggestionResult {
    const num = (v: unknown): number | null => {
      if (typeof v === 'number' && !Number.isNaN(v)) {
        return v;
      }
      if (v != null && v !== '') {
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    };
    const bool = (v: unknown): boolean | null =>
      typeof v === 'boolean' ? v : null;
    const tags = (v: unknown): string[] | undefined => {
      if (!Array.isArray(v)) return undefined;
      const out = v
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      return out.length ? Array.from(new Set(out)) : [];
    };
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      categoryName:
        typeof parsed.categoryName === 'string'
          ? parsed.categoryName
          : undefined,
      subCategoryName:
        typeof parsed.subCategoryName === 'string'
          ? parsed.subCategoryName
          : undefined,
      brandName:
        typeof parsed.brandName === 'string' ? parsed.brandName : undefined,
      description:
        typeof parsed.description === 'string' ? parsed.description : undefined,
      sku: typeof parsed.sku === 'string' ? parsed.sku : undefined,
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
      color: typeof parsed.color === 'string' ? parsed.color : undefined,
      suggestedTagsEn: tags(parsed.suggestedTagsEn),
      suggestedTagsFr: tags(parsed.suggestedTagsFr),
      barcodeValues: Array.isArray(parsed.barcodeValues)
        ? (parsed.barcodeValues as unknown[]).filter(
            (x): x is string => typeof x === 'string'
          )
        : null,
      weight: num(parsed.weight),
      weightUnit:
        typeof parsed.weightUnit === 'string' ? parsed.weightUnit : undefined,
      dimensions:
        typeof parsed.dimensions === 'string' ? parsed.dimensions : undefined,
      isFragile: bool(parsed.isFragile),
      isPerishable: bool(parsed.isPerishable),
      requiresSpecialHandling: bool(parsed.requiresSpecialHandling),
      minOrderQuantity: num(parsed.minOrderQuantity),
      maxOrderQuantity: num(parsed.maxOrderQuantity),
    };
  }

  private async mergeBarcodeLookup(
    suggestion: ItemRefinementSuggestionResult
  ): Promise<ItemRefinementSuggestionResult> {
    const barcode = suggestion.barcodeValues?.find((v) => !!v)?.trim();
    if (!barcode) {
      return suggestion;
    }
    const lookup = await this.lookupProductByBarcode(barcode);
    if (!lookup) {
      return suggestion;
    }
    return {
      ...suggestion,
      name: lookup.name || suggestion.name,
      brandName: lookup.brandName || suggestion.brandName,
      categoryName: lookup.categoryName || suggestion.categoryName,
      subCategoryName: lookup.subCategoryName || suggestion.subCategoryName,
      weight: lookup.weight ?? suggestion.weight,
      weightUnit: lookup.weightUnit ?? suggestion.weightUnit,
      dimensions: lookup.dimensions ?? suggestion.dimensions,
    };
  }

  async generateRentalImageSuggestions(input: {
    imageUrl: string;
    caption?: string | null;
    altText?: string | null;
    defaultCurrency?: string;
    preferredLanguage?: string | null;
  }): Promise<RentalImageSuggestionResult> {
    const defaultCurrency = input.defaultCurrency || 'XAF';
    const descriptionLanguage = this.resolvePreferredLanguage(
      input.preferredLanguage
    );
    const textContext = this.buildRentalSuggestionTextContext(input);
    const userText = this.buildRentalSuggestionUserPrompt(
      textContext,
      defaultCurrency,
      descriptionLanguage
    );
    try {
      return await this.requestRentalImageSuggestions(
        input.imageUrl,
        userText,
        defaultCurrency
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Rental image suggestions failed for ${input.imageUrl}`,
        error
      );
      return this.fallbackRentalSuggestion(input, defaultCurrency);
    }
  }

  private buildRentalSuggestionTextContext(input: {
    caption?: string | null;
    altText?: string | null;
  }): string {
    const parts: string[] = [];
    if (input.caption) parts.push(`Caption: ${input.caption}`);
    if (input.altText) parts.push(`Alt text: ${input.altText}`);
    return parts.join('\n') || 'N/A';
  }

  private buildRentalSuggestionUserPrompt(
    textContext: string,
    defaultCurrency: string,
    descriptionLanguage: 'en' | 'fr'
  ): string {
    const languageLabel = descriptionLanguage === 'fr' ? 'French' : 'English';
    return `
You analyze photos of assets that could be rented (tools, equipment, vehicles, event items, apparel, etc.).
Infer a concise rental listing from the image and any visible text.

Context from the image record (may be empty):
${textContext}

Return ONLY a JSON object with this exact shape:
{
  "name": string | null,
  "description": string | null,
  "rentalCategoryName": string | null,
  "suggestedTags": string[] | null,
  "currency": string | null
}

- name: short title for the rental item (not a full sentence).
- description: 2–4 sentences for renters (condition, typical use, what is included if visible) in ${languageLabel}.
- rentalCategoryName: the best-matching category label in plain English (e.g. "Power tools", "Vehicles", "Event equipment") — a human name, not an id.
- suggestedTags: a few lowercase keywords for search (e.g. ["drill", "cordless", "dewalt"]).
- currency: 3-letter ISO code for pricing context if inferable; otherwise "${defaultCurrency}".

No markdown, no explanation outside JSON.`;
  }

  private resolvePreferredLanguage(
    preferredLanguage?: string | null
  ): 'en' | 'fr' {
    const normalized = preferredLanguage?.trim().toLowerCase();
    return normalized?.startsWith('fr') ? 'fr' : 'en';
  }

  private async requestRentalImageSuggestions(
    imageUrl: string,
    userText: string,
    defaultCurrency: string
  ): Promise<RentalImageSuggestionResult> {
    const request: ChatCompletionRequest = {
      model: this.deepseekService.defaultChatModel,
      messages: [
        {
          role: 'system',
          content:
            'You extract structured rental catalog data from images for a rentals marketplace.',
        },
        {
          role: 'user',
          content: `${userText}\n\nImage URL: ${imageUrl}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    };
    const response = await this.deepseekService.chatCompletions(
      request,
      45000
    );
    const rawContent = response.choices?.[0]?.message?.content;
    const contentString = this.messageContentToString(rawContent);
    return this.parseRentalSuggestionJson(contentString, defaultCurrency);
  }

  private parseRentalSuggestionJson(
    contentString: string,
    defaultCurrency: string
  ): RentalImageSuggestionResult {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(contentString) as Record<string, unknown>;
    } catch (parseError: unknown) {
      this.logger.error('Failed to parse rental suggestion JSON', parseError);
      return { currency: defaultCurrency };
    }
    const tags = parsed.suggestedTags;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      description:
        typeof parsed.description === 'string' ? parsed.description : undefined,
      rentalCategoryName:
        typeof parsed.rentalCategoryName === 'string'
          ? parsed.rentalCategoryName
          : undefined,
      suggestedTags: Array.isArray(tags)
        ? tags.filter((t): t is string => typeof t === 'string')
        : undefined,
      currency:
        typeof parsed.currency === 'string' ? parsed.currency : defaultCurrency,
    };
  }

  private fallbackRentalSuggestion(
    input: {
      caption?: string | null;
      altText?: string | null;
    },
    defaultCurrency: string
  ): RentalImageSuggestionResult {
    return {
      name: input.caption || input.altText || undefined,
      description: undefined,
      rentalCategoryName: undefined,
      suggestedTags: undefined,
      currency: defaultCurrency,
    };
  }

  private async lookupProductByBarcode(
    barcode: string
  ): Promise<
    | {
        name?: string;
        brandName?: string;
        categoryName?: string;
        subCategoryName?: string;
        weight?: number | null;
        weightUnit?: string | null;
        dimensions?: string | null;
      }
    | null
  > {
    const normalized = barcode.replace(/\s+/g, '');
    if (!normalized) return null;
    try {
      // Best-effort public lookup (works mainly for food/packaged goods).
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        normalized
      )}.json`;
      const resp = await axios.get(url, { timeout: 15000 });
      const product = resp.data?.product;
      if (!product) return null;

      const name: string | undefined =
        product.product_name || product.generic_name || undefined;
      const brandName: string | undefined =
        typeof product.brands === 'string' && product.brands.trim()
          ? product.brands.split(',')[0].trim()
          : undefined;

      const categories: string[] =
        typeof product.categories === 'string'
          ? product.categories
              .split(',')
              .map((c: string) => c.trim())
              .filter(Boolean)
          : [];
      const categoryName = categories[0];
      const subCategoryName = categories.length > 1 ? categories[1] : undefined;

      // Try to infer weight from quantity like "500 g" or "1L"
      let weight: number | null = null;
      let weightUnit: string | null = null;
      const quantity: string =
        typeof product.quantity === 'string' ? product.quantity : '';
      const qtyMatch = quantity.match(
        /(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|cl)\b/i
      );
      if (qtyMatch) {
        weight = Number(qtyMatch[1].replace(',', '.')) || null;
        weightUnit = qtyMatch[2].toLowerCase();
      }

      return {
        name,
        brandName,
        categoryName,
        subCategoryName,
        weight,
        weightUnit,
        dimensions: null,
      };
    } catch {
      return null;
    }
  }
}
