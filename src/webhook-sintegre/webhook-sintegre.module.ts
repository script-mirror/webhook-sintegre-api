import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { WebhookSintegreController } from './webhook-sintegre.controller';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { WebhookSintegre } from './entities/webhook-sintegre.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookSintegre]), SharedModule],
  controllers: [WebhookSintegreController],
  providers: [WebhookSintegreService, WebhookSintegreRepository],
})
export class WebhookSintegreModule {}
