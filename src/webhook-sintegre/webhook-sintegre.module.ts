import { Module } from '@nestjs/common';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { WebhookSintegreController } from './webhook-sintegre.controller';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';

@Module({
  controllers: [WebhookSintegreController],
  providers: [WebhookSintegreService, WebhookSintegreRepository],
})
export class WebhookSintegreModule {}
