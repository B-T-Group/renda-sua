import { Module } from '@nestjs/common';
import { BusinessItemsItemVariantsController } from './business-items-item-variants.controller';
import { ItemVariantImagesController } from './item-variant-images.controller';
import { ItemVariantsController } from './item-variants.controller';
import { ItemVariantsService } from './item-variants.service';

@Module({
  controllers: [
    BusinessItemsItemVariantsController,
    ItemVariantsController,
    ItemVariantImagesController,
  ],
  providers: [ItemVariantsService],
  exports: [ItemVariantsService],
})
export class ItemVariantsModule {}
