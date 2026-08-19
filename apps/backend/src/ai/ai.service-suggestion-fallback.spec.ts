import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { AiService } from './ai.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiService suggestion fallbacks', () => {
  beforeEach(() => {
    mockedAxios.get.mockRejectedValue(new Error('skip fetch'));
  });

  function makeService() {
    const bedrockLunaService = {
      getDefaultChatModel: () => 'amazon.nova-lite-v1:0',
      chatCompletions: jest.fn(),
    };
    const service = new AiService({ get: jest.fn() } as any, bedrockLunaService as any);
    return { service, bedrockLunaService };
  }

  const unavailable = new HttpException(
    'AI temporarily unavailable. Please try again.',
    HttpStatus.SERVICE_UNAVAILABLE
  );

  it('returns empty image suggestions when Bedrock is unavailable', async () => {
    const { service, bedrockLunaService } = makeService();
    bedrockLunaService.chatCompletions.mockRejectedValue(unavailable);

    const result = await service.generateImageItemSuggestions({
      imageUrls: ['https://uploads.example/item.jpg'],
      defaultCurrency: 'XAF',
    });

    expect(result.price).toBeNull();
    expect(result.currency).toBe('XAF');
    expect(result.name).toBeUndefined();
  });

  it('returns empty refinement suggestions when Bedrock is unavailable', async () => {
    const { service, bedrockLunaService } = makeService();
    bedrockLunaService.chatCompletions.mockRejectedValue(unavailable);

    const result = await service.generateItemRefinementSuggestions({
      itemSnapshot: { name: 'Coffee' },
      imageUrls: ['https://uploads.example/item.jpg'],
    });

    expect(result).toEqual({});
  });

  it('returns rental fallback fields when Bedrock is unavailable', async () => {
    const { service, bedrockLunaService } = makeService();
    bedrockLunaService.chatCompletions.mockRejectedValue(unavailable);

    const result = await service.generateRentalImageSuggestions({
      imageUrl: 'https://uploads.example/drill.jpg',
      caption: 'Cordless drill',
      defaultCurrency: 'XAF',
    });

    expect(result).toEqual({
      name: 'Cordless drill',
      description: undefined,
      rentalCategoryName: undefined,
      suggestedTags: undefined,
      currency: 'XAF',
    });
  });
});
