import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
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
import { UpdateItemVariantImageDto } from './dto/update-item-variant-image.dto';
import { ItemVariantsService } from './item-variants.service';

@ApiTags('item-variants')
@Controller('item-variant-images')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ItemVariantImagesController {
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update a variant image' })
  @ApiResponse({ status: 200, description: 'Image updated' })
  async updateImage(
    @Param('id') id: string,
    @Body() dto: UpdateItemVariantImageDto
  ) {
    const businessId = await this.requireBusinessId();
    const data = await this.itemVariantsService.updateVariantImage(
      businessId,
      id,
      dto
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a variant image' })
  @ApiResponse({ status: 200, description: 'Image deleted' })
  async deleteImage(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    await this.itemVariantsService.deleteVariantImage(businessId, id);
    return { success: true };
  }
}
