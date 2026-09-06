import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { RequestContext } from '../auth/request-context';
import {
  normalizeCountryCode,
  normalizeRecipientPhone,
} from '../diaspora/diaspora-order.util';
import type {
  CreateRecipientDto,
  UpdateRecipientDto,
  RecipientResponseDto,
} from './dto/recipients.dto';

interface UserRecipient {
  id: string;
  user_id: string;
  country: string;
  name: string;
  phone: string;
  notify_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

const RECIPIENT_FIELDS = `
  id
  user_id
  country
  name
  phone
  notify_whatsapp
  created_at
  updated_at
`;

/** Country is only declared when filtered — unused vars fail Hasura validation. */
function buildListRecipientsQuery(hasCountry: boolean): string {
  const countryVar = hasCountry ? ', $country: String!' : '';
  const countryFilter = hasCountry ? 'country: { _eq: $country }' : '';
  return `
    query ListRecipients($userId: uuid!${countryVar}) {
      user_recipients(
        where: {
          user_id: { _eq: $userId }
          ${countryFilter}
        }
        order_by: { created_at: desc }
      ) {
        ${RECIPIENT_FIELDS}
      }
    }
  `;
}

@Injectable()
export class RecipientsService {
  private readonly logger = new Logger(RecipientsService.name);

  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async listRecipients(
    ctx: RequestContext,
    country?: string
  ): Promise<RecipientResponseDto[]> {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId) {
      throw new HttpException(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const normalizedCountry = country
      ? normalizeCountryCode(country)
      : null;

    try {
      const response = await this.hasuraUserService.executeQuery<{
        user_recipients: UserRecipient[];
      }>(
        buildListRecipientsQuery(Boolean(normalizedCountry)),
        {
          userId,
          ...(normalizedCountry ? { country: normalizedCountry } : {}),
        },
        ctx
      );

      return response.user_recipients;
    } catch (error: any) {
      this.logger.error('Failed to list recipients', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to list recipients',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getRecipient(
    ctx: RequestContext,
    id: string
  ): Promise<RecipientResponseDto> {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId) {
      throw new HttpException(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const query = `
      query GetRecipient($id: uuid!, $userId: uuid!) {
        user_recipients(
          where: {
            id: { _eq: $id }
            user_id: { _eq: $userId }
          }
        ) {
          id
          user_id
          country
          name
          phone
          notify_whatsapp
          created_at
          updated_at
        }
      }
    `;

    try {
      const response = await this.hasuraUserService.executeQuery<{
        user_recipients: UserRecipient[];
      }>(query, { id, userId }, ctx);

      if (response.user_recipients.length === 0) {
        throw new HttpException(
          {
            success: false,
            error: 'NOT_FOUND',
            message: 'Recipient not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return response.user_recipients[0];
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      this.logger.error('Failed to get recipient', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get recipient',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async createRecipient(
    ctx: RequestContext,
    dto: CreateRecipientDto
  ): Promise<RecipientResponseDto> {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId) {
      throw new HttpException(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const normalizedCountry = normalizeCountryCode(dto.country);
    if (!normalizedCountry) {
      throw new HttpException(
        {
          success: false,
          error: 'INVALID_COUNTRY',
          message: 'Invalid country code',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const normalizedPhone = normalizeRecipientPhone(
      dto.phone,
      normalizedCountry
    );
    if (!normalizedPhone) {
      throw new HttpException(
        {
          success: false,
          error: 'INVALID_PHONE',
          message: `Phone number is not valid for country ${normalizedCountry}`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const mutation = `
      mutation CreateRecipient(
        $userId: uuid!
        $country: String!
        $name: String!
        $phone: String!
        $notifyWhatsapp: Boolean!
      ) {
        insert_user_recipients_one(
          object: {
            user_id: $userId
            country: $country
            name: $name
            phone: $phone
            notify_whatsapp: $notifyWhatsapp
          }
        ) {
          id
          user_id
          country
          name
          phone
          notify_whatsapp
          created_at
          updated_at
        }
      }
    `;

    try {
      const response = await this.hasuraUserService.executeMutation<{
        insert_user_recipients_one: UserRecipient;
      }>(
        mutation,
        {
          userId,
          country: normalizedCountry,
          name: dto.name.trim(),
          phone: normalizedPhone,
          notifyWhatsapp: dto.notify_whatsapp ?? false,
        },
        ctx
      );

      return response.insert_user_recipients_one;
    } catch (error: any) {
      throw this.toCreateRecipientHttpException(error);
    }
  }

  private isUniqueRecipientConflict(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      message.includes('Uniqueness violation') ||
      message.includes('user_recipients_user_country_phone_key')
    );
  }

  private toCreateRecipientHttpException(error: any): HttpException {
    if (this.isUniqueRecipientConflict(error)) {
      return new HttpException(
        {
          success: false,
          error: 'RECIPIENT_EXISTS',
          message:
            'A recipient with this phone already exists for this country',
        },
        HttpStatus.CONFLICT
      );
    }
    this.logger.error('Failed to create recipient', error);
    return new HttpException(
      {
        success: false,
        message: 'Failed to create recipient',
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  async updateRecipient(
    ctx: RequestContext,
    id: string,
    dto: UpdateRecipientDto
  ): Promise<RecipientResponseDto> {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId) {
      throw new HttpException(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const existing = await this.getRecipient(ctx, id);

    const updates: Record<string, any> = {};
    if (dto.name !== undefined) {
      updates.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      const normalizedPhone = normalizeRecipientPhone(
        dto.phone,
        existing.country
      );
      if (!normalizedPhone) {
        throw new HttpException(
          {
            success: false,
            error: 'INVALID_PHONE',
            message: `Phone number is not valid for country ${existing.country}`,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      updates.phone = normalizedPhone;
    }
    if (dto.notify_whatsapp !== undefined) {
      updates.notify_whatsapp = dto.notify_whatsapp;
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const mutation = `
      mutation UpdateRecipient(
        $id: uuid!
        $userId: uuid!
        $updates: user_recipients_set_input!
      ) {
        update_user_recipients(
          where: {
            id: { _eq: $id }
            user_id: { _eq: $userId }
          }
          _set: $updates
        ) {
          returning {
            id
            user_id
            country
            name
            phone
            notify_whatsapp
            created_at
            updated_at
          }
        }
      }
    `;

    try {
      const response = await this.hasuraUserService.executeMutation<{
        update_user_recipients: { returning: UserRecipient[] };
      }>(
        mutation,
        {
          id,
          userId,
          updates,
        },
        ctx
      );

      if (response.update_user_recipients.returning.length === 0) {
        throw new HttpException(
          {
            success: false,
            error: 'NOT_FOUND',
            message: 'Recipient not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return response.update_user_recipients.returning[0];
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      this.logger.error('Failed to update recipient', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update recipient',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteRecipient(
    ctx: RequestContext,
    id: string
  ): Promise<{ success: boolean }> {
    const userId = this.hasuraUserService.getUserId(ctx);
    if (!userId) {
      throw new HttpException(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.getRecipient(ctx, id);

    const mutation = `
      mutation DeleteRecipient($id: uuid!, $userId: uuid!) {
        delete_user_recipients(
          where: {
            id: { _eq: $id }
            user_id: { _eq: $userId }
          }
        ) {
          affected_rows
        }
      }
    `;

    try {
      const response = await this.hasuraUserService.executeMutation<{
        delete_user_recipients: { affected_rows: number };
      }>(mutation, { id, userId }, ctx);

      if (response.delete_user_recipients.affected_rows === 0) {
        throw new HttpException(
          {
            success: false,
            error: 'NOT_FOUND',
            message: 'Recipient not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return { success: true };
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      this.logger.error('Failed to delete recipient', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete recipient',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
