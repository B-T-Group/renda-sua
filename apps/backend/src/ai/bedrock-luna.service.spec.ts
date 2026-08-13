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
        if (key === 'bedrock') {
          return {
            region: config.region,
            chatModel: config.chatModel,
          };
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
    expect(service.getResponsesBaseUrl()).toBe(
      'https://bedrock-mantle.us-east-1.api.aws/openai/v1'
    );
  });

  it('uses BEDROCK_REGION when set', () => {
    const service = makeService({ region: 'us-west-2' });
    expect(service.getRegion()).toBe('us-west-2');
    expect(service.getResponsesBaseUrl()).toContain(
      'bedrock-mantle.us-west-2.api.aws'
    );
  });

  it('resolves model from config override then default', () => {
    const service = makeService({
      chatModel: 'openai.gpt-5.6-luna',
    });
    expect(service.resolveModel(undefined)).toBe('openai.gpt-5.6-luna');
    expect(service.resolveModel('openai.gpt-5.6-terra')).toBe(
      'openai.gpt-5.6-terra'
    );
    expect(service.getDefaultChatModel()).toBe('openai.gpt-5.6-luna');
  });
});
