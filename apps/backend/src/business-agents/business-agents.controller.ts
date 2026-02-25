import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessAdminGuard } from '../admin/business-admin.guard';

export interface SetAgentInternalDto {
  internal: boolean;
}

@Controller('business/agents')
@UseGuards(BusinessAdminGuard)
export class BusinessAgentsController {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  @Patch(':agentId/internal')
  async setAgentInternal(
    @Param('agentId') agentId: string,
    @Body() body: SetAgentInternalDto
  ) {
    const { internal } = body;
    if (typeof internal !== 'boolean') {
      throw new HttpException(
        { message: 'Body must include internal (boolean)' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (internal) {
      const agentQuery = `
        query GetAgentById($id: uuid!) {
          agents_by_pk(id: $id) {
            id
            is_verified
          }
        }
      `;
      const agentResult = await this.hasuraSystemService.executeQuery(
        agentQuery,
        { id: agentId }
      );
      const agent = agentResult.agents_by_pk;
      if (!agent) {
        throw new HttpException(
          { message: 'Agent not found' },
          HttpStatus.NOT_FOUND
        );
      }
      if (!agent.is_verified) {
        throw new HttpException(
          {
            message:
              'Agent must be verified before being set as internal',
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const mutation = `
      mutation UpdateAgentInternal($id: uuid!, $is_internal: Boolean!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _set: { is_internal: $is_internal }
        ) {
          id
          is_internal
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(mutation, {
      id: agentId,
      is_internal: internal,
    });

    if (!result.update_agents_by_pk) {
      throw new HttpException(
        { message: 'Agent not found' },
        HttpStatus.NOT_FOUND
      );
    }

    return {
      success: true,
      agent: result.update_agents_by_pk,
      message: internal
        ? 'Agent set as internal'
        : 'Agent set as non-internal',
    };
  }
}
