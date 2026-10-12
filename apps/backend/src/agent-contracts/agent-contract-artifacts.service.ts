import { Injectable, Logger } from '@nestjs/common';
import { AwsService } from '../aws/aws.service';
import { BoldsignClientService } from '../business-contracts/boldsign-client.service';
import {
  AgentContractRow,
  AgentContractsDatabaseService,
} from './agent-contracts-database.service';

@Injectable()
export class AgentContractArtifactsService {
  private readonly logger = new Logger(AgentContractArtifactsService.name);

  constructor(
    private readonly boldsign: BoldsignClientService,
    private readonly aws: AwsService,
    private readonly db: AgentContractsDatabaseService
  ) {}

  async storeSigned(contract: AgentContractRow): Promise<void> {
    const documentId = contract.boldsign_document_id;
    if (documentId.startsWith('pending:')) return;
    const bucket = this.aws.getDefaultBucketName();
    if (!bucket) return;
    const pdfKey = await this.storePdf(bucket, contract.id, documentId);
    const auditKey = await this.storeAudit(bucket, contract.id, documentId);
    await this.db.updateContract(contract.id, {
      signed_pdf_s3_key: pdfKey,
      audit_certificate_s3_key: auditKey,
    });
  }

  private async storePdf(
    bucket: string,
    contractId: string,
    documentId: string
  ): Promise<string> {
    const pdf = await this.boldsign.downloadDocument(documentId);
    const key = this.aws.generateUniqueKey(
      `agent-contract-${contractId}.pdf`,
      'contracts/agent-signed'
    );
    await this.upload(bucket, key, pdf);
    await this.db.updateContract(contractId, {
      document_hash: AgentContractsDatabaseService.hashBuffer(pdf),
    });
    return key;
  }

  private async storeAudit(
    bucket: string,
    contractId: string,
    documentId: string
  ): Promise<string | null> {
    try {
      const audit = await this.boldsign.downloadAuditTrail(documentId);
      const key = this.aws.generateUniqueKey(
        `agent-audit-${contractId}.pdf`,
        'contracts/agent-audit'
      );
      await this.upload(bucket, key, audit);
      return key;
    } catch (error: any) {
      this.logger.warn(`Agent audit download failed: ${error?.message}`);
      return null;
    }
  }

  private async upload(bucket: string, key: string, data: Buffer): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await this.aws.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: 'application/pdf',
      })
    );
  }
}
