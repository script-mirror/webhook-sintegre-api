import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSintegreController } from './webhook-sintegre.controller';
import { WebhookSintegreService } from './webhook-sintegre.service';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WebhookSintegre } from './schemas/webhook-sintegre.schema';

type WebhookStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

describe('WebhookSintegreController', () => {
  let controller: WebhookSintegreController;
  let service: jest.Mocked<WebhookSintegreService>;

  const mockWebhook = {
    id: 'webhook-123',
    nome: 'IPDO',
    processo: 'Operação em Tempo Real',
    dataProduto: '20/02/2025',
    macroProcesso: 'Operação do Sistema',
    periodicidade: '2025-02-20T00:00:00',
    periodicidadeFinal: '2025-02-20T23:59:59',
    url: 'https://example.com/file.pdf',
    downloadStatus: 'PENDING' as WebhookStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WebhookSintegre;

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getDownloadUrl: jest.fn(),
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookSintegreController],
      providers: [
        {
          provide: WebhookSintegreService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<WebhookSintegreController>(
      WebhookSintegreController,
    );
    service = module.get(WebhookSintegreService);
  });

  describe('create', () => {
    const createDto = {
      nome: 'IPDO',
      processo: 'Operação em Tempo Real',
      dataProduto: '20/02/2025',
      macroProcesso: 'Operação do Sistema',
      periodicidade: '2025-02-20T00:00:00',
      periodicidadeFinal: '2025-02-20T23:59:59',
      url: 'https://example.com/file.pdf',
    };

    it('should create a webhook successfully', async () => {
      service.create.mockResolvedValue(mockWebhook);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockWebhook);
    });

    it('should handle creation errors', async () => {
      service.create.mockRejectedValue(new Error('Creation failed'));

      await expect(controller.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all webhooks with filters', async () => {
      const webhooks = [mockWebhook];
      service.findAll.mockResolvedValue(webhooks);

      const result = await controller.findAll(
        '2024-02-01',
        '2024-02-29',
        'SUCCESS',
      );

      expect(service.findAll).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        },
        downloadStatus: 'SUCCESS',
      });
      expect(result).toEqual(webhooks);
    });

    it('should handle invalid date formats', async () => {
      await expect(
        controller.findAll('invalid-date', '2024-02-29', 'SUCCESS'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors', async () => {
      service.findAll.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.findAll('2024-02-01', '2024-02-29', 'SUCCESS'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      service.findOne.mockResolvedValue(mockWebhook);

      const result = await controller.findOne('webhook-123');

      expect(service.findOne).toHaveBeenCalledWith('webhook-123');
      expect(result).toEqual(mockWebhook);
    });

    it('should handle not found errors', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle other errors', async () => {
      service.findOne.mockRejectedValue(new Error('Database error'));

      await expect(controller.findOne('webhook-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', async () => {
      const signedUrl = 'https://s3.example.com/file.pdf';
      service.getDownloadUrl.mockResolvedValue(signedUrl);

      const result = await controller.getDownloadUrl('webhook-123');

      expect(service.getDownloadUrl).toHaveBeenCalledWith('webhook-123');
      expect(result).toEqual({ url: signedUrl });
    });

    it('should handle not found errors', async () => {
      service.getDownloadUrl.mockRejectedValue(new NotFoundException());

      await expect(controller.getDownloadUrl('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle other errors', async () => {
      service.getDownloadUrl.mockRejectedValue(new Error('S3 error'));

      await expect(controller.getDownloadUrl('webhook-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getMetrics', () => {
    const mockMetrics = {
      total: {
        total: 100,
        success: 80,
        failed: 15,
        pending: 5,
      },
      daily: [
        {
          _id: '2024-02-19',
          count: 50,
          success: 40,
          failed: 8,
          pending: 2,
        },
      ],
    };

    it('should return metrics with date range', async () => {
      service.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics('2024-02-01', '2024-02-29');

      expect(service.getMetrics).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should handle invalid date formats', async () => {
      await expect(
        controller.getMetrics('invalid-date', '2024-02-29'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors', async () => {
      service.getMetrics.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.getMetrics('2024-02-01', '2024-02-29'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should work without date parameters', async () => {
      service.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(service.getMetrics).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockMetrics);
    });
  });
});
