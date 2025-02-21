import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ReadStream } from 'fs';

// Move these constants before the mocks
const mockBucket = 'test-bucket';
const mockRegion = 'us-east-1';
const mockFilePath = '/path/to/file.pdf';
const mockS3Key = 'documents/file.pdf';
const mockSignedUrl = 'https://signed-url.example.com';

// Mock AWS SDK modules
const mockSend = jest.fn();
const mockS3Client = jest.fn().mockImplementation(() => ({
  send: mockSend,
  config: {
    credentials: {
      accessKeyId: 'mock-key',
      secretAccessKey: 'mock-secret',
    },
    region: mockRegion,
  },
}));
const mockPutObjectCommand = jest.fn();
const mockGetObjectCommand = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  PutObjectCommand: mockPutObjectCommand,
  GetObjectCommand: mockGetObjectCommand,
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Mock fs
const { createReadStream } = jest.requireMock('fs');

// Near the top with other type imports
type MockS3Client = {
  send: jest.Mock;
};

describe('S3Service', () => {
  let service: S3Service;
  let s3Client: jest.Mocked<MockS3Client>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.SpyInstance;

  beforeEach(async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'AWS_S3_BUCKET':
            return mockBucket;
          case 'AWS_REGION':
            return mockRegion;
          case 'AWS_ACCESS_KEY_ID':
            return 'mock-key';
          case 'AWS_SECRET_ACCESS_KEY':
            return 'mock-secret';
          default:
            return undefined;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    configService = module.get(ConfigService);
    logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Initialize s3Client with mockSend
    s3Client = { send: mockSend } as jest.Mocked<MockS3Client>;
    service['s3Client'] = s3Client;

    // Reset all mocks before each test
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
    mockPutObjectCommand.mockReset();
    mockGetObjectCommand.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockReadStream = { pipe: jest.fn() } as unknown as ReadStream;

    beforeEach(() => {
      (createReadStream as jest.Mock).mockReturnValue(mockReadStream);
      (s3Client.send as jest.Mock).mockResolvedValue({});
    });

    it('should upload file successfully', async () => {
      await service.uploadFile(mockFilePath, mockS3Key);

      expect(createReadStream).toHaveBeenCalledWith(mockFilePath);
      expect(s3Client.send).toHaveBeenCalledWith(
        expect.any(mockPutObjectCommand),
      );
      expect(mockPutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockBucket,
        Key: mockS3Key,
        Body: mockReadStream,
      });
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      (s3Client.send as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.uploadFile(mockFilePath, mockS3Key)).rejects.toThrow(
        error,
      );
      expect(logger).toHaveBeenCalledWith(
        `Failed to upload file to S3: ${error.message}`,
      );
    });

    it('should handle file read errors', async () => {
      const error = new Error('File not found');
      (createReadStream as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.uploadFile(mockFilePath, mockS3Key)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getSignedUrl', () => {
    beforeEach(() => {
      (mockGetSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);
    });

    it('should generate signed URL successfully', async () => {
      const result = await service.getSignedUrl(mockS3Key);

      expect(mockGetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockBucket,
        Key: mockS3Key,
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.any(mockGetObjectCommand),
        { expiresIn: 3600 },
      );
      expect(result).toBe(mockSignedUrl);
    });

    it('should handle URL generation errors', async () => {
      const error = new Error('URL generation failed');
      (mockGetSignedUrl as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.getSignedUrl(mockS3Key)).rejects.toThrow(error);
      expect(logger).toHaveBeenCalledWith(
        `Failed to generate signed URL: ${error.message}`,
      );
    });

    it('should use custom expiration time', async () => {
      const customExpiration = 7200;
      await service.getSignedUrl(mockS3Key, customExpiration);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.any(mockGetObjectCommand),
        { expiresIn: customExpiration },
      );
    });
  });

  describe('initialization', () => {
    it('should initialize with correct AWS configuration', () => {
      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockRegion,
        credentials: {
          accessKeyId: 'mock-key',
          secretAccessKey: 'mock-secret',
        },
      });
      expect(configService.get).toHaveBeenCalledWith('AWS_REGION');
      expect(configService.get).toHaveBeenCalledWith('AWS_S3_BUCKET');
    });

    it('should throw error if bucket is not configured', () => {
      configService.get.mockReturnValueOnce(undefined);

      expect(() => new S3Service(configService)).toThrow(
        'AWS S3 bucket not configured',
      );
    });

    it('should throw error if region is not configured', () => {
      const configServiceMock = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'AWS_S3_BUCKET') return mockBucket;
          return undefined;
        }),
      };

      const testService = new S3Service(
        configServiceMock as unknown as ConfigService,
      );
      expect(() => testService['validateConfig']()).toThrow(
        'AWS region not configured',
      );
    });
  });
});
