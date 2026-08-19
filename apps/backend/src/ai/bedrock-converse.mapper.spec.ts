import axios from 'axios';
import sharp from 'sharp';
import {
  extractConverseOutputText,
  mapChatMessagesToConverse,
  stripCodeFences,
} from './bedrock-converse.mapper';
import { BEDROCK_CONVERSE_MAX_IMAGE_BYTES } from './bedrock-converse-image';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('bedrock-converse.mapper', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

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

  it('includes fetched http images', async () => {
    mockedAxios.get.mockResolvedValue({
      data: Buffer.from('jpeg-bytes'),
      headers: { 'content-type': 'image/jpeg' },
    });
    const mapped = await mapChatMessagesToConverse([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Verify this ID' },
          {
            type: 'image_url',
            image_url: { url: 'https://uploads.example/id.jpg' },
          },
        ],
      },
    ]);
    const imagePart = mapped.messages[0].content[1] as {
      image: { format: string; source: { bytes: Uint8Array } };
    };
    expect(imagePart.image.format).toBe('jpeg');
    expect(Buffer.from(imagePart.image.source.bytes).toString()).toBe(
      'jpeg-bytes'
    );
  });

  it('fails closed when an http image cannot be fetched', async () => {
    mockedAxios.get.mockRejectedValue(new Error('maxContentLength exceeded'));
    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Verify this ID' },
            {
              type: 'image_url',
              image_url: { url: 'https://uploads.example/id.jpg' },
            },
          ],
        },
      ])
    ).rejects.toThrow(/Failed to load vision image/);
  });

  it('fails closed when an image_url part has no URL', async () => {
    await expect(
      mapChatMessagesToConverse([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Verify this ID' },
            { type: 'image_url', image_url: { url: '' } },
          ],
        },
      ])
    ).rejects.toThrow(/missing an image URL/);
  });

  it('compresses oversized http images before Converse', async () => {
    const raw = Buffer.alloc(2400 * 2400 * 3);
    for (let i = 0; i < raw.length; i++) {
      raw[i] = (i * 31 + 17) % 256;
    }
    const oversized = await sharp(raw, {
      raw: { width: 2400, height: 2400, channels: 3 },
    })
      .jpeg({ quality: 92 })
      .toBuffer();
    expect(oversized.byteLength).toBeGreaterThan(BEDROCK_CONVERSE_MAX_IMAGE_BYTES);
    mockedAxios.get.mockResolvedValue({
      data: oversized,
      headers: { 'content-type': 'image/jpeg' },
    });

    const mapped = await mapChatMessagesToConverse([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe' },
          {
            type: 'image_url',
            image_url: { url: 'https://uploads.example/big.jpg' },
          },
        ],
      },
    ]);
    const imagePart = mapped.messages[0].content[1] as {
      image: { format: string; source: { bytes: Uint8Array } };
    };
    expect(imagePart.image.format).toBe('jpeg');
    expect(imagePart.image.source.bytes.byteLength).toBeLessThanOrEqual(
      BEDROCK_CONVERSE_MAX_IMAGE_BYTES
    );
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
