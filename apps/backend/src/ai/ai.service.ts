import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { normalizeWeightUnit } from '../common/weight-units';
import {
  applyCookedFoodCategories,
  isCookedFoodSuggestion,
} from '../food/apply-cooked-food-category';
import {
  FOOD_CATEGORY_NAME,
  FOOD_SUB_CATEGORY_NAME,
} from '../food/food.constants';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './chat-completion.types';
import { BedrockLunaService } from './bedrock-luna.service';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { buildProductImageCleanupPrompt } from './product-image-cleanup-prompt';

export interface GenerateDescriptionResponse {
  success: boolean;
  description: string;
  message: string;
  error?: string;
}

export interface CleanupProductImageResponse {
  b64_json: string;
}

export interface CleanupProductImageIssue {
  code: string;
  message?: string;
}

export interface CleanupProductImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  issues?: CleanupProductImageIssue[];
  /** OpenAI Images model override (e.g. gpt-image-1.5). */
  model?: string;
}

interface OpenAIImageEditResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export type SuggestionFieldConfidence = 'high' | 'medium' | 'low';

export interface ImageItemSuggestionConfidence {
  name: SuggestionFieldConfidence;
  categoryName: SuggestionFieldConfidence;
  subCategoryName: SuggestionFieldConfidence;
  brandName: SuggestionFieldConfidence;
  description: SuggestionFieldConfidence;
  price: SuggestionFieldConfidence;
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
  /**
   * True when a shopper needs size (clothing, shoes, perfume volume, etc.)
   * to decide on a purchase. False when size is not purchase-relevant.
   */
  isSizeRequired?: boolean | null;
  /** True when photos/text indicate a used / pre-owned item. */
  isUsed?: boolean | null;
  /** True when the item is a cooked restaurant dish. */
  isFoodItem?: boolean | null;
  confidence?: ImageItemSuggestionConfidence;
  categoryAlternates?: string[];
  subCategoryAlternates?: string[];
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
  /** True when photos/text indicate a used / pre-owned item. */
  isUsed?: boolean | null;
  requiresSpecialHandling?: boolean | null;
  minOrderQuantity?: number | null;
  maxOrderQuantity?: number | null;
}

/** AI suggestions for a new variant of an existing catalog item. */
export interface VariantSuggestionResult {
  name?: string;
  color?: string;
  sku?: string;
  price?: number | null;
  currency?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  dimensions?: string | null;
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
  private static readonly IMAGE_ITEM_VISION_MAX_IMAGES = 10;
  private static readonly IMAGE_FETCH_MAX_BYTES = 10 * 1024 * 1024;

  constructor(
    private readonly configService: ConfigService,
    private readonly bedrockLunaService: BedrockLunaService
  ) {}

