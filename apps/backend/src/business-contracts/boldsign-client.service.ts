import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { BoldSignConfig, Configuration } from '../config/configuration';

export interface SendFromTemplateParams {
  templateId: string;
  signerName: string;
  signerEmail: string;
  title: string;
  message?: string;
  expirationDays?: number;
  reminderIntervalDays?: number;
}

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
    const body = new URLSearchParams();
    body.set('title', params.title);
    if (params.message) body.set('message', params.message);
    body.set('roles[0][roleIndex]', '1');
    body.set('roles[0][signerName]', params.signerName);
    body.set('roles[0][signerEmail]', params.signerEmail);
    if (params.expirationDays) {
      body.set('expiryDays', String(params.expirationDays));
    }
    if (params.reminderIntervalDays) {
      body.set('reminderSettings[reminderDays]', String(params.reminderIntervalDays));
    }

    const res = await this.http.post(
      `/v1/template/send?templateId=${encodeURIComponent(params.templateId)}`,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

  async remindDocument(documentId: string, message?: string): Promise<void> {
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
  }

  async revokeDocument(documentId: string, message?: string): Promise<void> {
    const body = message ? { message } : {};
    await this.http.post('/v1/document/revoke', body, {
      params: { documentId },
    });
  }
}
