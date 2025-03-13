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

  /**
   * Decodes a MIME encoded-word string (RFC 2047)
   * @param encodedWord - The encoded string in format =?charset?encoding?encoded-text?=
   * @returns The decoded string
   */
  private decodeMimeEncodedWord(encodedWord: string): string {
    try {
      // Check if it matches the MIME encoded-word format
      const matches = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/.exec(encodedWord);
      if (!matches) {
        return encodedWord;
      }

      const charset = matches[1].toLowerCase(); // e.g., 'utf-8'
      const encoding = matches[2].toUpperCase(); // 'B' for Base64, 'Q' for Quoted-Printable
      const encodedText = matches[3];

      if (encoding === 'B') {
        // Base64 encoding
        const buffer = Buffer.from(encodedText, 'base64');
        // Use a safe approach to handle the charset
        let decodedText: string;
        try {
          // Try to use the charset from the header as encoding
          // Normalize common charset names
          const normalizedCharset = this.normalizeCharset(charset);
          decodedText = buffer.toString(normalizedCharset as BufferEncoding);
        } catch (err) {
          // Fallback to utf8 if the charset is not supported
          this.logger.warn({
            message: `Unsupported charset "${charset}", falling back to utf8`,
            error: err.message,
          });
          decodedText = buffer.toString('utf8');
        }
        return decodedText;
      } else if (encoding === 'Q') {
        // Quoted-Printable encoding (not implemented here, but could be added if needed)
        this.logger.warn({
          message: 'Quoted-Printable encoding not fully supported',
          encodedWord,
        });
        return encodedWord;
      }

      return encodedWord;
    } catch (error) {
      this.logger.error({
        message: 'Failed to decode MIME encoded word',
        error: error.message,
        encodedWord,
      });
      return encodedWord; // Return original if decoding fails
    }
  }

  /**
   * Normalizes charset names to Node.js BufferEncoding compatible values
   * @param charset - The charset from the MIME header
   * @returns A normalized charset name that can be used as BufferEncoding
   */
  private normalizeCharset(charset: string): string {
    // Map of common charset names to Node.js BufferEncoding values
    const charsetMap: Record<string, string> = {
      'utf-8': 'utf8',
      utf8: 'utf8',
      ascii: 'ascii',
      'iso-8859-1': 'latin1',
      latin1: 'latin1',
      binary: 'binary',
      ucs2: 'ucs2',
      'ucs-2': 'ucs2',
      utf16le: 'utf16le',
      'utf-16le': 'utf16le',
    };

    return charsetMap[charset] || 'utf8'; // Default to utf8 if not found
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
        let fileName = matches[1].replace(/['"]/g, '');

        // Check if the filename is MIME encoded
        if (fileName.startsWith('=?') && fileName.endsWith('?=')) {
          fileName = this.decodeMimeEncodedWord(fileName);
          this.logger.debug({
            message: 'Decoded MIME encoded filename',
            decodedFileName: fileName,
            originalEncoded: matches[1],
          });
        }

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
