import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

const COUNT_ITEM_IMAGES = `
  query CountItemImagesForActivation($itemId: uuid!) {
    item_images(where: { item_id: { _eq: $itemId } }) {
      validation_errors
    }
  }
`;

const COUNT_RENTAL_IMAGES = `
  query CountRentalImagesForActivation($rentalItemId: uuid!) {
    rental_item_images(where: { rental_item_id: { _eq: $rentalItemId } }) {
      validation_errors
    }
  }
`;

const MIN_IMAGES_FOR_ACTIVE = 2;

@Injectable()
export class ItemActivationValidationService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async assertItemCanActivate(itemId: string): Promise<void> {
    const row = await this.hasuraUserService.executeQuery<{
      item_images: { validation_errors: unknown[] }[];
    }>(COUNT_ITEM_IMAGES, { itemId });
    this.assertItemImagesReady(row?.item_images ?? []);
  }

  /** System/admin/AI paths without a user JWT. */
  async assertItemCanActivateAsSystem(itemId: string): Promise<void> {
    const row = await this.hasuraSystemService.executeQuery<{
      item_images: { validation_errors: unknown[] }[];
    }>(COUNT_ITEM_IMAGES, { itemId });
    this.assertItemImagesReady(row?.item_images ?? []);
  }

  async assertRentalItemCanActivate(rentalItemId: string): Promise<void> {
    const row = await this.hasuraUserService.executeQuery<{
      rental_item_images: { validation_errors: unknown[] }[];
    }>(COUNT_RENTAL_IMAGES, { rentalItemId });
    this.assertRentalItemImagesReady(row?.rental_item_images ?? []);
  }

  /** System/admin/AI paths without a user JWT. */
  async assertRentalItemCanActivateAsSystem(
    rentalItemId: string
  ): Promise<void> {
    const row = await this.hasuraSystemService.executeQuery<{
      rental_item_images: { validation_errors: unknown[] }[];
    }>(COUNT_RENTAL_IMAGES, { rentalItemId });
    this.assertRentalItemImagesReady(row?.rental_item_images ?? []);
  }

  private assertItemImagesReady(
    images: { validation_errors: unknown[] }[]
  ): void {
    if (images.length < MIN_IMAGES_FOR_ACTIVE) {
      throw new HttpException(
        {
          success: false,
          error: 'ITEM_MIN_IMAGES',
          message:
            'At least two product images are required before activating this item.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    this.assertNoBlockingErrors(images);
  }

  private assertRentalItemImagesReady(
    images: { validation_errors: unknown[] }[]
  ): void {
    if (images.length < MIN_IMAGES_FOR_ACTIVE) {
      throw new HttpException(
        {
          success: false,
          error: 'ITEM_MIN_IMAGES',
          message:
            'At least two product images are required before activating this rental item.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    this.assertNoBlockingErrors(images);
  }

  private assertNoBlockingErrors(
    images: { validation_errors: unknown[] }[]
  ): void {
    const hasBlocking = images.some((img) => {
      const errs = img.validation_errors;
      return Array.isArray(errs) && errs.length > 0;
    });
    if (hasBlocking) {
      throw new HttpException(
        {
          success: false,
          error: 'IMAGE_VALIDATION_ERRORS',
          message:
            'One or more images have quality issues that must be fixed before publishing.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
