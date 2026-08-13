import {
  extractOutputText,
  mapChatMessagesToResponses,
  stripCodeFences,
} from './bedrock-responses.mapper';

describe('bedrock-responses.mapper', () => {
  it('maps system + user text to instructions and input', () => {
    const body = mapChatMessagesToResponses({
      model: 'openai.gpt-5.6-luna',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
      maxTokens: 100,
      temperature: 0,
      jsonObject: true,
      reasoningEffort: 'none',
    });
    expect(body.model).toBe('openai.gpt-5.6-luna');
    expect(body.instructions).toBe('You are helpful.');
    expect(body.max_output_tokens).toBe(100);
    expect(body.temperature).toBe(0);
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.text).toEqual({ format: { type: 'json_object' } });
    expect(body.input).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('maps multimodal image_url parts to input_image', () => {
    const body = mapChatMessagesToResponses({
      model: 'openai.gpt-5.6-terra',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/a.jpg', detail: 'high' },
            },
          ],
        },
      ],
    });
    expect(body.model).toBe('openai.gpt-5.6-terra');
    expect(body.input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Describe' },
          { type: 'input_image', image_url: 'https://example.com/a.jpg' },
        ],
      },
    ]);
  });

  it('extracts output_text and strips fences', () => {
    expect(extractOutputText({ output_text: '```json\n{"a":1}\n```' })).toBe(
      '{"a":1}'
    );
    expect(
      extractOutputText({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'hi' }],
          },
        ],
      })
    ).toBe('hi');
    expect(stripCodeFences('plain')).toBe('plain');
  });
});
