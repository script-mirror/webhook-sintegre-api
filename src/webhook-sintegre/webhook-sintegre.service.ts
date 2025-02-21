import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { S3Service } from '../shared/services/s3.service';
import { FileDownloadService } from '../shared/services/file-download.service';
import { WebhookSintegre } from './schemas/webhook-sintegre.schema';
import { unlink } from 'fs/promises';

type WebhookQuery = {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED';
};

@Injectable()
export class WebhookSintegreService {
  private readonly logger = new Logger(WebhookSintegreService.name);

  constructor(
    private readonly repository: WebhookSintegreRepository,
    private readonly s3Service: S3Service,
    private readonly fileDownloadService: FileDownloadService,
  ) {}

  async create(
    createDto: CreateWebhookSintegreDto & Record<string, unknown>,
  ): Promise<WebhookSintegre> {
    try {
      const webhook = await this.repository.create({
        ...createDto,
        downloadStatus: createDto.downloadStatus || 'PENDING',
      });

      // Start async file processing
      this.processWebhookFile(createDto.nome, webhook.id, createDto.url).catch(
        (error) => {
          this.logger.error(
            `Failed to process file for webhook ${webhook.id}: ${error.message}`,
          );
        },
      );

      return webhook;
    } catch (error) {
      this.logger.error(`Failed to create webhook: ${error.message}`);
      throw error;
    }
  }

  private async processWebhookFile(
    nome: string,
    webhookId: string,
    fileUrl: string,
  ): Promise<void> {
    try {
      // Download file
      const { filePath, fileName } =
        await this.fileDownloadService.downloadFile(fileUrl);

      try {
        // Generate S3 key based on webhook data and filename
        const s3Key = `webhooks/${nome}/${webhookId + '_' + fileName}`;

        // Upload to S3
        await this.s3Service.uploadFile(filePath, s3Key);

        // Update webhook status
        await this.repository.updateStatus(webhookId, 'SUCCESS');
        await this.repository.update(webhookId, { s3Key });
      } catch (error) {
        // Update webhook with error status
        await this.repository.updateStatus(webhookId, 'FAILED', error.message);
        throw error;
      } finally {
        // Cleanup: Remove temporary file
        try {
          await unlink(filePath);
        } catch (unlinkError) {
          this.logger.warn(
            `Failed to remove temporary file ${filePath}: ${unlinkError.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `File processing failed for webhook ${webhookId}: ${error.message}`,
      );
      await this.repository.updateStatus(webhookId, 'FAILED', error.message);
    }
  }

  async findAll(query: WebhookQuery = {}): Promise<WebhookSintegre[]> {
    return this.repository.findAll(query);
  }

  async findOne(id: string): Promise<WebhookSintegre> {
    const webhook = await this.repository.findOne(id);
    if (!webhook) {
      throw new NotFoundException(`Webhook #${id} not found`);
    }
    return webhook;
  }

  async getDownloadUrl(id: string): Promise<string> {
    const webhook = await this.findOne(id);

    if (!webhook.s3Key || webhook.downloadStatus !== 'SUCCESS') {
      throw new NotFoundException('File not available for download');
    }

    try {
      return await this.s3Service.getSignedUrl(webhook.s3Key);
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL for ${webhook.s3Key}: ${error.message}`,
      );
      throw error;
    }
  }

  async getMetrics(startDate?: Date, endDate?: Date) {
    return this.repository.getMetrics(startDate, endDate);
  }
}
