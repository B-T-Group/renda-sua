import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { AwsService } from '../../aws/aws.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { isActivePersona } from '../../users/persona.util';
import {
  INSPECTION_EVIDENCE_BUCKET,
  INSPECTION_UPLOAD_TTL_SECONDS,
  INSPECTION_VIEW_TTL_SECONDS,
  inspectionDerivativeKey,
  inspectionObjectKey,
  isInspectionEvidenceKey,
  validateInspectionUpload,
} from './rental-inspection-evidence';

export interface EvidencePresignInput {
  unitId: string;
  role: string;
  contentType: string;
  fileSize: number;
}

@Injectable()
export class RentalInspectionEvidenceService {
  private readonly logger = new Logger(RentalInspectionEvidenceService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly aws: AwsService
  ) {}

  async presign(bookingId: string, input: EvidencePresignInput) {
    const upload = validateInspectionUpload(input.contentType, input.fileSize);
    const actor = await this.actorForUpload(bookingId, input.role);
    const inspection = await this.draftInspection(bookingId, input.role);
    await this.assertUnit(bookingId, input.unitId);
    const mediaId = randomUUID();
    const objectKey = inspectionObjectKey(bookingId, mediaId, upload.ext);
    await this.insertPending(mediaId, inspection.id, input, objectKey, upload, actor.userId);
    const signed = await this.aws.generateStrictUploadUrl({
      bucketName: this.bucket(),
      key: objectKey,
      contentType: upload.contentType,
      contentLength: upload.size,
      expiresIn: INSPECTION_UPLOAD_TTL_SECONDS,
    });
    return {
      mediaId,
      objectKey,
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
      headers: { 'Content-Type': upload.contentType, 'Content-Length': String(upload.size) },
    };
  }

  async finalize(bookingId: string, mediaId: string) {
    const media = await this.ownMedia(bookingId, mediaId);
    if (media.status !== 'pending') return { mediaId, status: media.status };
    const head = await this.aws.headObjectMeta(this.bucket(), media.object_key);
    this.assertUploaded(head, media);
    const bytes = await this.aws.readObjectBytes(this.bucket(), media.object_key);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const derivative = await this.writeDerivative(media.object_key, bytes);
    await this.markReady(mediaId, {
      sha256,
      byteSize: bytes.length,
      contentType: head!.contentType,
      versionId: head!.versionId,
      derivativeKey: derivative,
    });
    return { mediaId, status: 'ready', sha256 };
  }

  async viewUrl(bookingId: string, mediaId: string, original = false) {
    const media = await this.readableMedia(bookingId, mediaId);
    const key = original ? media.object_key : media.derivative_key;
    if (!key) {
      throw new HttpException('Photo is not ready', HttpStatus.CONFLICT);
    }
    const signed = await this.aws.generatePresignedDownloadUrl({
      bucketName: this.bucket(),
      key,
      expiresIn: INSPECTION_VIEW_TTL_SECONDS,
    });
    return { mediaId, url: signed.url, expiresAt: signed.expiresAt };
  }

  private bucket(): string {
    return process.env.APPEAL_EVIDENCE_BUCKET?.trim() || INSPECTION_EVIDENCE_BUCKET;
  }

