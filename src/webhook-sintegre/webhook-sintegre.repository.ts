import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { WebhookSintegre } from './entities/webhook-sintegre.entity';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { RetryInfo } from './types/webhook-retry.types';

type WebhookUpdateData = {
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSED';
  errorMessage?: string;
  s3Key?: string;
} & Partial<RetryInfo>;

type WebhookQuery = {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSED';
};



@Injectable()
export class WebhookSintegreRepository {
  private readonly logger = new Logger(WebhookSintegreRepository.name);

  constructor(
    @InjectRepository(WebhookSintegre)
    private webhookRepository: Repository<WebhookSintegre>,
  ) {}

  async create(
    createDto: CreateWebhookSintegreDto & Record<string, unknown>,
  ): Promise<WebhookSintegre> {
    try {
      const webhook = this.webhookRepository.create(createDto);
      return await this.webhookRepository.save(webhook);
    } catch (error) {
      this.logger.error(`Failed to create webhook: ${error.message}`);
      throw error;
    }
  }

  async findAll(query: WebhookQuery = {}): Promise<WebhookSintegre[]> {
    try {
      const where: Record<string, any> = {};
      
      if (query.downloadStatus) {
        where.downloadStatus = query.downloadStatus;
      }
      
      if (query.createdAt) {
        if (query.createdAt.$gte && query.createdAt.$lte) {
          where.createdAt = Between(query.createdAt.$gte, query.createdAt.$lte);
        } else if (query.createdAt.$gte) {
          where.createdAt = { $gte: query.createdAt.$gte };
        } else if (query.createdAt.$lte) {
          where.createdAt = LessThanOrEqual(query.createdAt.$lte);
        }
      }

      return await this.webhookRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch webhooks: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<WebhookSintegre> {
    try {
      return await this.webhookRepository.findOne({ where: { id } });
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
      await this.webhookRepository.update({ id }, updateDto);
      return await this.webhookRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error(`Failed to update webhook ${id}: ${error.message}`);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSED',
    errorMessage?: string,
  ): Promise<WebhookSintegre> {
    try {
      const update: WebhookUpdateData = { downloadStatus: status };
      if (errorMessage) {
        update.errorMessage = errorMessage;
      }
      await this.webhookRepository.update({ id }, update);
      return await this.webhookRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error(
        `Failed to update webhook status ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async getMetrics(startDate?: Date, endDate?: Date) {
    try {
      const queryBuilder = this.webhookRepository.createQueryBuilder('webhook');
      
      if (startDate || endDate) {
        if (startDate && endDate) {
          queryBuilder.andWhere('webhook.createdAt BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          });
        } else if (startDate) {
          queryBuilder.andWhere('webhook.createdAt >= :startDate', { startDate });
        } else if (endDate) {
          queryBuilder.andWhere('webhook.createdAt <= :endDate', { endDate });
        }
      }

      // Get total stats
      const totalStatsQuery = queryBuilder
        .clone()
        .select([
          'COUNT(*) as total',
          'SUM(CASE WHEN webhook.downloadStatus = "SUCCESS" THEN 1 ELSE 0 END) as success',
          'SUM(CASE WHEN webhook.downloadStatus = "FAILED" THEN 1 ELSE 0 END) as failed',
          'SUM(CASE WHEN webhook.downloadStatus = "PENDING" THEN 1 ELSE 0 END) as pending',
        ]);

      // Get daily stats
      const dailyStatsQuery = queryBuilder
        .clone()
        .select([
          'DATE(webhook.createdAt) as date',
          'COUNT(*) as count',
          'SUM(CASE WHEN webhook.downloadStatus = "SUCCESS" THEN 1 ELSE 0 END) as success',
          'SUM(CASE WHEN webhook.downloadStatus = "FAILED" THEN 1 ELSE 0 END) as failed',
        ])
        .groupBy('DATE(webhook.createdAt)')
        .orderBy('date', 'ASC');

      const [totalStats, dailyStats] = await Promise.all([
        totalStatsQuery.getRawOne(),
        dailyStatsQuery.getRawMany(),
      ]);

      return {
        total: totalStats || { total: 0, success: 0, failed: 0, pending: 0 },
        daily: dailyStats.map((stat) => ({
          _id: stat.date,
          count: parseInt(stat.count),
          success: parseInt(stat.success),
          failed: parseInt(stat.failed),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      throw error;
    }
  }

  async getTimeline(): Promise<WebhookSintegre[]> {
    try {
      return await this.webhookRepository.find({
        order: { nome: 'ASC', createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch webhook timeline: ${error.message}`);
      throw error;
    }
  }

  async getFilteredTimeline(query: {
    nome?: string;
    createdAt?: { $gte?: Date; $lte?: Date };
  }): Promise<WebhookSintegre[]> {
    try {
      const where: Record<string, any> = {};
      
      if (query.nome) {
        where.nome = query.nome;
      }
      
      if (query.createdAt) {
        if (query.createdAt.$gte && query.createdAt.$lte) {
          where.createdAt = Between(query.createdAt.$gte, query.createdAt.$lte);
        } else if (query.createdAt.$gte) {
          where.createdAt = { $gte: query.createdAt.$gte };
        } else if (query.createdAt.$lte) {
          where.createdAt = LessThanOrEqual(query.createdAt.$lte);
        }
      }

      return await this.webhookRepository.find({
        where,
        order: { nome: 'ASC', createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch filtered webhook timeline: ${error.message}`,
      );
      throw error;
    }
  }

  async updateForRetry(
    id: string,
    retryData: RetryInfo & { errorMessage: string },
  ): Promise<WebhookSintegre> {
    try {
      await this.webhookRepository.update(
        { id },
        { ...retryData, downloadStatus: 'FAILED' },
      );
      return await this.webhookRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error(
        `Failed to update webhook retry info ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
