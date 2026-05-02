import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateItemVariantDto } from './dto/create-item-variant.dto';
import { ItemVariantsService } from './item-variants.service';

@ApiTags('item-variants')
@Controller('business-items/items')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BusinessItemsItemVariantsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly itemVariantsService: ItemVariantsService
  ) {}

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return businessId;
  }

  @Get(':itemId/variants')
  @ApiOperation({ summary: 'List variants for a catalog item' })
  @ApiResponse({ status: 200, description: 'Variants returned' })
  @ApiResponse({ status: 403, description: 'No business' })
  async listVariants(@Param('itemId') itemId: string) {
    const businessId = await this.requireBusinessId();
    const variants = await this.itemVariantsService.listVariantsForItem(
      businessId,
      itemId
    );
    return { success: true, data: variants };
  }

  @Post(':itemId/variants')
  @ApiOperation({ summary: 'Create a variant for a catalog item' })
  @ApiResponse({ status: 201, description: 'Variant created' })
  async createVariant(
    @Param('itemId') itemId: string,
    @Body() dto: CreateItemVariantDto
  ) {
    const businessId = await this.requireBusinessId();
    const data = await this.itemVariantsService.createVariant(
      businessId,
      itemId,
      dto
    );
    return { success: true, data };
  }
}