  private async actorForUpload(bookingId: string, role: string) {
    const user = await this.users.getUser();
    const booking = await this.bookingParty(bookingId);
    const business = isActivePersona(user, 'business') && user.business?.id === booking.business_id;
    const client = isActivePersona(user, 'client') && user.client?.id === booking.client_id;
    if (business) return { userId: user.id, booking };
    if (client && role === 'counter') return { userId: user.id, booking };
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  private async draftInspection(bookingId: string, role: string) {
    const stage = role === 'counter' ? 'return' : await this.openStage(bookingId);
    const found = await this.hasura.executeQuery<{ rental_inspections: Array<{ id: string }> }>(
      `query DraftInspection($bookingId: uuid!, $stage: String!) {
        rental_inspections(where: { rental_booking_id: { _eq: $bookingId }, stage: { _eq: $stage } }, limit: 1) { id }
      }`,
      { bookingId, stage }
    );
    const inspection = found.rental_inspections?.[0];
    if (!inspection) throw new HttpException('Open the inspection draft first', HttpStatus.CONFLICT);
    return inspection;
  }

  private async openStage(bookingId: string): Promise<string> {
    const booking = await this.bookingParty(bookingId);
    if (booking.status === 'reserved' || booking.status === 'confirmed') return 'pickup';
    return 'return';
  }

  private async bookingParty(bookingId: string) {
    const result = await this.hasura.executeQuery<{
      rental_bookings_by_pk: { id: string; business_id: string; client_id: string; status: string; inspection_policy_version: number | null } | null;
    }>(
      `query EvidenceBooking($id: uuid!) {
        rental_bookings_by_pk(id: $id) { id business_id client_id status inspection_policy_version }
      }`,
      { id: bookingId }
    );
    const booking = result.rental_bookings_by_pk;
    if (!booking?.inspection_policy_version) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    return booking;
  }

  private async assertUnit(bookingId: string, unitId: string) {
    const result = await this.hasura.executeQuery<{ rental_booking_units_by_pk: { rental_booking_id: string } | null }>(
      `query EvidenceUnit($id: uuid!) { rental_booking_units_by_pk(id: $id) { rental_booking_id } }`,
      { id: unitId }
    );
    if (result.rental_booking_units_by_pk?.rental_booking_id !== bookingId) {
      throw new HttpException('Unit not found', HttpStatus.NOT_FOUND);
    }
  }

  private async insertPending(
    mediaId: string,
    inspectionId: string,
    input: EvidencePresignInput,
    objectKey: string,
    upload: { contentType: string; size: number },
    userId: string
  ) {
    if (!isInspectionEvidenceKey(objectKey, objectKey.split('/')[2])) {
      throw new HttpException('Invalid evidence key', HttpStatus.BAD_REQUEST);
    }
    await this.hasura.executeMutation(
      `mutation InsertInspectionMedia($object: rental_inspection_media_insert_input!) {
        insert_rental_inspection_media_one(object: $object) { id }
      }`,
      {
        object: {
          id: mediaId,
          inspection_id: inspectionId,
          unit_id: input.unitId,
          role: input.role,
          object_key: objectKey,
          content_type: upload.contentType,
          expected_byte_size: upload.size,
          status: 'pending',
          created_by: userId,
        },
      }
    );
  }

  private async ownMedia(bookingId: string, mediaId: string) {
    const media = await this.mediaRow(mediaId);
    if (!media || !isInspectionEvidenceKey(media.object_key, bookingId)) {
      throw new HttpException('Photo not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.users.getUser();
    if (media.created_by !== user.id) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    return media;
  }

  private async readableMedia(bookingId: string, mediaId: string) {
    const media = await this.mediaRow(mediaId);
    const booking = await this.bookingParty(bookingId);
    const user = await this.users.getUser();
    const party =
      (isActivePersona(user, 'business') && user.business?.id === booking.business_id) ||
      (isActivePersona(user, 'client') && user.client?.id === booking.client_id);
    if (!media || !party || !isInspectionEvidenceKey(media.object_key, bookingId)) {
      throw new HttpException('Photo not found', HttpStatus.NOT_FOUND);
    }
    if (media.status === 'pending') throw new HttpException('Photo is not ready', HttpStatus.CONFLICT);
    return media;
  }

  private async mediaRow(mediaId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_media_by_pk: {
        id: string;
        object_key: string;
        derivative_key: string | null;
        status: string;
        expected_byte_size: number | null;
        content_type: string | null;
        created_by: string | null;
      } | null;
    }>(
      `query InspectionMedia($id: uuid!) {
        rental_inspection_media_by_pk(id: $id) {
          id object_key derivative_key status expected_byte_size content_type created_by
        }
      }`,
      { id: mediaId }
    );
    return result.rental_inspection_media_by_pk;
  }

  private assertUploaded(
    head: { contentLength: number; contentType: string; versionId: string | null } | null,
    media: { expected_byte_size: number | null; content_type: string | null }
  ): void {
    if (!head) throw new HttpException('Upload not found', HttpStatus.CONFLICT);
    const type = head.contentType.split(';')[0].trim().toLowerCase();
    if (type !== (media.content_type ?? '') || head.contentLength !== media.expected_byte_size) {
      throw new HttpException('Uploaded file does not match the signed type and size', HttpStatus.BAD_REQUEST);
    }
  }

  private async writeDerivative(objectKey: string, bytes: Buffer): Promise<string> {
    let stripped: Buffer;
    try {
      stripped = await sharp(bytes, { failOn: 'error' }).rotate().jpeg({ quality: 85 }).toBuffer();
    } catch (error: any) {
      this.logger.warn(`inspection derivative failed: ${error?.message ?? error}`);
      throw new HttpException('Photo could not be processed', HttpStatus.BAD_REQUEST);
    }
    const derivativeKey = inspectionDerivativeKey(objectKey);
    await this.aws.putPrivateObject(this.bucket(), derivativeKey, stripped, 'image/jpeg');
    return derivativeKey;
  }

  private async markReady(
    mediaId: string,
    proof: { sha256: string; byteSize: number; contentType: string; versionId: string | null; derivativeKey: string }
  ) {
    await this.hasura.executeMutation(
      `mutation ReadyInspectionMedia($id: uuid!, $set: rental_inspection_media_set_input!) {
        update_rental_inspection_media(
          where: { id: { _eq: $id }, status: { _eq: "pending" } }
          _set: $set
        ) { affected_rows }
      }`,
      {
        id: mediaId,
        set: {
          status: 'ready',
          sha256: proof.sha256,
          byte_size: proof.byteSize,
          content_type: proof.contentType,
          s3_version_id: proof.versionId,
          derivative_key: proof.derivativeKey,
        },
      }
    );
  }
}
