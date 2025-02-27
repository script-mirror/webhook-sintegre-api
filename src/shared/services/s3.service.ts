import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';

@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

  // Character mapping for accented characters
  private readonly accentMap: { [key: string]: string } = {
    á: 'a',
    à: 'a',
    ã: 'a',
    â: 'a',
    ä: 'a',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    í: 'i',
    ì: 'i',
    î: 'i',
    ï: 'i',
    ó: 'o',
    ò: 'o',
    õ: 'o',
    ô: 'o',
    ö: 'o',
    ú: 'u',
    ù: 'u',
    û: 'u',
    ü: 'u',
    ý: 'y',
    ÿ: 'y',
    ñ: 'n',
    ç: 'c',
    // Uppercase versions
    Á: 'A',
    À: 'A',
    Ã: 'A',
    Â: 'A',
    Ä: 'A',
    É: 'E',
    È: 'E',
    Ê: 'E',
    Ë: 'E',
    Í: 'I',
    Ì: 'I',
    Î: 'I',
    Ï: 'I',
    Ó: 'O',
    Ò: 'O',
    Õ: 'O',
    Ô: 'O',
    Ö: 'O',
    Ú: 'U',
    Ù: 'U',
    Û: 'U',
    Ü: 'U',
    Ý: 'Y',
    Ñ: 'N',
    Ç: 'C',
  };

  constructor(private configService: ConfigService) {
    const region = this.configService.get('AWS_REGION');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const bucket = this.configService.get('AWS_S3_BUCKET');

    // Debug logging
    this.logger.debug(
      `Initializing S3 service with region: ${region}, bucket: ${bucket}`,
    );
    this.logger.debug(
      `Access Key ID length: ${accessKeyId?.length ?? 'undefined'}`,
    );

    if (
      !region ||
      !accessKeyId ||
      !this.configService.get('AWS_SECRET_ACCESS_KEY')
    ) {
      this.logger.error('Missing required AWS credentials');
      throw new Error('Missing required AWS credentials');
    }

    this.s3 = new S3({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
      httpOptions: {
        timeout: 5000,
        connectTimeout: 5000,
      },
      maxRetries: 3,
      retryDelayOptions: { base: 300 },
    });
    this.bucket = bucket;
  }

  private decodeMIMEString(str: string): string {
    // Check if the string contains MIME encoding
    if (str.includes('=?utf-8?B?')) {
      try {
        // Extract the Base64 part
        const matches = str.match(/=\?utf-8\?B\?(.*?)\?=/g);
        if (matches) {
          let result = str;
          for (const match of matches) {
            const base64Part = match.replace(/=\?utf-8\?B\?(.*?)\?=/, '$1');
            const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
            result = result.replace(match, decoded);
          }
          return result;
        }
      } catch (error) {
        this.logger.warn(`Failed to decode MIME string: ${error.message}`);
      }
    }
    return str;
  }

  private normalizeString(str: string): string {
    return str
      .split('')
      .map((char) => this.accentMap[char] || char)
      .join('');
  }

  private sanitizeKey(key: string): string {
    // First decode any MIME encoded parts
    const decodedKey = this.decodeMIMEString(key);

    // Split the path into segments and handle each separately
    return decodedKey
      .split('/')
      .map((segment) => {
        // Normalize accented characters
        const normalized = this.normalizeString(segment);
        // Remove any remaining problematic characters
        const sanitized = normalized.replace(/[^\w\s\-.]/g, '').trim();
        // URL encode the segment
        return encodeURIComponent(sanitized);
      })
      .join('/');
  }

  async uploadFile(
    filePath: string,
    key: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      const fileStream = createReadStream(filePath);

      // Sanitize and encode the key
      const sanitizedKey = this.sanitizeKey(key);

      this.logger.debug(
        `Key processing:\nOriginal: ${key}\nSanitized: ${sanitizedKey}`,
      );

      const uploadParams = {
        Bucket: this.bucket,
        Key: sanitizedKey,
        Body: fileStream,
        Metadata: metadata,
        ContentType: key.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/zip',
      };

      this.logger.debug(
        `Attempting to upload file to S3: ${sanitizedKey} in bucket: ${this.bucket}`,
      );
      const result = await this.s3.upload(uploadParams).promise();
      this.logger.debug(`Successfully uploaded file to S3: ${result.Key}`);
      return result.Key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      this.logger.error(
        `Error details: ${JSON.stringify({
          code: error.code,
          statusCode: error.statusCode,
          requestId: error.requestId,
          time: error.time,
          bucket: this.bucket,
          originalKey: key,
          sanitizedKey: this.sanitizeKey(key),
        })}`,
      );
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      };

      return await this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw error;
    }
  }
}
