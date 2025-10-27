import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { S3Service } from '../shared/services/s3.service';
import { FileDownloadService } from '../shared/services/file-download.service';
import { WebhookSintegre } from './entities/webhook-sintegre.entity';
import { unlink } from 'fs/promises';
import {
  WebhookTimelineResponseDto,
  WebhookTimelineGroup,
  WebhookTimelineEvent,
} from './dto/webhook-sintegre-timeline.dto';
import {
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
} from './types/webhook-retry.types';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
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

  private async handleProcessingError(
    error: Error,
    webhook: WebhookSintegre,
    nome: string,
    webhookId: string,
    fileUrl: string,
  ): Promise<void> {
    const shouldRetry = webhook.retryCount < MAX_RETRY_ATTEMPTS;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + RETRY_DELAY_MS)
      : null;
    const retryCount = shouldRetry
      ? webhook.retryCount + 1
      : webhook.retryCount;
    const retryHistory = [...webhook.retryHistory, new Date()];
    const errorMessage = shouldRetry
      ? error.message
      : `Max retries (${MAX_RETRY_ATTEMPTS}) reached. Last error: ${error.message}`;

    await this.repository.updateForRetry(webhookId, {
      retryCount,
      retryHistory,
      nextRetryAt,
      errorMessage,
    });

    if (shouldRetry) {
      this.scheduleRetry(nome, webhookId, fileUrl, retryCount);
    }

    this.logger.error(
      `File processing failed for webhook ${webhookId} (Attempt ${retryCount}/${MAX_RETRY_ATTEMPTS}): ${error.message}`,
    );
  }

  private scheduleRetry(
    nome: string,
    webhookId: string,
    fileUrl: string,
    currentRetryCount: number,
  ): void {
    setTimeout(() => {
      this.processWebhookFile(nome, webhookId, fileUrl).catch((retryError) => {
        this.logger.error(
          `Retry ${currentRetryCount} failed for webhook ${webhookId}: ${retryError.message}`,
        );
      });
    }, RETRY_DELAY_MS);
  }

  private async processWebhookFile(
    nome: string,
    webhookId: string,
    fileUrl: string,
  ): Promise<void> {
    try {
      // Download file
      let { filePath, fileName } =
        await this.fileDownloadService.downloadFile(fileUrl);

      try {
        fileName = fileName.replace('_2° nível de contingência', '');
        // Generate S3 key based on webhook data and filename
        const s3Key = `webhooks/${nome}/${webhookId + '_' + fileName}`;

        // Upload to S3 with metadata
        await this.s3Service.uploadFile(filePath, s3Key);

        // Update webhook status
        await this.repository.updateStatus(webhookId, 'SUCCESS');
        await this.repository.update(webhookId, { s3Key });

        await this.sendToAirflow(webhookId);
      } catch (error) {
        const webhook = await this.repository.findOne(webhookId);
        await this.handleProcessingError(
          error,
          webhook,
          nome,
          webhookId,
          fileUrl,
        );
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
      const webhook = await this.repository.findOne(webhookId);
      await this.handleProcessingError(
        error,
        webhook,
        nome,
        webhookId,
        fileUrl,
      );
    }
  }

  private async getAuthHeader(): Promise<string> {
    const airflowMiddleUrl: string =
      this.configService.getOrThrow('AIRFLOW_AUTH_URL');
    const airflowUser: string = this.configService.getOrThrow('AIRFLOW_USER');
    const airflowPassword: string =
      this.configService.getOrThrow('AIRFLOW_PASSWORD');
    const response = await fetch(airflowMiddleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: airflowUser,
        password: airflowPassword,
      }),
    });
    if (!response.ok) {
      await response.text();
      throw new Error(`Failed to authenticate with Airflow ${response.text()}`);
    }

    const data: Record<string, string> = await response.json();
    return data.access_token;
  }

  private async sendToAirflow(webhookId: string): Promise<void> {
    const webhook = await this.repository.findOne(webhookId);
    const s3Key = webhook.s3Key;

    const airflowUser = this.configService.getOrThrow('AIRFLOW_USER');
    const airflowPassword = this.configService.getOrThrow('AIRFLOW_PASSWORD');

    const produtosAirflowMiddle = [
      'Relatório de Acompanhamento Hidrológico',
      'Modelo GEFS',
      'Resultados preliminares não consistidos  (vazões semanais - PMO)',
      'Relatório dos resultados finais consistidos da previsão diária (PDP)',
      'Preliminar - Relatório Mensal de Limites de Intercâmbio',
      'Relatório Mensal de Limites de Intercâmbio para o Modelo DECOMP',
      'Carga por patamar - DECOMP',
      'Deck NEWAVE Preliminar',
      'DECK NEWAVE DEFINITIVO',
      'Previsões de carga mensal e por patamar - NEWAVE',
      'Modelo ETA',
      'Modelo ECMWF',
      'IPDO (Informativo Preliminar Diário da Operação)',
      "Deck Preliminar DECOMP - Valor Esperado",
    ];
    const dagRunId = `external-api_webhook-${new Date(Date.now()).toISOString()}`;

    const productDetails = {
      dataProduto: webhook.dataProduto,
      macroProcesso: webhook.macroProcesso || '',
      nome: webhook.nome,
      periodicidade: new Date(webhook.periodicidade).toISOString(),
      periodicidadeFinal: new Date(webhook.periodicidadeFinal).toISOString(),
      processo: webhook.processo || '',
      url: webhook.url,
      s3Key: s3Key,
      webhookId: webhookId,
      filename: s3Key.substring(
        s3Key.indexOf(webhookId) + webhookId.length + 1,
      ),
    };
    if (produtosAirflowMiddle.includes(webhook.nome)) {
      const airflowUrl = this.configService.getOrThrow('AIRFLOW_MIDDLE_URL');
      const dagId = 'webhook-sintegre';
      const triggerDagUrl = `${airflowUrl}/dags/${dagId}/dagRuns`;
      const authHeader = `Bearer ${await this.getAuthHeader()}`;

      try {
        const response = await fetch(triggerDagUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conf: productDetails,
            dag_run_id: dagRunId,
            logical_date: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to trigger Airflow DAG: ${errorText}`);
        }

        this.logger.log(
          `Successfully triggered Airflow DAG ${dagId} for webhook ${webhookId}`,
        );
        await this.repository.updateStatus(webhookId, 'PROCESSED');
      } catch (error) {
        this.logger.error(`Error triggering Airflow DAG: ${error.message}`);
        throw error;
      }
    } else {
      const airflowUrl = this.configService.getOrThrow('AIRFLOW_URL');
      const dagId = this.configService.getOrThrow('AIRFLOW_DAG_ID');
      const triggerDagUrl = `${airflowUrl}/dags/${dagId}/dagRuns`;
      const authHeader = `Basic ${Buffer.from(`${airflowUser}:${airflowPassword}`).toString('base64')}`;

      try {
        const response = await fetch(triggerDagUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conf: productDetails, dag_run_id: dagRunId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to trigger Airflow DAG: ${errorText}`);
        }

        this.logger.log(
          `Successfully triggered Airflow DAG ${dagId} for webhook ${webhookId}`,
        );
        await this.repository.updateStatus(webhookId, 'PROCESSED');
      } catch (error) {
        this.logger.error(`Error triggering Airflow DAG: ${error.message}`);
        throw error;
      }
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

    if (
      !webhook.s3Key ||
      (webhook.downloadStatus !== 'SUCCESS' &&
        webhook.downloadStatus !== 'PROCESSED')
    ) {
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

  async getTimeline(): Promise<WebhookTimelineResponseDto> {
    const webhooks = await this.repository.getTimeline();

    // Group webhooks by nome
    const groupedWebhooks = webhooks.reduce(
      (groups, webhook) => {
        const nome = webhook.nome;
        if (!groups[nome]) {
          groups[nome] = [];
        }
        groups[nome].push(webhook as WebhookTimelineEvent);
        return groups;
      },
      {} as Record<string, WebhookTimelineEvent[]>,
    );

    // Transform the grouped data into the response format
    const groups: WebhookTimelineGroup[] = Object.entries(groupedWebhooks).map(
      ([nome, events]) => ({
        nome,
        events,
      }),
    );

    return { groups };
  }

  async getFilteredTimeline(
    startDate?: Date,
    endDate?: Date,
    nome?: string,
  ): Promise<WebhookTimelineResponseDto> {
    const query: {
      nome?: string;
      createdAt?: {
        $gte?: Date;
        $lte?: Date;
      };
    } = {};

    if (nome) {
      query.nome = nome;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = startDate;
      }
      if (endDate) {
        query.createdAt.$lte = endDate;
      }
    }

    const webhooks = await this.repository.getFilteredTimeline(query);

    // Group webhooks by nome
    const groupedWebhooks = webhooks.reduce(
      (groups, webhook) => {
        const nome = webhook.nome;
        if (!groups[nome]) {
          groups[nome] = [];
        }
        groups[nome].push(webhook as WebhookTimelineEvent);
        return groups;
      },
      {} as Record<string, WebhookTimelineEvent[]>,
    );

    // Transform the grouped data into the response format
    const groups: WebhookTimelineGroup[] = Object.entries(groupedWebhooks).map(
      ([nome, events]) => ({
        nome,
        events,
      }),
    );

    return { groups };
  }

  async reprocess(id: string): Promise<WebhookSintegre> {
    try {
      const webhook = await this.findOne(id);

      if (!webhook.s3Key) {
        throw new BadRequestException(
          'Cannot reprocess webhook without a processed file',
        );
      }

      if (
        !(
          webhook.downloadStatus == 'SUCCESS' ||
          webhook.downloadStatus == 'PROCESSED'
        )
      ) {
        throw new BadRequestException(
          'Cannot reprocess webhook that has not been successfully downloaded',
        );
      }

      await this.sendToAirflow(id);
      return webhook;
    } catch (error) {
      this.logger.error(`Failed to reprocess webhook ${id}: ${error.message}`);
      throw error;
    }
  }

  async retryDownload(id: string): Promise<WebhookSintegre> {
    const webhook = await this.findOne(id);

    if (
      webhook.downloadStatus === 'SUCCESS' ||
      webhook.downloadStatus === 'PROCESSED'
    ) {
      throw new BadRequestException('File is already downloaded successfully');
    }

    if (!webhook.url) {
      throw new BadRequestException('Webhook has no URL to download from');
    }

    // Reset retry counters
    await this.repository.updateForRetry(id, {
      retryCount: 0,
      retryHistory: [],
      nextRetryAt: null,
      errorMessage: null,
      downloadStatus: 'PENDING',
    });

    // Start the download process
    this.processWebhookFile(webhook.nome, id, webhook.url).catch((error) => {
      this.logger.error(
        `Manual retry failed for webhook ${id}: ${error.message}`,
      );
    });

    return this.findOne(id);
  }
}
