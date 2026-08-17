import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { AiService } from './ai.service';
import { BedrockLunaService } from './bedrock-luna.service';

jest.mock('axios');

describe('AiService image item suggestions', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  function makeService(chatCompletions: jest.Mock) {
    const configService = { get: jest.fn() } as any;
    const bedrock = {
      getDefaultChatModel: () => 'amazon.nova-lite-v1:0',
      chatCompletions,
    } as unknown as BedrockLunaService;
    return new AiService(configService, bedrock);
  }

  beforeEach(() => {
    mockedAxios.get.mockRejectedValue(new Error('skip image download'));
  });

  it('returns empty suggestions when Bedrock maps 403 to 503', async () => {
    const chatCompletions = jest.fn().mockRejectedValue(
      new HttpException(
        'AI temporarily unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE
      )
    );
    const service = makeService(chatCompletions);

    const result = await service.generateImageItemSuggestions({
      imageUrls: ['https://example.test/product.jpg'],
      hint: 'Blue kettle',
      defaultCurrency: 'XAF',
    });

    expect(chatCompletions).toHaveBeenCalled();
    expect(result.name).toBe('Blue kettle');
    expect(result.description).toBeUndefined();
    expect(result.categoryName).toBeUndefined();
    expect(result.currency).toBe('XAF');
  });

  it('returns a fallback rental suggestion when Bedrock is unavailable', async () => {
    const chatCompletions = jest.fn().mockRejectedValue(
      new HttpException(
        'AI temporarily unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE
      )
    );
    const service = makeService(chatCompletions);

    const result = await service.generateRentalImageSuggestions({
      imageUrl: 'https://example.test/drill.jpg',
      caption: 'Cordless drill',
      defaultCurrency: 'XAF',
    });

    expect(result.name).toBe('Cordless drill');
    expect(result.description).toBeUndefined();
    expect(result.currency).toBe('XAF');
  });
});
