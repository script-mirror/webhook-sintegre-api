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
    this.s3 = new S3({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = this.configService.get('AWS_S3_BUCKET');

    this.logger.log({
      message: 'S3Service initialized',
      bucket: this.bucket,
      region: this.configService.get('AWS_REGION'),
    });
  }

  async uploadFile(filePath: string, key: string): Promise<string> {
    this.logger.debug({
      message: 'Starting file upload to S3',
      filePath,
      key,
      bucket: this.bucket,
    });

    try {
      const fileStream = createReadStream(filePath);

      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
      };

      const result = await this.s3.upload(uploadParams).promise();

      this.logger.log({
        message: 'File successfully uploaded to S3',
        key: result.Key,
        bucket: this.bucket,
        eTag: result.ETag,
      });

      return result.Key;
    } catch (error) {
      this.logger.error({
        message: 'Failed to upload file to S3',
        error: error.message,
        code: error.code,
        filePath,
        key,
        bucket: this.bucket,
        stack: error.stack,
      });
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    this.logger.debug({
      message: 'Generating signed URL',
      key,
      expiresIn,
      bucket: this.bucket,
    });

    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn,
      };

      const signedUrl = await this.s3.getSignedUrlPromise('getObject', params);

      this.logger.debug({
        message: 'Successfully generated signed URL',
        key,
        expiresIn,
        bucket: this.bucket,
        urlLength: signedUrl.length,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error({
        message: 'Failed to generate signed URL',
        error: error.message,
        code: error.code,
        key,
        expiresIn,
        bucket: this.bucket,
        stack: error.stack,
      });
      throw error;
    }
  }
}
