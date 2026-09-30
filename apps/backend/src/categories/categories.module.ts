import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogArtworkModule } from '../catalog-artwork/catalog-artwork.module';
import { HasuraModule } from '../hasura/hasura.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [HasuraModule, AdminAuthModule, AuthModule, CatalogArtworkModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
