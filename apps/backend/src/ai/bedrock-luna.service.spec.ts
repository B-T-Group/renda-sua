import { HttpException, HttpStatus } from '@nestjs/common';
import { BedrockLunaService } from './bedrock-luna.service';

describe('BedrockLunaService region and model config', () => {
  function makeService(config: Record<string, unknown>) {
    const configService = {
      get: (key: string) => {
        if (key === 'bedrock.region') return config.region;
        if (key === 'bedrock.chatModel') return config.chatModel;
        if (key === 'aws') {
          return { accessKeyId: 'AKIA', secretAccessKey: 'SECRET' };
        }
        return undefined;
      },
    } as any;
    return new BedrockLunaService(configService);
  }

  it('defaults region to us-east-1 and never uses ca-central-1 from AWS_REGION', () => {
    process.env.AWS_REGION = 'ca-central-1';
    const service = makeService({});
    expect(service.getRegion()).toBe('us-east-1');
  });

  it('uses BEDROCK_REGION when set', () => {
    const service = makeService({ region: 'us-west-2' });
    expect(service.getRegion()).toBe('us-west-2');
  });

  it('defaults chat model to Nova Lite', () => {
    const service = makeService({});
    expect(service.getDefaultChatModel()).toBe('amazon.nova-lite-v1:0');
    expect(service.resolveModel('amazon.nova-pro-v1:0')).toBe(
      'amazon.nova-pro-v1:0'
    );
  });
});

describe('BedrockLunaService error mapping', () => {
  function makeService() {
    const configService = {
      get: (key: string) => {
        if (key === 'aws') {
          return { accessKeyId: 'AKIA', secretAccessKey: 'SECRET' };
        }
        return undefined;
      },
    } as any;
    return new BedrockLunaService(configService);
  }

  function awsError(name: string, httpStatusCode: number) {
    const error: any = new Error('synthetic bedrock denial');
    error.name = name;
    error.$metadata = { httpStatusCode };
    return error;
  }

  async function completeWithSendError(error: unknown) {
    const service = makeService();
    (service as any).client = {
      send: jest.fn().mockRejectedValue(error),
    };
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);
    return service.complete({
      messages: [{ role: 'user', content: 'hello' }],
    });
  }

  it('maps 403 AccessDenied to 503 and keeps the AWS error as cause', async () => {
    const denied = awsError('AccessDeniedException', 403);
    await expect(completeWithSendError(denied)).rejects.toBeInstanceOf(
      HttpException
    );
    try {
      await completeWithSendError(denied);
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.message).toBe(
        'AI temporarily unavailable. Please try again later.'
      );
      expect(error.cause).toBe(denied);
    }
  });

  it('maps throttling to 429', async () => {
    const throttled = awsError('ThrottlingException', 429);
    try {
      await completeWithSendError(throttled);
      fail('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.cause).toBe(throttled);
    }
  });
});
