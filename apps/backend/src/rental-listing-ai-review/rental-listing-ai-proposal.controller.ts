import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AcceptAiProposalDto } from './dto/rental-listing-ai-review.dto';
import { RentalListingAiProposalService } from './rental-listing-ai-proposal.service';

@ApiTags('rentals')
@ApiBearerAuth()
@Controller('rentals/business/listings')
export class RentalListingAiProposalController {
  constructor(private readonly proposalService: RentalListingAiProposalService) {}

  @Get(':listingId/ai-proposal')
  @ApiOperation({ summary: 'Get current AI proposal for a listing' })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Proposal payload' })
  async getProposal(@Param('listingId') listingId: string) {
    const data = await this.proposalService.getProposal(listingId);
    return { success: true, ...data };
  }

  @Post(':listingId/ai-proposal/accept')
  @ApiOperation({
    summary: 'Accept AI proposal (optionally with slight title/description edits)',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiBody({ type: AcceptAiProposalDto })
  async acceptProposal(
    @Param('listingId') listingId: string,
    @Body() body: AcceptAiProposalDto
  ) {
    return this.proposalService.acceptProposal(listingId, body ?? {});
  }

  @Post(':listingId/ai-proposal/decline')
  @ApiOperation({
    summary: 'Decline AI proposal and resubmit listing for another review',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  async declineProposal(@Param('listingId') listingId: string) {
    return this.proposalService.declineProposal(listingId);
  }
}
