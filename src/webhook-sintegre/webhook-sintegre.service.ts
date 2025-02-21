import { Injectable } from '@nestjs/common';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { UpdateWebhookSintegreDto } from './dto/update-webhook-sintegre.dto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WebhookSintegreRepository } from './webhook-sintegre.repository';

@Injectable()
export class WebhookSintegreService {
  constructor(
    @InjectPinoLogger(WebhookSintegreService.name)
    private readonly logger: PinoLogger,
    private readonly repository: WebhookSintegreRepository,
  ) {}

  create(createWebhookSintegreDto: CreateWebhookSintegreDto) {
    return this.repository.create(createWebhookSintegreDto);
  }

  findAll() {
    this.logger.info({ abc: 12345 }, 'Testando meu service');
    return this.repository.findAll();
  }

  findOne(id: number) {
    return this.repository.findOne(id);
  }

  update(id: number, updateWebhookSintegreDto: UpdateWebhookSintegreDto) {
    return this.repository.update(id, updateWebhookSintegreDto);
  }

  remove(id: number) {
    return this.repository.remove(id);
  }
}
