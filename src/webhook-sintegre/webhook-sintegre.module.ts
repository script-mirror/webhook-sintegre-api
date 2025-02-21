import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { WebhookSintegreController } from './webhook-sintegre.controller';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { WebhookSintegre, WebhookSintegreSchema } from './schemas/webhook-sintegre.schema';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookSintegre.name, schema: WebhookSintegreSchema },
    ]),
    SharedModule,
  ],
  controllers: [WebhookSintegreController],
  providers: [WebhookSintegreService, WebhookSintegreRepository],
})
export class WebhookSintegreModule {}
