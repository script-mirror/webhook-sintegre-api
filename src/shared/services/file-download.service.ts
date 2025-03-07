import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class FileDownloadService {
  private readonly logger = new Logger(FileDownloadService.name);
  private readonly tempDir = join('/', 'tmp');

  constructor(private readonly httpService: HttpService) {
    this.logger.log({
      message: 'FileDownloadService initialized',
      tempDir: this.tempDir,
    });

    // Ensure temp directory exists
    this.initTempDir().catch((err) => {
      this.logger.error({
        message: 'Failed to create temp directory',
        error: err.message,
        code: err.code,
        tempDir: this.tempDir,
        stack: err.stack,
      });
    });
  }

  private async initTempDir(): Promise<void> {
    this.logger.debug({
      message: 'Creating temp directory',
      tempDir: this.tempDir,
    });

    try {
      await mkdir(this.tempDir, { recursive: true });
      this.logger.debug({
        message: 'Temp directory created successfully',
        tempDir: this.tempDir,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to create temp directory',
        error: error.message,
        code: error.code,
        tempDir: this.tempDir,
        stack: error.stack,
      });
      throw error;
    }
  }

  async downloadFile(
    url: string,
  ): Promise<{ filePath: string; fileName: string }> {
    this.logger.debug({
      message: 'Starting file download',
      url,
      tempDir: this.tempDir,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get<Buffer>(url, { responseType: 'arraybuffer' }),
      );

      const fileName = this.getFileNameFromResponse(response);
      const filePath = join(this.tempDir, fileName);

      this.logger.debug({
        message: 'Writing downloaded file to disk',
        fileName,
        filePath,
        contentLength: response.headers['content-length'],
        contentType: response.headers['content-type'],
      });

      await writeFile(filePath, response.data);

      this.logger.log({
        message: 'File downloaded and saved successfully',
        url,
        fileName,
        filePath,
        contentLength: response.headers['content-length'],
        contentType: response.headers['content-type'],
      });

      return { filePath, fileName };
    } catch (error) {
      this.logger.error({
        message: 'Failed to download file',
        error: error.message,
        code: error.code,
        url,
        tempDir: this.tempDir,
        stack: error.stack,
        response: error.response
          ? {
              status: error.response.status,
              statusText: error.response.statusText,
              headers: error.response.headers,
            }
          : undefined,
      });
      throw error;
    }
  }

  private getFileNameFromResponse(response: AxiosResponse): string {
    this.logger.debug({
      message: 'Extracting filename from response',
      contentDisposition: response.headers['content-disposition'],
    });

    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
        contentDisposition,
      );
      if (matches != null && matches[1]) {
        const fileName = matches[1].replace(/['"]/g, '');
        this.logger.debug({
          message: 'Filename extracted from content-disposition',
          fileName,
          contentDisposition,
        });
        return fileName;
      }
    }
    const generatedFileName = `file-${Date.now()}`;
    this.logger.debug({
      message: 'Generated default filename',
      fileName: generatedFileName,
      reason: 'No content-disposition header or valid filename found',
    });
    return generatedFileName;
  }
}
