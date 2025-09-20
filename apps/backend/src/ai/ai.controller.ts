import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AiService } from './ai.service';
import { GenerateDescriptionDto } from './dto/generate-description.dto';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-description')
  @ApiOperation({
    summary: 'Generate AI-powered product description',
    description:
      'Generate a compelling product description using OpenAI GPT-3.5-turbo based on product details',
  })
  @ApiBody({
    type: GenerateDescriptionDto,
    description: 'Product details for description generation',
  })
  @ApiResponse({
    status: 200,
    description: 'Product description generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        description: {
          type: 'string',
          example:
            'Experience premium sound quality with our wireless Bluetooth headphones. Featuring advanced noise cancellation and 30-hour battery life, these headphones deliver exceptional audio performance for both work and leisure.',
        },
        message: {
          type: 'string',
          example: 'Product description generated successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Validation failed' },
        error: { type: 'string', example: 'Invalid input data' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key or authentication required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - OpenAI API rate limit exceeded',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to generate description',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Failed to generate product description',
        },
        error: { type: 'string', example: 'OpenAI API error' },
      },
    },
  })
  async generateProductDescription(@Body() dto: GenerateDescriptionDto) {
    try {
      const result = await this.aiService.generateProductDescription(dto);

      return {
        success: result.success,
        description: result.description,
        message: result.message,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
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
}
