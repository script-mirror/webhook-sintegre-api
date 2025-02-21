import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { S3Service } from './services/s3.service';
import { FileDownloadService } from './services/file-download.service';

@Module({
  imports: [HttpModule],
  providers: [S3Service, FileDownloadService],
  exports: [S3Service, FileDownloadService],
})
export class SharedModule {} 