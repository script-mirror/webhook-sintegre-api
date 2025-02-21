import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class FileDownloadService {
  private readonly logger = new Logger(FileDownloadService.name);
  private readonly tempDir = join(process.cwd(), 'temp');

  constructor(private readonly httpService: HttpService) {
    // Ensure temp directory exists
    this.initTempDir().catch((err) => {
      this.logger.error(`Failed to create temp directory: ${err.message}`);
    });
  }

  private async initTempDir(): Promise<void> {
    await mkdir(this.tempDir, { recursive: true });
  }

  async downloadFile(
    url: string,
  ): Promise<{ filePath: string; fileName: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<Buffer>(url, { responseType: 'arraybuffer' }),
      );

      const fileName = this.getFileNameFromResponse(response);
      const filePath = join(this.tempDir, fileName);

      await writeFile(filePath, response.data);

      return { filePath, fileName };
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${url}: ${error.message}`,
      );
      throw error;
    }
  }

  private getFileNameFromResponse(response: AxiosResponse): string {
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
        contentDisposition,
      );
      if (matches != null && matches[1]) {
        return matches[1].replace(/['"]/g, '');
      }
    }
    return `file-${Date.now()}`;
  }
}
