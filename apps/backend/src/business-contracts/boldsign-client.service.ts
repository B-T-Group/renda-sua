import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { BoldSignConfig, Configuration } from '../config/configuration';
import type { BoldSignExistingFormField } from './boldsign-merchant-form-fields';

export interface SendFromTemplateParams {
  templateId: string;
  signerName: string;
  signerEmail: string;
  title: string;
  message?: string;
  expirationDays?: number;
  reminderIntervalDays?: number;
  existingFormFields?: BoldSignExistingFormField[];
}

export type RemindDocumentResult =
  | { success: true }
  | { success: false; rateLimited: boolean; message: string };

@Injectable()
export class BoldsignClientService {
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const cfg = this.config;
    this.http = axios.create({
      baseURL: cfg.baseUrl,
      timeout: 30000,
      headers: { 'X-API-KEY': cfg.apiKey },
    });
  }

  private get config(): BoldSignConfig {
    return this.configService.get<BoldSignConfig>('boldsign') as BoldSignConfig;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey?.trim();
  }

  async sendUsingTemplate(
    params: SendFromTemplateParams
  ): Promise<{ documentId: string }> {
    const role: Record<string, unknown> = {
      roleIndex: 1,
      signerName: params.signerName,
      signerEmail: params.signerEmail,
    };
    if (params.existingFormFields?.length) {
      role.existingFormFields = params.existingFormFields;
    }

    const body: Record<string, unknown> = {
      title: params.title,
      roles: [role],
    };
    if (params.message) body.message = params.message;
    if (params.expirationDays) body.expiryDays = params.expirationDays;
    if (params.reminderIntervalDays) {
      body.reminderSettings = {
        enableAutoReminder: true,
        reminderDays: params.reminderIntervalDays,
      };
    }

    const res = await this.http.post(
      `/v1/template/send?templateId=${encodeURIComponent(params.templateId)}`,
      body,
      {
        headers: {
          'Content-Type':
            'application/json;odata.metadata=minimal;odata.streaming=true',
        },
      }
    );
    const documentId = res.data?.documentId ?? res.data?.document?.documentId;
    if (!documentId) {
      throw new Error('BoldSign did not return a documentId');
    }
    return { documentId };
  }

  async getDocumentProperties(documentId: string): Promise<Record<string, unknown>> {
    const res = await this.http.get('/v1/document/properties', {
      params: { documentId },
    });
    return res.data ?? {};
  }

  async downloadDocument(documentId: string): Promise<Buffer> {
    const res = await this.http.get('/v1/document/download', {
      params: { documentId },
      responseType: 'arraybuffer',
    });
    return Buffer.from(res.data);
  }

  async downloadAuditTrail(documentId: string): Promise<Buffer> {
    const res = await this.http.get('/v1/document/downloadAuditLog', {
      params: { documentId },
      responseType: 'arraybuffer',
    });
    return Buffer.from(res.data);
  }

  async remindDocument(
    documentId: string,
    message?: string
  ): Promise<RemindDocumentResult> {
    try {
      await this.http.post(
        '/v1/document/remind',
        {
          message:
            message?.trim() ||
            'Please sign your merchant agreement to continue.',
        },
        {
          params: { documentId },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return { success: true };
    } catch (error: any) {
      return this.mapRemindError(error);
    }
  }

  private mapRemindError(error: any): RemindDocumentResult {
    const status = error?.response?.status as number | undefined;
    const message = String(
      error?.response?.data?.error ||
        error?.message ||
        'Failed to send reminder'
    );
    const rateLimited =
      status === 403 &&
      /reminder.*limit|cannot send another reminder/i.test(message);
    return { success: false, rateLimited, message };
  }

  async revokeDocument(documentId: string, message?: string): Promise<void> {
    const body = message ? { message } : {};
    await this.http.post('/v1/document/revoke', body, {
      params: { documentId },
    });
  }
}
