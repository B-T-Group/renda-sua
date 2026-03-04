import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GenerateDescriptionDto } from './dto/generate-description.dto';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly openaiImagesEditsUrl = 'https://api.openai.com/v1/images/edits';

  constructor(private readonly configService: ConfigService) {}

  async generateProductDescription(
    dto: GenerateDescriptionDto
  ): Promise<GenerateDescriptionResponse> {
    try {
      this.logger.log(`Generating description for product: ${dto.name}`);

      const apiKey = this.configService.get<string>('openai.apiKey');
      if (!apiKey) {
        this.logger.error('OpenAI API key not configured');
        throw new HttpException(
          'OpenAI API key not configured',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const prompt = this.buildPrompt(dto);

      const request: OpenAIRequest = {
        model: 'gpt-3.5-turbo',
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

      const response = await axios.post<OpenAIResponse>(
        this.openaiApiUrl,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      const description = response.data.choices?.[0]?.message?.content?.trim();

      if (!description) {
        this.logger.error('No description generated from OpenAI');
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

      // Handle timeout errors
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
}
