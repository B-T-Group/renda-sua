import {
  inboxAttachmentPreview,
  inboxButtonReplyFromPayload,
  inboxDisplayMessage,
  inboxMediaFromPayload,
  mediaContentDisposition,
} from './whatsapp-inbox-media.util';

describe('whatsapp-inbox-media.util', () => {
  it('reads image id, mime, and caption from the webhook payload', () => {
    expect(
      inboxMediaFromPayload('image', {
        type: 'image',
        image: {
          id: 'media-1',
          mime_type: 'image/jpeg',
          caption: 'Front of the store',
        },
      })
    ).toEqual({
      id: 'media-1',
      mimeType: 'image/jpeg',
      filename: null,
      caption: 'Front of the store',
      latitude: null,
      longitude: null,
    });
  });

  it('reads document filename and sticker id on unknown type', () => {
    expect(
      inboxMediaFromPayload('document', {
        document: { id: 'doc-1', filename: 'invoice.pdf', mime_type: 'application/pdf' },
      })?.filename
    ).toBe('invoice.pdf');
    expect(
      inboxMediaFromPayload('unknown', { sticker: { id: 'sticker-1' } })?.id
    ).toBe('sticker-1');
  });

  it('prefers caption then filename for list preview', () => {
    expect(
      inboxAttachmentPreview('image', { image: { id: 'm', caption: 'Look' } })
    ).toBe('Look');
    expect(
      inboxAttachmentPreview('document', { document: { id: 'd', filename: 'a.pdf' } })
    ).toBe('a.pdf');
    expect(inboxAttachmentPreview('image', { image: { id: 'm' } })).toBe(
      '[Image]'
    );
    expect(inboxAttachmentPreview('unknown', { sticker: { id: 's' } })).toBe(
      '[Sticker]'
    );
  });

  it('parses location name and coordinates', () => {
    const media = inboxMediaFromPayload('location', {
      location: { latitude: 4.05, longitude: 9.7, name: 'Douala' },
    });
    expect(media).toMatchObject({
      caption: 'Douala',
      latitude: 4.05,
      longitude: 9.7,
      id: null,
    });
  });

  it('sanitizes content-disposition filenames', () => {
    expect(mediaContentDisposition('a"b\nc.pdf')).toBe(
      'inline; filename="a_b_c.pdf"'
    );
    expect(mediaContentDisposition(null)).toBeNull();
  });

  it('reads template quick-reply button taps as Confirmer', () => {
    const raw = {
      type: 'button',
      button: { text: 'Confirmer', payload: 'Confirmer' },
    };
    expect(inboxButtonReplyFromPayload(raw)).toEqual({
      buttonId: 'Confirmer',
      buttonTitle: 'Confirmer',
      preview: 'Confirmer',
    });
    expect(inboxAttachmentPreview('unknown', raw)).toBe('Confirmer');
    expect(inboxDisplayMessage('unknown', '[unknown]', raw)).toEqual({
      type: 'text',
      body: 'Confirmer',
    });
  });
});