  async generateProductDescription(
    dto: GenerateDescriptionDto
  ): Promise<GenerateDescriptionResponse> {
    try {
      this.logger.log(`Generating description for product: ${dto.name}`);

      const prompt = this.buildPrompt(dto);

      const request: ChatCompletionRequest = {
        model: this.bedrockLunaService.getDefaultChatModel(),
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

      const response = await this.bedrockLunaService.chatCompletions(
        request,
        30000,
        { reasoningEffort: 'none' }
      );

      const rawDesc = response.choices?.[0]?.message?.content;
      const description =
        typeof rawDesc === 'string' ? rawDesc.trim() : undefined;

      if (!description) {
        this.logger.error('No description generated from Bedrock');
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

      if (error && typeof error === 'object' && 'code' in error) {
        const timeoutError = error as { code?: string };
        if (timeoutError.code === 'ECONNABORTED') {
          throw new HttpException(
            'Request timeout. Please try again.',
            HttpStatus.REQUEST_TIMEOUT
          );
        }
      }

      throw new HttpException(
        {
          success: false,
          message: 'AI temporarily unavailable. Please try again.',
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        HttpStatus.SERVICE_UNAVAILABLE
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
    input: string | CleanupProductImageInput
  ): Promise<CleanupProductImageResponse> {
    const resolved =
      typeof input === 'string' ? { imageUrl: input } : input;
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new HttpException(
        'OpenAI API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    try {
      const { buffer, mimeType, filename } =
        await this.resolveCleanupImageFile(resolved);
      const form = this.buildCleanupImageForm(
        buffer,
        mimeType,
        filename,
        buildProductImageCleanupPrompt(resolved.issues),
        resolved.model
      );
      this.logger.log('Sending image to OpenAI for cleanup');
      const editResponse = await axios.post<OpenAIImageEditResponse>(
        this.openaiImagesEditsUrl,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 120000,
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
      this.throwCleanupImageError(error);
    }
  }

  private buildCleanupImageForm(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    prompt: string,
    model?: string
  ): FormData {
    const form = new FormData();
    form.append('image', buffer, { filename, contentType: mimeType });
    form.append(
      'model',
      model?.trim() || 'gpt-image-1.5'
    );
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', '1024x1024');
    form.append('quality', 'medium');
    form.append('output_format', 'jpeg');
    form.append('background', 'opaque');
    return form;
  }

  private async resolveCleanupImageFile(
    input: CleanupProductImageInput
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    if (input.imageBase64?.trim()) {
      const mimeType = input.mimeType?.trim() || 'image/jpeg';
      return {
        buffer: Buffer.from(input.imageBase64.trim(), 'base64'),
        mimeType,
        filename: this.filenameForMime(mimeType),
      };
    }
    const ref = input.imageUrl?.trim();
    if (!ref) {
      throw new HttpException(
        'imageUrl or imageBase64 is required',
        HttpStatus.BAD_REQUEST
      );
    }
    if (ref.startsWith('data:')) {
      return this.bufferFromDataUrl(ref);
    }
    return this.fetchCleanupImageFile(ref);
  }

  private bufferFromDataUrl(dataUrl: string): {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  } {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) {
      throw new HttpException(
        'Invalid image data URL',
        HttpStatus.BAD_REQUEST
      );
    }
    const mimeType = match[1] || 'image/jpeg';
    return {
      buffer: Buffer.from(match[2], 'base64'),
      mimeType,
      filename: this.filenameForMime(mimeType),
    };
  }

  private async fetchCleanupImageFile(url: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    const { data, headers, status } = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 25000,
      maxContentLength: AiService.IMAGE_FETCH_MAX_BYTES,
      maxBodyLength: AiService.IMAGE_FETCH_MAX_BYTES,
      validateStatus: (s) => s === 200,
    });
    if (status !== 200 || !data) {
      throw new HttpException(
        'Could not download image for cleanup',
        HttpStatus.BAD_REQUEST
      );
    }
    const mimeType =
      headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      throw new HttpException(
        'Cleanup source is not an image',
        HttpStatus.BAD_REQUEST
      );
    }
    return {
      buffer: Buffer.from(data),
      mimeType,
      filename: this.filenameForMime(mimeType),
    };
  }

  private filenameForMime(mimeType: string): string {
    if (mimeType.includes('png')) return 'product.png';
    if (mimeType.includes('webp')) return 'product.webp';
    return 'product.jpg';
  }

  private throwCleanupImageError(error: unknown): never {
    this.logger.error('Failed to cleanup product image', error);
    if (error instanceof HttpException) throw error;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiMessage = this.openAiErrorMessage(error.response?.data);
      if (apiMessage) {
        this.logger.error(`OpenAI image edit error: ${apiMessage}`);
      }
      if (status === 401) {
        throw new HttpException(
          'Image cleanup is temporarily unavailable. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      if (status === 429) {
        throw new HttpException(
          'Image cleanup is temporarily unavailable. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      if (status === 400) {
        throw new HttpException(
          {
            message: 'Failed to cleanup image',
            error: apiMessage || 'The image could not be cleaned up',
          },
          HttpStatus.BAD_REQUEST
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

  private openAiErrorMessage(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const err = (data as { error?: { message?: string } }).error;
    return typeof err?.message === 'string' ? err.message : null;
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

  /**
   * Suggests catalog fields using multimodal vision via Bedrock Converse (Nova).
   * Images are fetched server-side and sent as vision parts.
   */
  async generateImageItemSuggestions(input: {
    imageUrls: string[];
    caption?: string | null;
    altText?: string | null;
    /** Optional short merchant description of what was photographed. */
    hint?: string | null;
    defaultCurrency?: string;
    preferredLanguage?: string | null;
    country?: string | null;
    existingCatalogNames?: string[];
    existingBrandNames?: string[];
    /** Compact category > subcategory list for vision prompt. */
    existingCatalogPrompt?: string | null;
    /** Merchant indicated a cooked restaurant dish. */
    isFoodItem?: boolean | null;
  }): Promise<ImageItemSuggestionResult> {
    const urls = (input.imageUrls ?? []).filter((u) => !!u?.trim());
    const defaultCurrency = input.defaultCurrency || 'XAF';
    const descriptionLanguage = this.resolvePreferredLanguage(
      input.preferredLanguage
    );
    const languageLabel =
      descriptionLanguage === 'fr' ? 'French' : 'English';
    const textContextParts: string[] = [];
    if (input.hint?.trim()) {
      textContextParts.push(
        `Merchant hint (authoritative for product identity): ${input.hint.trim()}`
      );
    }
    if (input.caption) {
      textContextParts.push(`Caption: ${input.caption}`);
    }
    if (input.altText) {
      textContextParts.push(`Alt text: ${input.altText}`);
    }
    if (input.country) {
      textContextParts.push(`Business country: ${input.country}`);
    }
    if (input.existingBrandNames?.length) {
      textContextParts.push(
        `Known brands in this catalog: ${input.existingBrandNames
          .slice(0, 40)
          .join(', ')}`
      );
    }
    if (input.existingCatalogNames?.length) {
      textContextParts.push(
        `Existing product names (avoid near-duplicates): ${input.existingCatalogNames
          .slice(0, 40)
          .join(', ')}`
      );
    }
    if (input.existingCatalogPrompt?.trim()) {
      textContextParts.push(
        `Platform catalog (prefer these exact category and subcategory names when they fit; only invent new names if nothing matches):\n${input.existingCatalogPrompt.trim()}`
      );
    }
    if (input.isFoodItem) {
      textContextParts.push(
        `Merchant indicated this is a cooked restaurant dish. Set isFoodItem true and use category "${FOOD_CATEGORY_NAME}" with subcategory "${FOOD_SUB_CATEGORY_NAME}".`
      );
    }
    const textContext = textContextParts.join('\n');
    const emptyResult = (): ImageItemSuggestionResult => {
      const base: ImageItemSuggestionResult = {
        name: input.hint?.trim() || input.caption || input.altText || undefined,
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
        isSizeRequired: false,
        isUsed: null,
        isFoodItem: input.isFoodItem ? true : null,
        confidence: this.defaultConfidence(!!input.hint?.trim()),
        categoryAlternates: [],
        subCategoryAlternates: [],
      };
      return isCookedFoodSuggestion(base, input.isFoodItem)
        ? applyCookedFoodCategories(base)
        : base;
    };

    if (!urls.length) {
      return emptyResult();
    }

    const visionSystem = this.buildImageItemVisionSystemPrompt();
    const visionUserText = this.buildImageItemVisionUserText(
      defaultCurrency,
      languageLabel,
      textContext,
      !!input.hint?.trim()
    );
    const resolvedImages = await this.resolveVisionImageUrls(urls);
    const visionUserContent = this.buildVisionUserContentParts(
      visionUserText,
      resolvedImages
    );

    const visionRequest: ChatCompletionRequest = {
      model: this.bedrockLunaService.getDefaultChatModel(),
      messages: [
        { role: 'system', content: visionSystem },
        { role: 'user', content: visionUserContent },
      ],
      max_tokens: 900,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };

    try {
      this.logger.log(
        `Generating image item suggestions (Bedrock vision) for ${urls.length} image(s)`
      );
      const response = await this.bedrockLunaService.chatCompletions(
        visionRequest,
        120000,
        { reasoningEffort: 'none', jsonObject: true }
      );

      const rawContent = response.choices?.[0]?.message?.content;
      const contentString = this.messageContentToString(rawContent);
      const jsonString = this.coerceJsonObjectString(contentString);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonString) as Record<string, unknown>;
      } catch (parseError: unknown) {
        this.logger.error(
          'Failed to parse JSON from image item suggestions',
          parseError
        );
        parsed = {};
      }

      const suggestion = this.parseImageItemSuggestion(
        parsed,
        defaultCurrency,
        !!input.hint?.trim()
      );
      const barcode = suggestion.barcodeValues?.find((v) => !!v)?.trim();
      if (!barcode) {
        return this.finalizeImageItemSuggestion(suggestion, input.isFoodItem);
      }

      const lookup = await this.lookupProductByBarcode(barcode);
      if (!lookup) {
        return this.finalizeImageItemSuggestion(suggestion, input.isFoodItem);
      }

      return this.finalizeImageItemSuggestion(
        {
          ...suggestion,
          name:
            this.sanitizeSuggestedProductName(lookup.name) || suggestion.name,
          brandName: lookup.brandName || suggestion.brandName,
          categoryName: lookup.categoryName || suggestion.categoryName,
          subCategoryName: lookup.subCategoryName || suggestion.subCategoryName,
          weight: lookup.weight ?? suggestion.weight,
          weightUnit: lookup.weightUnit ?? suggestion.weightUnit,
          dimensions: lookup.dimensions ?? suggestion.dimensions,
          confidence: {
            ...suggestion.confidence!,
            name: 'high',
            brandName: lookup.brandName ? 'high' : suggestion.confidence!.brandName,
            categoryName: lookup.categoryName
              ? 'high'
              : suggestion.confidence!.categoryName,
          },
        },
        input.isFoodItem
      );
    } catch (error: unknown) {
      return this.logAndDegrade(
        error,
        `Failed to generate image item suggestions for ${urls.length} image(s)`,
        emptyResult()
      );
    }
  }

  private defaultConfidence(
    hasHint: boolean
  ): ImageItemSuggestionConfidence {
    const nameLevel: SuggestionFieldConfidence = hasHint ? 'medium' : 'low';
    return {
      name: nameLevel,
      categoryName: 'low',
      subCategoryName: 'low',
      brandName: 'low',
      description: 'low',
      price: 'low',
    };
  }

  private parseOptionalBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private parseConfidenceLevel(
    value: unknown,
    fallback: SuggestionFieldConfidence
  ): SuggestionFieldConfidence {
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return fallback;
  }

  private parseImageItemSuggestion(
    parsed: Record<string, unknown>,
    defaultCurrency: string,
    hasHint: boolean
  ): ImageItemSuggestionResult {
    const confRaw =
      parsed.confidence && typeof parsed.confidence === 'object'
        ? (parsed.confidence as Record<string, unknown>)
        : {};
    const name = this.sanitizeSuggestedProductName(
      typeof parsed.name === 'string' ? parsed.name : undefined
    );
    const categoryName =
      typeof parsed.categoryName === 'string' ? parsed.categoryName : undefined;
    const subCategoryName =
      typeof parsed.subCategoryName === 'string'
        ? parsed.subCategoryName
        : undefined;
    const brandName =
      typeof parsed.brandName === 'string' ? parsed.brandName : undefined;
    const description =
      typeof parsed.description === 'string' ? parsed.description : undefined;
    const price =
      typeof parsed.price === 'number'
        ? parsed.price
        : parsed.price != null
        ? Number(parsed.price) || null
        : null;
    const defaults = this.defaultConfidence(hasHint);
    const confidence: ImageItemSuggestionConfidence = {
      name: name
        ? this.parseConfidenceLevel(confRaw.name, hasHint ? 'high' : 'medium')
        : 'low',
      categoryName: categoryName
        ? this.parseConfidenceLevel(confRaw.categoryName, 'medium')
        : 'low',
      subCategoryName: subCategoryName
        ? this.parseConfidenceLevel(confRaw.subCategoryName, 'medium')
        : 'low',
      brandName: brandName
        ? this.parseConfidenceLevel(confRaw.brandName, 'medium')
        : 'low',
      description: description
        ? this.parseConfidenceLevel(confRaw.description, 'medium')
        : 'low',
      price:
        price != null
          ? this.parseConfidenceLevel(confRaw.price, 'medium')
          : 'low',
    };
    const categoryAlternates = Array.isArray(parsed.categoryAlternates)
      ? (parsed.categoryAlternates as unknown[]).filter(
          (v): v is string => typeof v === 'string'
        )
      : [];
    const subCategoryAlternates = Array.isArray(parsed.subCategoryAlternates)
      ? (parsed.subCategoryAlternates as unknown[]).filter(
          (v): v is string => typeof v === 'string'
        )
      : [];
    return {
      name,
      categoryName,
      subCategoryName,
      brandName,
      description,
      price,
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
      weightUnit:
        typeof parsed.weightUnit === 'string'
          ? normalizeWeightUnit(parsed.weightUnit)
          : null,
      dimensions:
        typeof parsed.dimensions === 'string' ? parsed.dimensions : null,
      isSizeRequired: this.parseOptionalBoolean(parsed.isSizeRequired) ?? false,
      isUsed: typeof parsed.isUsed === 'boolean' ? parsed.isUsed : null,
      isFoodItem: this.parseOptionalBoolean(parsed.isFoodItem),
      confidence: { ...defaults, ...confidence },
      categoryAlternates,
      subCategoryAlternates,
    };
  }

  async generateVariantSuggestions(input: {
    parentSnapshot: Record<string, unknown>;
    imageUrls: string[];
    preferredLanguage?: string | null;
  }): Promise<VariantSuggestionResult> {
    const languageLabel =
      this.resolvePreferredLanguage(input.preferredLanguage) === 'fr'
        ? 'French'
        : 'English';
    const userText = this.buildVariantSuggestionPrompt(
      input.parentSnapshot,
      languageLabel
    );
    const resolvedImages = await this.resolveVisionImageUrls(input.imageUrls);
    const userContent =
      resolvedImages.length > 0
        ? this.buildVisionUserContentParts(userText, resolvedImages)
        : userText;
    const request: ChatCompletionRequest = {
      model: this.bedrockLunaService.getDefaultChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'You suggest fields for a new product variant (color/size option) of an existing catalog item. Use parent item data as ground truth; read distinguishing traits from photos.',
        },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    return this.runVariantSuggestionCompletion(request);
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
    const resolvedImages = await this.resolveVisionImageUrls(input.imageUrls);
    const userContent =
      resolvedImages.length > 0
        ? this.buildVisionUserContentParts(userText, resolvedImages)
        : userText;
    const request: ChatCompletionRequest = {
      model: this.bedrockLunaService.getDefaultChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'You refine e-commerce product listings using catalog data and product photos. Never invent a new price or currency.',
        },
        { role: 'user', content: userContent },
      ],
      max_tokens: 700,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    return this.runItemRefinementCompletion(request);
  }

  private buildVariantSuggestionPrompt(
    parent: Record<string, unknown>,
    languageLabel: string
  ): string {
    const json = JSON.stringify(parent, null, 2);
    return `
You are suggesting fields for a NEW variant (color/size option) of an existing product. Parent item data (JSON):
${json}

You are also given one or more product images (main image first). Use OCR and visual cues to identify the distinguishing trait (color, size, volume, etc.) for this variant.

Rules:
- This is a variant of the SAME product — not a new listing.
- "name" MUST follow "{parent name} — {distinguishing trait}" using the parent name from the JSON.
- Write "name" and "color" in ${languageLabel}.
- Inherit price and currency from locked_price and locked_currency in the JSON — do NOT invent new values.
- Inherit weight, weight_unit, and dimensions from the parent unless the image clearly shows a different size/volume.
- Suggest a unique "sku" that does not collide with existing_variant_skus in the JSON.
- weightUnit MUST be one of: "g", "kg", "lb", "oz" (lowercase).
- "color" should be the visible color or primary distinguishing visual trait when applicable.
- Only output fields you can justify from the parent data or images; use null for unknowns.

Return ONLY a single JSON object with this exact shape (null allowed):
{
  "name": string | null,
  "color": string | null,
  "sku": string | null,
  "price": number | null,
  "currency": string | null,
  "weight": number | null,
  "weightUnit": "g" | "kg" | "lb" | "oz" | null,
  "dimensions": string | null
}

Do not include any text outside the JSON.`;
  }

  private async runVariantSuggestionCompletion(
    request: ChatCompletionRequest
  ): Promise<VariantSuggestionResult> {
    try {
      const response = await this.bedrockLunaService.chatCompletions(
        request,
        90000,
        { reasoningEffort: 'none', jsonObject: true }
      );
      const rawContent = response.choices?.[0]?.message?.content;
      const contentString = this.messageContentToString(rawContent);
      const jsonString = this.coerceJsonObjectString(contentString);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonString) as Record<string, unknown>;
      } catch (parseError: unknown) {
        this.logger.error(
          'Failed to parse JSON from variant suggestions',
          parseError
        );
        parsed = {};
      }
      return this.mapParsedVariantSuggestion(parsed);
    } catch (error: unknown) {
      return this.logAndDegrade(
        error,
        'Failed to generate variant suggestions',
        {}
      );
    }
  }

  private mapParsedVariantSuggestion(
    parsed: Record<string, unknown>
  ): VariantSuggestionResult {
    const num = (v: unknown): number | null => {
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      if (v != null && v !== '') {
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    };
    return {
      name: this.sanitizeSuggestedProductName(
        typeof parsed.name === 'string' ? parsed.name : undefined
      ),
      color: typeof parsed.color === 'string' ? parsed.color : undefined,
      sku: typeof parsed.sku === 'string' ? parsed.sku : undefined,
      price: num(parsed.price),
      currency: typeof parsed.currency === 'string' ? parsed.currency : undefined,
      weight: num(parsed.weight),
      weightUnit:
        typeof parsed.weightUnit === 'string'
          ? normalizeWeightUnit(parsed.weightUnit) ?? undefined
          : undefined,
      dimensions:
        typeof parsed.dimensions === 'string' ? parsed.dimensions : undefined,
    };
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
- For "name": use only a real product name visible on the image or in the current fields. Never invent placeholders such as "Test product", "Test product API", "Sample product", "Dummy product", or "Product name". If no real name can be determined, set "name" to null (leave blank).
- If a field should stay as-is, repeat the current value or omit if unchanged.
- Only specify dimensions/weight/weightUnit if they are visible on the image.
- weightUnit MUST be one of: "g", "kg", "lb", "oz" (lowercase). Never use "Kg", "KG", "ml", or "l".
- Set isUsed to true only when photos/text clearly indicate used, second-hand, refurbished, open-box, wear, or scratches. Set false only when clearly new/sealed. If uncertain, set isUsed to null (do not guess).

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
  "weightUnit": "g" | "kg" | "lb" | "oz" | null,
  "dimensions": string | null,
  "isFragile": boolean | null,
  "isPerishable": boolean | null,
  "isUsed": boolean | null,
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
      const response = await this.bedrockLunaService.chatCompletions(
        request,
        90000,
        { reasoningEffort: 'none', jsonObject: true }
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
      return this.logAndDegrade(
        error,
        'Failed to generate item refinement suggestions',
        {}
      );
    }
  }

  private finalizeImageItemSuggestion(
    suggestion: ImageItemSuggestionResult,
    merchantFoodFlag?: boolean | null
  ): ImageItemSuggestionResult {
    return isCookedFoodSuggestion(suggestion, merchantFoodFlag)
      ? applyCookedFoodCategories(suggestion)
      : suggestion;
  }

  private buildImageItemVisionSystemPrompt(): string {
    return (
      'You are an AI assistant that reads product photos (OCR, labels, price tags, barcodes) ' +
      'and returns a single JSON object. Do not invent fields you cannot read clearly; use null when uncertain. ' +
      'CRITICAL: Never use placeholder or demo product names (e.g. "Test product", "Test product API", "Sample product", "Dummy product"). ' +
      'If the real product name is not clearly readable on the image, set name to null (leave blank). Prefer null over guessing.'
    );
  }

  private buildImageItemVisionUserText(
    defaultCurrency: string,
    languageLabel: string,
    textContext: string,
    hasMerchantHint = false
  ): string {
    const hintRules = hasMerchantHint
      ? `
Merchant hint rules:
- The merchant hint is authoritative for product *identity* (what the item is called).
- Prefer the hint for the product name when the image is ambiguous.
- Still read visual attributes (size, color, brand marks, price tags) from the images.
- Reconcile conflicts: identity → hint; visual facts → image.
`
      : '';
    return `
Analyze the attached product images in order (first image is primary). Merge information across all photos; use the clearest view of text, barcodes, labels, and price tags.

First, decode any visible barcode(s). If decoded, use it as the strongest signal for identifying the product.
Then extract from the images:
- Product name (only if clearly readable on packaging/labels; otherwise null — never invent a name)
- Category name
- Subcategory name
- Prefer an exact category/subcategory pair from the platform catalog in the text context when one fits. Only invent new category or subcategory names when nothing in the catalog applies.
- Brand name
- A short 2–3 sentence e-commerce description in ${languageLabel}
- The product price as a number (no currency symbol)
- The currency code (3-letter code). If none visible, default to "${defaultCurrency}".
- Any decoded barcode values (EAN/UPC/etc) if readable.
- Product weight as a number (if visible)
- Weight unit: only "g", "kg", "lb", or "oz" (lowercase). Never "Kg", "ml", or "l".
- Shopper-facing size in "dimensions" when a buyer needs it to purchase: clothing/shoe size (e.g. "M", "42"), volume for perfume/lotion/cream/cosmetics (e.g. "50ml", "1.5L"), or L×W×H (e.g. "20x10x5 cm"). Infer from labels, packaging, or the photo. Prefer shopper-facing size over shipping-box measurements when both exist. Use null if unknown.
- isSizeRequired: true when size matters for the purchase decision (clothing, shoes, apparel, perfume, lotion, cream, cosmetics, and similar) — even if dimensions was inferred, so the merchant can confirm. false when size is not purchase-relevant (e.g. a phone charger). null only if truly uncertain.
- Whether the item appears used / pre-owned (not new): set isUsed true only when photos or text clearly show wear, scratches, open packaging, or "used"/"second-hand"/"refurbished"/"open-box" labels. Set false only when clearly new/sealed. If uncertain, set isUsed to null (do not guess).
- isFoodItem: true when the product is a cooked/prepared restaurant dish meant to be eaten soon (plated meal, soup, stew, rice dish, grilled meat, takeaway hot food, local cuisine). false for packaged groceries, beverages, raw ingredients, retail goods, or sealed supermarket products. null only if truly uncertain.
- When isFoodItem is true, set categoryName to "${FOOD_CATEGORY_NAME}" and subCategoryName to "${FOOD_SUB_CATEGORY_NAME}" exactly.
- Up to 3 alternate category names and subcategory names.
- Per-field confidence: "high" | "medium" | "low".

Name rules:
- Use the real commercial product name from the image text when readable.
- Do NOT use placeholders such as "Test product", "Test product API", "Sample product", "Dummy product", "Product name", or similar demo/API test strings.
- If you cannot determine a real name, set "name" to null (leave blank). Prefer null over guessing.
${hintRules}
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
  "weightUnit": "g" | "kg" | "lb" | "oz" | null,
  "dimensions": string | null,
  "isSizeRequired": boolean | null,
  "isUsed": boolean | null,
  "isFoodItem": boolean | null,
  "categoryAlternates": string[] | null,
  "subCategoryAlternates": string[] | null,
  "confidence": {
    "name": "high" | "medium" | "low",
    "categoryName": "high" | "medium" | "low",
    "subCategoryName": "high" | "medium" | "low",
    "brandName": "high" | "medium" | "low",
    "description": "high" | "medium" | "low",
    "price": "high" | "medium" | "low"
  }
}

Do not include any explanation outside of the JSON.
The "description" field MUST be written in ${languageLabel}.`;
  }

  private buildVisionUserContentParts(
    textPrompt: string,
    imageUrlsOrDataUrls: string[]
  ): unknown[] {
    const parts: unknown[] = [{ type: 'text', text: textPrompt }];
    for (const u of imageUrlsOrDataUrls) {
      parts.push({
        type: 'image_url',
        image_url: { url: u, detail: 'high' as const },
      });
    }
    return parts;
  }

  private async fetchImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const { data, headers, status } = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 25000,
        maxContentLength: AiService.IMAGE_FETCH_MAX_BYTES,
        maxBodyLength: AiService.IMAGE_FETCH_MAX_BYTES,
        validateStatus: (s) => s === 200,
      });
      if (status !== 200 || !data) return null;
      const mime =
        headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
      if (!mime.startsWith('image/')) {
        return null;
      }
      const b64 = Buffer.from(data).toString('base64');
      return `data:${mime};base64,${b64}`;
    } catch (e: unknown) {
      this.logger.warn(
        `Vision: could not fetch image (${url.slice(0, 96)}…): ${
          e instanceof Error ? e.message : 'unknown'
        }`
      );
      return null;
    }
  }

