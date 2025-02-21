import { Test, TestingModule } from '@nestjs/testing';
import { FileDownloadService } from './file-download.service';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { Observable, of } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('path');

interface MockResponse extends Partial<AxiosResponse> {
  data: Buffer;
  headers: {
    'content-disposition'?: string;
  };
}

describe('FileDownloadService', () => {
  let service: FileDownloadService;
  let httpService: jest.Mocked<HttpService>;
  let logger: jest.SpyInstance;

  const mockTempDir = '/mock/temp/dir';
  const mockUrl = 'https://example.com/file.pdf';

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock join to return a consistent temp directory
    (join as jest.Mock).mockImplementation((...args) => {
      if (args.includes('temp')) {
        return mockTempDir;
      }
      return args.join('/');
    });

    const httpServiceMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileDownloadService,
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
      ],
    }).compile();

    service = module.get<FileDownloadService>(FileDownloadService);
    httpService = module.get(HttpService);
    logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create temp directory on initialization', async () => {
      expect(mkdir).toHaveBeenCalledWith(mockTempDir, { recursive: true });
    });

    it('should handle temp directory creation error', async () => {
      const error = new Error('Permission denied');
      (mkdir as jest.Mock).mockRejectedValueOnce(error);

      // Create a new instance to trigger constructor
      await Test.createTestingModule({
        providers: [
          FileDownloadService,
          {
            provide: HttpService,
            useValue: { get: jest.fn() },
          },
        ],
      }).compile();

      expect(logger).toHaveBeenCalledWith(
        `Failed to create temp directory: ${error.message}`,
      );
    });
  });

  describe('downloadFile', () => {
    const mockFileContent = Buffer.from('mock file content');
    const mockFileName = 'test-file.pdf';

    it('should download file with content-disposition header', async () => {
      const mockResponse: MockResponse = {
        data: mockFileContent,
        headers: {
          'content-disposition': `attachment; filename="${mockFileName}"`,
        },
      };

      httpService.get.mockReturnValue(
        of(mockResponse) as Observable<AxiosResponse>,
      );

      const result = await service.downloadFile(mockUrl);

      expect(httpService.get).toHaveBeenCalledWith(mockUrl, {
        responseType: 'arraybuffer',
      });
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String), // filePath
        mockFileContent, // file content
      );
      expect(result).toEqual({
        filePath: join(mockTempDir, mockFileName),
        fileName: mockFileName,
      });
    });

    it('should generate filename when content-disposition is missing', async () => {
      const mockResponse: MockResponse = {
        data: mockFileContent,
        headers: {},
      };

      httpService.get.mockReturnValue(
        of(mockResponse) as Observable<AxiosResponse>,
      );
      const dateSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => 1234567890);

      const result = await service.downloadFile(mockUrl);

      expect(result.fileName).toBe('file-1234567890');
      expect(writeFile).toHaveBeenCalled();
      dateSpy.mockRestore();
    });

    it('should handle download errors', async () => {
      const error = new Error('Network error');
      httpService.get.mockReturnValue(
        new Observable((subscriber) => subscriber.error(error)),
      );

      await expect(service.downloadFile(mockUrl)).rejects.toThrow(error);
      expect(logger).toHaveBeenCalledWith(
        `Failed to download file from ${mockUrl}: ${error.message}`,
      );
    });

    it('should handle write file errors', async () => {
      const mockResponse: MockResponse = {
        data: mockFileContent,
        headers: {
          'content-disposition': `attachment; filename="${mockFileName}"`,
        },
      };

      httpService.get.mockReturnValue(
        of(mockResponse) as Observable<AxiosResponse>,
      );

      const writeError = new Error('Write failed');
      (writeFile as jest.Mock).mockRejectedValueOnce(writeError);

      await expect(service.downloadFile(mockUrl)).rejects.toThrow(writeError);
    });

    it('should handle various content-disposition formats', async () => {
      const testCases = [
        {
          header: 'attachment; filename="test.pdf"',
          expected: 'test.pdf',
        },
        {
          header: "attachment; filename='test space.pdf'",
          expected: 'test space.pdf',
        },
        {
          header: 'attachment; filename=simple.pdf',
          expected: 'simple.pdf',
        },
      ];

      for (const testCase of testCases) {
        const mockResponse: MockResponse = {
          data: mockFileContent,
          headers: {
            'content-disposition': testCase.header,
          },
        };

        httpService.get.mockReturnValue(
          of(mockResponse) as Observable<AxiosResponse>,
        );

        const result = await service.downloadFile(mockUrl);
        expect(result.fileName).toBe(testCase.expected);
      }
    });
  });

  describe('getFileNameFromResponse', () => {
    interface TestCase {
      description: string;
      contentDisposition?: string;
      expectedFileName: string | RegExp;
    }

    const testCases: TestCase[] = [
      {
        description: 'standard format with double quotes',
        contentDisposition: 'attachment; filename="test.pdf"',
        expectedFileName: 'test.pdf',
      },
      {
        description: 'format with single quotes',
        contentDisposition: "attachment; filename='test.pdf'",
        expectedFileName: 'test.pdf',
      },
      {
        description: 'format without quotes',
        contentDisposition: 'attachment; filename=test.pdf',
        expectedFileName: 'test.pdf',
      },
      {
        description: 'missing content-disposition',
        expectedFileName: /^file-\d+$/,
      },
      {
        description: 'filename with spaces',
        contentDisposition: 'attachment; filename="test file.pdf"',
        expectedFileName: 'test file.pdf',
      },
    ];

    testCases.forEach(
      ({ description, contentDisposition, expectedFileName }) => {
        it(`should handle ${description}`, () => {
          const headers = new AxiosHeaders();
          if (contentDisposition) {
            headers.set('content-disposition', contentDisposition);
          }

          const mockResponse: AxiosResponse = {
            data: Buffer.from(''),
            status: 200,
            statusText: 'OK',
            headers: contentDisposition
              ? { 'content-disposition': contentDisposition }
              : {},
            config: {
              url: 'test-url',
              method: 'GET',
              headers,
            },
          };

          const result = service['getFileNameFromResponse'](mockResponse);

          if (expectedFileName instanceof RegExp) {
            expect(result).toMatch(expectedFileName);
          } else {
            expect(result).toBe(expectedFileName);
          }
        });
      },
    );
  });
});
