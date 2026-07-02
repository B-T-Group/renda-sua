import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface StartVerificationResponse {
  account_sid: string;
  service_sid: string;
  sid: string;
  status: string;
  to: string;
  valid: boolean;
  channel: string;
  date_created: string;
  date_updated: string;
  send_code_attempts: Array<{
    attempt_sid: string;
    channel: string;
    time: string;
  }>;
}

export interface VerifyCodeResponse {
  account_sid: string;
  service_sid: string;
  sid: string;
  status: string;
  to: string;
  valid: boolean;
  channel: string;
  date_created: string;
  date_updated: string;
}

@Injectable()
export class TwilioVerifyService {
  private readonly client: AxiosInstance;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly serviceSid: string;
  private readonly baseUrl = 'https://verify.twilio.com/v2';

  constructor(
    private readonly configService: ConfigService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = this.configService.get<string>('TWILIO_ACCOUNT_TOKEN', '');
    this.serviceSid = this.configService.get<string>(
      'TWILIO_VERIFY_SERVICE_SID',
      ''
    );

    if (!this.accountSid || !this.authToken || !this.serviceSid) {
      throw new Error(
        'Missing required Twilio configuration: TWILIO_ACCOUNT_SID, TWILIO_ACCOUNT_TOKEN, or TWILIO_VERIFY_SERVICE_SID'
      );
    }

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      'base64'
    );

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async startVerification(
    phoneNumber: string,
    channel: 'sms' | 'call' = 'sms'
  ): Promise<StartVerificationResponse> {
    try {
      const response = await this.client.post<StartVerificationResponse>(
        `/Services/${this.serviceSid}/Verifications`,
        new URLSearchParams({
          To: phoneNumber,
          Channel: channel,
        })
      );
      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to start verification';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        error.response?.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  async verifyCode(
    phoneNumber: string,
    code: string,
    userId?: string
  ): Promise<VerifyCodeResponse> {
    try {
      const response = await this.client.post<VerifyCodeResponse>(
        `/Services/${this.serviceSid}/VerificationCheck`,
        new URLSearchParams({
          To: phoneNumber,
          Code: code,
        })
      );

      if (response.data.valid && userId) {
        await this.markPhoneNumberVerified(userId);
      }

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to verify code';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        error.response?.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  private async markPhoneNumberVerified(userId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation MarkPhoneVerified($id: uuid!) {
        update_users_by_pk(
          pk_columns: { id: $id }
          _set: { phone_number_verified: true }
        ) {
          id
          phone_number_verified
        }
      }
    `,
      { id: userId }
    );
  }
}
