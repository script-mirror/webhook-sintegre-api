import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { WebhookSintegre } from './entities/webhook-sintegre.entity';
import { WebhookTimelineResponseDto } from './dto/webhook-sintegre-timeline.dto';

type WebhookQuery = {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED';
};

@ApiTags('Webhook Sintegre')
@Controller('api/webhooks')
export class WebhookSintegreController {
  private readonly logger = new Logger(WebhookSintegreController.name);

  constructor(private readonly service: WebhookSintegreService) {}

  @Post('sintegre')
  @ApiOperation({ summary: 'Receive webhook from Sintegre' })
  @ApiResponse({
    status: 201,
    description: 'Webhook received and processing started',
    type: CreateWebhookSintegreDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async create(
    @Body() createDto: CreateWebhookSintegreDto & Record<string, unknown>,
  ): Promise<WebhookSintegre> {
    try {
      this.logger.debug(`Receiving webhook: ${JSON.stringify(createDto)}`);
      return await this.service.create(createDto);
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all webhooks' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of webhooks',
    type: [CreateWebhookSintegreDto],
  })
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'PENDING' | 'SUCCESS' | 'FAILED',
  ): Promise<WebhookSintegre[]> {
    try {
      const query: WebhookQuery = {};

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          const startDateTime = new Date(startDate);
          if (isNaN(startDateTime.getTime())) {
            throw new BadRequestException('Invalid startDate format');
          }
          query.createdAt.$gte = startDateTime;
        }
        if (endDate) {
          const endDateTime = new Date(endDate);
          if (isNaN(endDateTime.getTime())) {
            throw new BadRequestException('Invalid endDate format');
          }
          query.createdAt.$lte = endDateTime;
        }
      }

      if (status) {
        query.downloadStatus = status;
      }

      return await this.service.findAll(query);
    } catch (error) {
      this.logger.error(`Failed to fetch webhooks: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch webhooks');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook details by ID' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook details',
    type: WebhookSintegre,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(@Param('id') id: string): Promise<WebhookSintegre> {
    try {
      const webhook = await this.service.findOne(id);
      if (!webhook) {
        throw new NotFoundException(`Webhook #${id} not found`);
      }
      return webhook;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to fetch webhook ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch webhook');
    }
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for webhook file' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({
    status: 200,
    description: 'Signed URL for file download',
    type: String,
  })
  @ApiResponse({ status: 404, description: 'Webhook or file not found' })
  async getDownloadUrl(@Param('id') id: string): Promise<{ url: string }> {
    try {
      this.logger.debug(`Getting download URL for webhook ${id}`);
      const url = await this.service.getDownloadUrl(id);
      this.logger.debug(`Download URL: ${url}`);
      return { url };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `Failed to get download URL for webhook ${id}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get webhook metrics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Webhook metrics and statistics',
  })
  async getMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      if (startDate && isNaN(start.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
      if (endDate && isNaN(end.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }

      return await this.service.getMetrics(start, end);
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch metrics');
    }
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get webhook events timeline grouped by name' })
  @ApiResponse({
    status: 200,
    description: 'Returns the webhook events timeline grouped by name',
    type: WebhookTimelineResponseDto,
  })
  async getTimeline(): Promise<WebhookTimelineResponseDto> {
    return this.service.getTimeline();
  }

  @Get('timeline/filtered')
  @ApiOperation({ summary: 'Get filtered webhook events timeline grouped by name' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date filter (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date filter (ISO format)' })
  @ApiQuery({ name: 'nome', required: false, type: String, description: 'Filter by webhook name' })
  @ApiResponse({
    status: 200,
    description: 'Returns the filtered webhook events timeline grouped by name',
    type: WebhookTimelineResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  async getFilteredTimeline(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('nome') nome?: string,
  ): Promise<WebhookTimelineResponseDto> {
    try {
      let startDateTime: Date | undefined;
      let endDateTime: Date | undefined;
      
      if (startDate) {
        startDateTime = new Date(startDate);
        if (isNaN(startDateTime.getTime())) {
          throw new BadRequestException('Invalid startDate format');
        }
      }
      
      if (endDate) {
        endDateTime = new Date(endDate);
        if (isNaN(endDateTime.getTime())) {
          throw new BadRequestException('Invalid endDate format');
        }
      }
      
      return this.service.getFilteredTimeline(startDateTime, endDateTime, nome);
    } catch (error) {
      this.logger.error(`Failed to fetch filtered timeline: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch filtered timeline');
    }
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Reprocess webhook by sending it to Airflow again' })
  @ApiParam({ name: 'id', description: 'Webhook ID to reprocess' })
  @ApiResponse({
    status: 200,
    description: 'Webhook reprocessing started successfully',
    type: WebhookSintegre,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiResponse({ status: 400, description: 'Webhook cannot be reprocessed' })
  async reprocess(@Param('id') id: string): Promise<WebhookSintegre> {
    try {
      return await this.service.reprocess(id);
    } catch (error) {
      this.logger.error(`Failed to reprocess webhook ${id}: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to reprocess webhook');
    }
  }

  @Post(':id/retry-download')
  @ApiOperation({ summary: 'Manually retry downloading the webhook file' })
  @ApiParam({ name: 'id', description: 'Webhook ID to retry download' })
  @ApiResponse({
    status: 200,
    description: 'File download retry started successfully',
    type: WebhookSintegre,
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot retry download for this webhook',
  })
  async retryDownload(@Param('id') id: string): Promise<WebhookSintegre> {
    try {
      return await this.service.retryDownload(id);
    } catch (error) {
      this.logger.error(
        `Failed to retry download for webhook ${id}: ${error.message}`,
      );
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to retry file download');
    }
  }
}
