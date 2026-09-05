import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryEstimateController } from './delivery-estimate.controller';
import { DeliveryEstimateService } from './delivery-estimate.service';
import type { DeliveryEstimateResponse } from './dto/delivery-estimate-response.dto';

describe('DeliveryEstimateController', () => {
  let controller: DeliveryEstimateController;
  let service: jest.Mocked<DeliveryEstimateService>;

  const mockEstimate: DeliveryEstimateResponse = {
    areaLabel: 'Cameroon · Littoral',
    needsFinerArea: false,
    window: {
      label: 'Usually arrives',
      band: '24–48 hours',
      start: null,
      end: null,
    },
    fee: {
      currency: 'XAF',
      min: 500,
      max: 1200,
      exact: null,
      confidence: 'range',
    },
    servingStatus: null,
    coverage: 'in',
    trustVariant: 'map_and_pin',
  };

  beforeEach(async () => {
    const mockService = {
      getEstimate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryEstimateController],
      providers: [
        { provide: DeliveryEstimateService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<DeliveryEstimateController>(
      DeliveryEstimateController
    );
    service = module.get(DeliveryEstimateService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDeliveryEstimate', () => {
    it('should return delivery estimate', async () => {
      service.getEstimate.mockResolvedValue(mockEstimate);

      const result = await controller.getDeliveryEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
      });

      expect(result).toEqual(mockEstimate);
      expect(service.getEstimate).toHaveBeenCalledWith({
        marketId: 'CM',
        areaId: 'Littoral',
        category: undefined,
        sellerId: undefined,
        skuId: undefined,
        qty: undefined,
      });
    });

    it('should pass all query parameters to service', async () => {
      service.getEstimate.mockResolvedValue(mockEstimate);

      await controller.getDeliveryEstimate({
        marketId: 'CM',
        areaId: 'Littoral',
        category: 'Electronics',
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
        skuId: '123e4567-e89b-12d3-a456-426614174001',
        qty: 2,
      });

      expect(service.getEstimate).toHaveBeenCalledWith({
        marketId: 'CM',
        areaId: 'Littoral',
        category: 'Electronics',
        sellerId: '123e4567-e89b-12d3-a456-426614174000',
        skuId: '123e4567-e89b-12d3-a456-426614174001',
        qty: 2,
      });
    });

    it('should throw NOT_FOUND for market not found error', async () => {
      service.getEstimate.mockRejectedValue(new Error('Market not found: XX'));

      await expect(
        controller.getDeliveryEstimate({ marketId: 'XX' })
      ).rejects.toThrow(
        new HttpException('Market not found: XX', HttpStatus.NOT_FOUND)
      );
    });

    it('should throw INTERNAL_SERVER_ERROR for other errors', async () => {
      service.getEstimate.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.getDeliveryEstimate({ marketId: 'CM' })
      ).rejects.toThrow(
        new HttpException('Database error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });

    it('should rethrow HttpException as-is', async () => {
      const httpException = new HttpException(
        'Custom error',
        HttpStatus.BAD_REQUEST
      );
      service.getEstimate.mockRejectedValue(httpException);

      await expect(
        controller.getDeliveryEstimate({ marketId: 'CM' })
      ).rejects.toThrow(httpException);
    });

    it('should handle missing error message gracefully', async () => {
      service.getEstimate.mockRejectedValue(new Error());

      await expect(
        controller.getDeliveryEstimate({ marketId: 'CM' })
      ).rejects.toThrow(
        new HttpException(
          'Failed to get delivery estimate',
          HttpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });
});