  private async resolveVisionImageUrls(urls: string[]): Promise<string[]> {
    const capped = urls.slice(0, AiService.IMAGE_ITEM_VISION_MAX_IMAGES);
    const out: string[] = [];
    for (const u of capped) {
      const dataUrl = await this.fetchImageAsDataUrl(u);
      out.push(dataUrl ?? u);
    }
    return out;
  }

  /** Public wrapper for enhancement confidence VLM self-check (Bedrock). */
  async runChatForConfidence(
    body: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    return this.bedrockLunaService.chatCompletions(
      {
        ...body,
        model: body.model || this.bedrockLunaService.getDefaultChatModel(),
      },
      60000,
      { reasoningEffort: 'none', jsonObject: true }
    );
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
      name: this.sanitizeSuggestedProductName(
        typeof parsed.name === 'string' ? parsed.name : undefined
      ),
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
        typeof parsed.weightUnit === 'string'
          ? normalizeWeightUnit(parsed.weightUnit) ?? undefined
          : undefined,
      dimensions:
        typeof parsed.dimensions === 'string' ? parsed.dimensions : undefined,
      isFragile: bool(parsed.isFragile),
      isPerishable: bool(parsed.isPerishable),
      isUsed: bool(parsed.isUsed),
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
      name:
        this.sanitizeSuggestedProductName(lookup.name) || suggestion.name,
      brandName: lookup.brandName || suggestion.brandName,
      categoryName: lookup.categoryName || suggestion.categoryName,
      subCategoryName: lookup.subCategoryName || suggestion.subCategoryName,
      weight: lookup.weight ?? suggestion.weight,
      weightUnit: lookup.weightUnit ?? suggestion.weightUnit,
      dimensions: lookup.dimensions ?? suggestion.dimensions,
    };
  }

  /** Drop empty or demo/placeholder product names (e.g. Open Food Facts "Test product API"). */
  private sanitizeSuggestedProductName(
    name: string | null | undefined
  ): string | undefined {
    if (typeof name !== 'string') return undefined;
    const trimmed = name.trim();
    if (!trimmed || this.isPlaceholderProductName(trimmed)) return undefined;
    return trimmed;
  }

  private isPlaceholderProductName(name: string): boolean {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return true;
    const exact = new Set([
      'test product',
      'test product api',
      'sample product',
      'dummy product',
      'fake product',
      'demo product',
      'product name',
      'untitled',
      'n/a',
      'na',
      'none',
      'unknown',
      'unknown product',
    ]);
    if (exact.has(normalized)) return true;
    return /^(test|sample|dummy|fake|demo)\s+product(\s+api)?(\s+v?\d+)?$/i.test(
      normalized
    );
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
    try {
      return await this.requestRentalImageSuggestions(
        input.imageUrl,
        textContext,
        defaultCurrency,
        descriptionLanguage
      );
    } catch (error: unknown) {
      return this.logAndDegrade(
        error,
        `Rental image suggestions failed for ${input.imageUrl}`,
        this.fallbackRentalSuggestion(input, defaultCurrency)
      );
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
Look carefully at the image pixels: identify the object type, brand/model text if readable, and condition.
Examples: cordless/electric drill, angle grinder, generator, ladder, tent, camera, car.

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

- name: short title for the rental item (not a full sentence), e.g. "Cordless electric drill". Never use placeholders like "Test product" or "Test product API"; if unclear, set name to null.
- description: 2–4 sentences for renters (condition, typical use, what is included if visible) in ${languageLabel}.
- rentalCategoryName: the best-matching category label in plain English (e.g. "Power tools", "Vehicles", "Event equipment") — a human name, not an id.
- suggestedTags: a few lowercase keywords for search (e.g. ["drill", "cordless", "electric", "power-tool"]).
- currency: 3-letter ISO code for pricing context if inferable; otherwise "${defaultCurrency}".

No markdown, no explanation outside JSON.`;
  }

  private async requestRentalImageSuggestions(
    imageUrl: string,
    textContext: string,
    defaultCurrency: string,
    descriptionLanguage: 'en' | 'fr'
  ): Promise<RentalImageSuggestionResult> {
    const userText = this.buildRentalSuggestionUserPrompt(
      textContext,
      defaultCurrency,
      descriptionLanguage
    );
    const resolvedImages = await this.resolveVisionImageUrls([imageUrl]);
    const visionUserContent = this.buildVisionUserContentParts(
      userText,
      resolvedImages
    );
    const visionRequest: ChatCompletionRequest = {
      model: this.bedrockLunaService.getDefaultChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'You extract structured rental catalog data from images for a rentals marketplace. Use the attached image pixels; do not rely on the URL string alone.',
        },
        { role: 'user', content: visionUserContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    this.logger.log(
      'Generating rental image suggestions (Bedrock vision) for 1 image'
    );
    const response = await this.bedrockLunaService.chatCompletions(
      visionRequest,
      120000,
      { reasoningEffort: 'none', jsonObject: true }
    );
    const rawContent = response.choices?.[0]?.message?.content;
    const contentString = this.messageContentToString(rawContent);
    const jsonString = this.coerceJsonObjectString(contentString);
    return this.parseRentalSuggestionJson(jsonString, defaultCurrency);
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
      name: this.sanitizeSuggestedProductName(
        typeof parsed.name === 'string' ? parsed.name : undefined
      ),
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

  private logAndDegrade<T>(
    error: unknown,
    message: string,
    fallback: T
  ): T {
    this.logger.error(message, error);
    return fallback;
  }

  private resolvePreferredLanguage(
    preferredLanguage?: string | null
  ): 'en' | 'fr' {
    const normalized = preferredLanguage?.trim().toLowerCase();
    return normalized?.startsWith('fr') ? 'fr' : 'en';
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
        weightUnit = normalizeWeightUnit(qtyMatch[2]);
        if (!weightUnit) weight = null;
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

  async generateCollectionSuggestions(input: {
    itemName: string;
    description?: string;
    subCategoryName?: string;
    categoryName?: string;
    brandName?: string;
    imageUrls?: string[];
    availableCollections: Array<{
      id: string;
      slug: string;
      name_en: string;
      name_fr: string;
    }>;
  }): Promise<
    Array<{
      collectionId: string;
      slug: string;
      name_en: string;
      name_fr: string;
      reason?: string;
    }>
  > {
    if (!input.availableCollections.length) return [];
    const catalogJson = JSON.stringify(
      input.availableCollections.map((c) => ({
        id: c.id,
        slug: c.slug,
        name_en: c.name_en,
        name_fr: c.name_fr,
      }))
    );
    const userText = `
Product:
- name: ${input.itemName}
- description: ${input.description ?? ''}
- category: ${input.categoryName ?? ''}
- subcategory: ${input.subCategoryName ?? ''}
- brand: ${input.brandName ?? ''}

Platform collections (pick only from this list, max 5):
${catalogJson}

Return ONLY JSON: { "suggestions": [ { "collectionId": "uuid", "reason": "short" } ] }
Use collectionId values exactly from the list.`;
    const imageUrlsText = input.imageUrls?.length
      ? `\nImages:\n${input.imageUrls.map((u) => `- ${u}`).join('\n')}`
      : '';
    const request: ChatCompletionRequest = {
      model: this.bedrockLunaService.getDefaultChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'You assign e-commerce products to curated shopping collections. Only use collection IDs from the provided list.',
        },
        { role: 'user', content: `${userText}${imageUrlsText}` },
      ],
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    };
    try {
      const response = await this.bedrockLunaService.chatCompletions(
        request,
        60000,
        { reasoningEffort: 'none', jsonObject: true }
      );
      const rawContent = response.choices?.[0]?.message?.content;
      const contentString = this.messageContentToString(rawContent);
      const jsonString = this.coerceJsonObjectString(contentString);
      const parsed = JSON.parse(jsonString) as {
        suggestions?: Array<{ collectionId?: string; reason?: string }>;
      };
      const byId = new Map(
        input.availableCollections.map((c) => [c.id, c] as const)
      );
      const out: Array<{
        collectionId: string;
        slug: string;
        name_en: string;
        name_fr: string;
        reason?: string;
      }> = [];
      for (const s of parsed.suggestions ?? []) {
        const id = s.collectionId;
        if (!id || !byId.has(id)) continue;
        const c = byId.get(id)!;
        out.push({
          collectionId: c.id,
          slug: c.slug,
          name_en: c.name_en,
          name_fr: c.name_fr,
          reason: s.reason,
        });
      }
      return out.slice(0, 5);
    } catch (error: unknown) {
      this.logger.warn('Collection AI suggestions failed', error);
      return [];
    }
  }
}
