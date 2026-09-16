import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ImageThumbnailsController } from './image-thumbnails.controller';
import { ImageThumbnailsCronService } from './image-thumbnails-cron.service';
import { ImageThumbnailsInternalController } from './image-thumbnails-internal.controller';
import { ImageThumbnailsQueueService } from './image-thumbnails-queue.service';
import { ImageThumbnailsService } from './image-thumbnails.service';

@Module({
  imports: [HasuraModule, AwsModule, AdminAuthModule],
  controllers: [ImageThumbnailsController, ImageThumbnailsInternalController],
  providers: [
    ImageThumbnailsQueueService,
    ImageThumbnailsService,
    ImageThumbnailsCronService,
  ],
  exports: [ImageThumbnailsService],
})
export class ImageThumbnailsModule {}
