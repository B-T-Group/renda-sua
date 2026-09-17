import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { PdfService } from './pdf.service';
import { PDF_UNAVAILABLE_MESSAGE } from './pdf-endpoint-error.util';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
  };
});

describe('PdfService PDFEndpoint errors', () => {
  const config = {
    get: jest.fn(() => ({ apiToken: 'test-token', sandbox: true })),
  };
  const service = new PdfService(config as never, {} as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({ apiToken: 'test-token', sandbox: true });
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 403',
      response: { status: 403, data: { error: 'Forbidden' } },
    });
  });

  it('maps convertHtmlToPdf 403 to 503 HttpException', async () => {
    try {
      await (service as any).convertHtmlToPdf('<p>agreement</p>');
      throw new Error('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.message).toBe(PDF_UNAVAILABLE_MESSAGE);
      expect(axios.isAxiosError(error)).toBe(false);
    }
  });
});
