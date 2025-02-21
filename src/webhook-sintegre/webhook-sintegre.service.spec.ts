import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { S3Service } from '../shared/services/s3.service';
import { FileDownloadService } from '../shared/services/file-download.service';
import { NotFoundException } from '@nestjs/common';
import { WebhookSintegre } from './schemas/webhook-sintegre.schema';

type WebhookStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

describe('WebhookSintegreService', () => {
  let service: WebhookSintegreService;
  let repository: jest.Mocked<WebhookSintegreRepository>;
  let s3Service: jest.Mocked<S3Service>;
  let fileDownloadService: jest.Mocked<FileDownloadService>;

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
    const repositoryMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      getMetrics: jest.fn(),
    };

    const s3ServiceMock = {
      uploadFile: jest.fn(),
      getSignedUrl: jest.fn(),
    };

    const fileDownloadServiceMock = {
      downloadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSintegreService,
        {
          provide: WebhookSintegreRepository,
          useValue: repositoryMock,
        },
        {
          provide: S3Service,
          useValue: s3ServiceMock,
        },
        {
          provide: FileDownloadService,
          useValue: fileDownloadServiceMock,
        },
      ],
    }).compile();

    service = module.get<WebhookSintegreService>(WebhookSintegreService);
    repository = module.get(WebhookSintegreRepository);
    s3Service = module.get(S3Service);
    fileDownloadService = module.get(FileDownloadService);
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

    it('should create a webhook and start file processing', async () => {
      repository.create.mockResolvedValue(mockWebhook);
      fileDownloadService.downloadFile.mockResolvedValue({
        filePath: '/tmp/file.pdf',
        fileName: 'file.pdf',
      });
      s3Service.uploadFile.mockResolvedValue('s3-key');
      repository.updateStatus.mockResolvedValue(mockWebhook);
      repository.update.mockResolvedValue(mockWebhook);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        downloadStatus: 'PENDING',
      });
      expect(result).toEqual(mockWebhook);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Database error');
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(error);
    });
  });

  describe('findAll', () => {
    it('should return all webhooks with query', async () => {
      const query = {
        createdAt: { $gte: new Date(), $lte: new Date() },
        downloadStatus: 'SUCCESS' as const,
      };
      const webhooks = [mockWebhook];
      repository.findAll.mockResolvedValue(webhooks);

      const result = await service.findAll(query);

      expect(repository.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(webhooks);
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id', async () => {
      repository.findOne.mockResolvedValue(mockWebhook);

      const result = await service.findOne('webhook-123');

      expect(repository.findOne).toHaveBeenCalledWith('webhook-123');
      expect(result).toEqual(mockWebhook);
    });

    it('should throw NotFoundException when webhook not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return signed URL for successful webhook', async () => {
      const webhookWithS3: WebhookSintegre = {
        ...mockWebhook,
        downloadStatus: 'SUCCESS' as WebhookStatus,
        s3Key: 's3-key',
      };
      repository.findOne.mockResolvedValue(webhookWithS3);
      s3Service.getSignedUrl.mockResolvedValue('signed-url');

      const result = await service.getDownloadUrl('webhook-123');

      expect(result).toBe('signed-url');
      expect(s3Service.getSignedUrl).toHaveBeenCalledWith('s3-key');
    });

    it('should throw NotFoundException when file not available', async () => {
      repository.findOne.mockResolvedValue(mockWebhook);

      await expect(service.getDownloadUrl('webhook-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with date range', async () => {
      const metrics = {
        total: { total: 100, success: 80, failed: 15, pending: 5 },
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
      repository.getMetrics.mockResolvedValue(metrics);
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-29');

      const result = await service.getMetrics(startDate, endDate);

      expect(repository.getMetrics).toHaveBeenCalledWith(startDate, endDate);
      expect(result).toEqual(metrics);
    });
  });

  describe('processWebhookFile', () => {
    const processFile = async (
      nome: string,
      webhookId: string,
      fileUrl: string,
    ) => {
      // Using type assertion to access private method
      const processWebhookFile = (
        service as unknown as {
          processWebhookFile: (typeof service)['processWebhookFile'];
        }
      ).processWebhookFile.bind(service);
      return processWebhookFile(nome, webhookId, fileUrl);
    };

    it('should process file successfully', async () => {
      fileDownloadService.downloadFile.mockResolvedValue({
        filePath: '/tmp/file.pdf',
        fileName: 'file.pdf',
      });
      s3Service.uploadFile.mockResolvedValue('s3-key');
      repository.updateStatus.mockResolvedValue(mockWebhook);
      repository.update.mockResolvedValue(mockWebhook);

      await processFile('IPDO', 'webhook-123', 'https://example.com/file.pdf');

      expect(fileDownloadService.downloadFile).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
      );
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        '/tmp/file.pdf',
        'webhooks/IPDO/webhook-123_file.pdf',
      );
      expect(repository.updateStatus).toHaveBeenCalledWith(
        'webhook-123',
        'SUCCESS',
      );
      expect(repository.update).toHaveBeenCalledWith('webhook-123', {
        s3Key: 'webhooks/IPDO/webhook-123_file.pdf',
      });
    });

    it('should handle download errors', async () => {
      const error = new Error('Download failed');
      fileDownloadService.downloadFile.mockRejectedValue(error);
      repository.updateStatus.mockResolvedValue(mockWebhook);

      await processFile('IPDO', 'webhook-123', 'https://example.com/file.pdf');

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'webhook-123',
        'FAILED',
        error.message,
      );
    });

    it('should handle upload errors', async () => {
      fileDownloadService.downloadFile.mockResolvedValue({
        filePath: '/tmp/file.pdf',
        fileName: 'file.pdf',
      });
      const error = new Error('Upload failed');
      s3Service.uploadFile.mockRejectedValue(error);
      repository.updateStatus.mockResolvedValue(mockWebhook);

      await processFile('IPDO', 'webhook-123', 'https://example.com/file.pdf');

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'webhook-123',
        'FAILED',
        error.message,
      );
    });
  });
});
