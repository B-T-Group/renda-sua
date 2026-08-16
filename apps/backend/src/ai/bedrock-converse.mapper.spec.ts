import axios from 'axios';
import {
  extractConverseOutputText,
  mapChatMessagesToConverse,
  stripCodeFences,
} from './bedrock-converse.mapper';

describe('bedrock-converse.mapper', () => {
  it('maps system + user text and JSON instruction', async () => {
    const mapped = await mapChatMessagesToConverse(
      [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
      { jsonObject: true }
    );
    expect(mapped.system?.[0]?.text).toContain('You are helpful.');
    expect(mapped.system?.[0]?.text).toContain('JSON object');
    expect(mapped.messages).toEqual([
      { role: 'user', content: [{ text: 'Hello' }] },
    ]);
  });

  it('maps data-url images to Converse image blocks', async () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const mapped = await mapChatMessagesToConverse([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${png}` },
          },
        ],
      },
    ]);
    expect(mapped.messages[0].content[0]).toEqual({ text: 'What is this?' });
    const imagePart = mapped.messages[0].content[1] as {
      image: { format: string; source: { bytes: Uint8Array } };
    };
    expect(imagePart.image.format).toBe('png');
    expect(imagePart.image.source.bytes.byteLength).toBeGreaterThan(0);
  });

  it('fails closed when a provided image URL is missing', async () => {
    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: {} }],
        },
      ])
    ).rejects.toThrow('Vision request is missing an image URL');
  });

  it('fails closed when a data-URL image cannot be parsed', async () => {
    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:text/plain;base64,xxxx' },
            },
          ],
        },
      ])
    ).rejects.toThrow('Vision request has an invalid data-URL image');
  });

  it('fails closed for unsupported image URL schemes', async () => {
    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'javascript:alert(1)' } },
          ],
        },
      ])
    ).rejects.toThrow('Vision request image URL must be http(s) or a data URL');
  });

  it('fails closed when an HTTP image cannot be loaded', async () => {
    const get = jest
      .spyOn(axios, 'get')
      .mockRejectedValue(new Error('ENOTFOUND'));

    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'https://cdn.example/item.png' },
            },
          ],
        },
      ])
    ).rejects.toThrow('Failed to load vision image');
    get.mockRestore();
  });

  it('fails closed when an HTTP image body is empty', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      data: new ArrayBuffer(0),
      headers: { 'content-type': 'image/png' },
    } as never);

    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'https://cdn.example/item.png' },
            },
          ],
        },
      ])
    ).rejects.toThrow('Failed to load vision image');
    get.mockRestore();
  });

  it('extracts text from Converse output', () => {
    expect(
      extractConverseOutputText({
        message: { content: [{ text: '  {"ok":true}  ' }] },
      })
    ).toBe('{"ok":true}');
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
