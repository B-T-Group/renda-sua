import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AcceptAiProposalDto } from './dto/item-ai-review.dto';
import { ItemAiProposalService } from './item-ai-proposal.service';

@ApiTags('business-items')
@ApiBearerAuth()
@Controller('business-items/items')
export class ItemAiProposalController {
  constructor(private readonly proposalService: ItemAiProposalService) {}

  @Get(':itemId/ai-proposal')
  @ApiOperation({ summary: 'Get current AI proposal for a sale item' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Proposal payload' })
  async getProposal(@Param('itemId') itemId: string) {
    const data = await this.proposalService.getProposal(itemId);
    return { success: true, ...data };
  }

  @Post(':itemId/ai-proposal/accept')
  @ApiOperation({
    summary:
      'Approve & publish the item. Each AI suggestion can be applied or skipped via applyTitle/applyDescription (set both to false to publish unchanged).',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: AcceptAiProposalDto })
  async acceptProposal(
    @Param('itemId') itemId: string,
    @Body() body: AcceptAiProposalDto
  ) {
    return this.proposalService.acceptProposal(itemId, body ?? {});
  }

  @Post(':itemId/ai-proposal/decline')
  @ApiOperation({
    summary: 'Decline AI proposal and resubmit item for another review',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  async declineProposal(@Param('itemId') itemId: string) {
    return this.proposalService.declineProposal(itemId);
  }
}
