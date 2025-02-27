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

      // Ensure all metadata values are strings
      const processedMetadata = metadata
        ? Object.entries(metadata).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: typeof value === 'string' ? value : JSON.stringify(value),
            }),
            {},
          )
        : undefined;

      this.logger.debug(
        `Processing metadata: ${JSON.stringify(processedMetadata)}`,
      );

      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        Metadata: processedMetadata,
      };

      this.logger.debug(
        `Upload params: ${JSON.stringify({
          Bucket: uploadParams.Bucket,
          Key: uploadParams.Key,
          Metadata: uploadParams.Metadata,
        })}`,
      );

      const result = await this.s3.upload(uploadParams).promise();
      return result.Key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      this.logger.error(
        `Upload parameters: ${JSON.stringify({
          bucket: this.bucket,
          key,
          metadata,
          processedMetadata: metadata
            ? Object.entries(metadata).reduce(
                (acc, [key, value]) => ({
                  ...acc,
                  [key]:
                    typeof value === 'string' ? value : JSON.stringify(value),
                }),
                {},
              )
            : undefined,
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
