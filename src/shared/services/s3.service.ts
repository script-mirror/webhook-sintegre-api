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
  }

  async uploadFile(
    filePath: string,
    key: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    try {
      const fileStream = createReadStream(filePath);

      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        // Metadata: metadata,
      };

      console.log('metadata', metadata);

      const result = await this.s3.upload(uploadParams).promise();
      return result.Key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
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
