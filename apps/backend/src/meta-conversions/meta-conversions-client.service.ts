import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  Configuration,
  MetaConversionsConfig,
} from '../config/configuration';

export type MetaGraphEventPayload = {
  data: Array<Record<string, unknown>>;
  test_event_code?: string;
};

@Injectable()
export class MetaConversionsClientService {
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const cfg = this.config;
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${cfg.apiVersion}`,
      timeout: 10000,
    });
  }

  private get config(): MetaConversionsConfig {
    return this.configService.get<MetaConversionsConfig>(
      'metaConversions'
    ) as MetaConversionsConfig;
  }

  isConfigured(): boolean {
    return (
      this.config.enabled &&
      !!this.config.pixelId?.trim() &&
      !!this.config.accessToken?.trim()
    );
  }

  async sendEvents(payload: MetaGraphEventPayload): Promise<void> {
    const { pixelId, accessToken } = this.config;
    await this.http.post(`/${pixelId}/events`, payload, {
      params: { access_token: accessToken },
    });
  }

  getTestEventCode(): string {
    return this.config.testEventCode?.trim() || '';
  }
}
