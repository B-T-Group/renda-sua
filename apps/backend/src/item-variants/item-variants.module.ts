import { Module } from '@nestjs/common';
import { ImageThumbnailsModule } from '../image-thumbnails/image-thumbnails.module';
import { BusinessItemsItemVariantsController } from './business-items-item-variants.controller';
import { ItemVariantImagesController } from './item-variant-images.controller';
import { ItemVariantsController } from './item-variants.controller';
import { ItemVariantsService } from './item-variants.service';

@Module({
  imports: [ImageThumbnailsModule],
  controllers: [
    BusinessItemsItemVariantsController,
    ItemVariantsController,
    ItemVariantImagesController,
  ],
  providers: [ItemVariantsService],
  exports: [ItemVariantsService],
})
export class ItemVariantsModule {}
