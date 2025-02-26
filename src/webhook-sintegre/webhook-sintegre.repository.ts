import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebhookSintegre,
  WebhookSintegreDocument,
} from './schemas/webhook-sintegre.schema';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { RetryInfo } from './types/webhook-retry.types';

type WebhookUpdateData = {
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  s3Key?: string;
} & Partial<RetryInfo>;

type WebhookQuery = {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED';
};

type WebhookMetricsStage = {
  _id?: string | null;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
};

@Injectable()
export class WebhookSintegreRepository {
  private readonly logger = new Logger(WebhookSintegreRepository.name);

  constructor(
    @InjectModel(WebhookSintegre.name)
    private webhookModel: Model<WebhookSintegreDocument>,
  ) {}

  async create(
    createDto: CreateWebhookSintegreDto & Record<string, unknown>,
  ): Promise<WebhookSintegre> {
    try {
      const webhook = new this.webhookModel(createDto);
      return await webhook.save();
    } catch (error) {
      this.logger.error(`Failed to create webhook: ${error.message}`);
      throw error;
    }
  }

  async findAll(query: WebhookQuery = {}): Promise<WebhookSintegre[]> {
    try {
      return await this.webhookModel.find(query).sort({ createdAt: -1 }).exec();
    } catch (error) {
      this.logger.error(`Failed to fetch webhooks: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<WebhookSintegre> {
    try {
      return await this.webhookModel.findById(id).lean().exec();
    } catch (error) {
      this.logger.error(`Failed to fetch webhook ${id}: ${error.message}`);
      throw error;
    }
  }

  async update(
    id: string,
    updateDto: WebhookUpdateData,
  ): Promise<WebhookSintegre> {
    try {
      return await this.webhookModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to update webhook ${id}: ${error.message}`);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'SUCCESS' | 'FAILED',
    errorMessage?: string,
  ): Promise<WebhookSintegre> {
    try {
      const update: WebhookUpdateData = { downloadStatus: status };
      if (errorMessage) {
        update.errorMessage = errorMessage;
      }
      return await this.webhookModel
        .findByIdAndUpdate(id, update, { new: true })
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to update webhook status ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async getMetrics(startDate?: Date, endDate?: Date) {
    try {
      const matchStage: WebhookMetricsStage = {};
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const [totalStats, dailyStats] = await Promise.all([
        this.webhookModel.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              success: {
                $sum: {
                  $cond: [{ $eq: ['$downloadStatus', 'SUCCESS'] }, 1, 0],
                },
              },
              failed: {
                $sum: {
                  $cond: [{ $eq: ['$downloadStatus', 'FAILED'] }, 1, 0],
                },
              },
              pending: {
                $sum: {
                  $cond: [{ $eq: ['$downloadStatus', 'PENDING'] }, 1, 0],
                },
              },
            },
          },
        ]),

        this.webhookModel.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
              success: {
                $sum: {
                  $cond: [{ $eq: ['$downloadStatus', 'SUCCESS'] }, 1, 0],
                },
              },
              failed: {
                $sum: {
                  $cond: [{ $eq: ['$downloadStatus', 'FAILED'] }, 1, 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      return {
        total: totalStats[0] || { total: 0, success: 0, failed: 0, pending: 0 },
        daily: dailyStats,
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      throw error;
    }
  }

  async getTimeline(): Promise<WebhookSintegre[]> {
    try {
      return await this.webhookModel
        .find()
        .sort({ nome: 1, createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to fetch webhook timeline: ${error.message}`);
      throw error;
    }
  }

  async updateForRetry(
    id: string,
    retryData: RetryInfo & { errorMessage: string },
  ): Promise<WebhookSintegre> {
    try {
      return await this.webhookModel
        .findByIdAndUpdate(
          id,
          { ...retryData, downloadStatus: 'FAILED' },
          { new: true },
        )
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to update webhook retry info ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
