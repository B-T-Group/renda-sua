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
