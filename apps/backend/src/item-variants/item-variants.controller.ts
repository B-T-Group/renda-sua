import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
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
import { CreateItemVariantImageDto } from './dto/create-item-variant-image.dto';
import { UpdateItemVariantDto } from './dto/update-item-variant.dto';
import { ItemVariantsService } from './item-variants.service';

@ApiTags('item-variants')
@Controller('item-variants')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ItemVariantsController {
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

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set this variant as the default for its item' })
  @ApiResponse({ status: 200, description: 'Default updated' })
  async setDefault(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    const data = await this.itemVariantsService.setDefaultVariant(
      businessId,
      id
    );
    return { success: true, data };
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Add an image to a variant' })
  @ApiResponse({ status: 201, description: 'Image created' })
  async addImage(
    @Param('id') id: string,
    @Body() dto: CreateItemVariantImageDto
  ) {
    const businessId = await this.requireBusinessId();
    const data = await this.itemVariantsService.addVariantImage(
      businessId,
      id,
      dto
    );
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a variant' })
  @ApiResponse({ status: 200, description: 'Variant updated' })
  async updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateItemVariantDto
  ) {
    const businessId = await this.requireBusinessId();
    const data = await this.itemVariantsService.updateVariant(
      businessId,
      id,
      dto
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a variant' })
  @ApiResponse({ status: 200, description: 'Variant deleted' })
  async deleteVariant(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    await this.itemVariantsService.deleteVariant(businessId, id);
    return { success: true };
  }
}
