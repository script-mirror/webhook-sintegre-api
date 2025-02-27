import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { createReadStream } from 'fs';

@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

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

  async uploadFile(
    filePath: string,
    key: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      const fileStream = createReadStream(filePath);

      // Encode the key to handle special characters and spaces
      const encodedKey = key
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');

      this.logger.debug(`Original key: ${key}\nEncoded key: ${encodedKey}`);

      const uploadParams = {
        Bucket: this.bucket,
        Key: encodedKey,
        Body: fileStream,
        Metadata: metadata,
        ContentType: 'application/zip', // Add proper content type for zip files
      };

      this.logger.debug(
        `Attempting to upload file to S3: ${encodedKey} in bucket: ${this.bucket}`,
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
          key,
          encodedKey: key
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/'),
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
