import { Injectable } from '@nestjs/common';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { UpdateWebhookSintegreDto } from './dto/update-webhook-sintegre.dto';

@Injectable()
export class WebhookSintegreRepository {
  create(createWebhookSintegreDto: CreateWebhookSintegreDto) {
    return 'This action adds a new webhook-sintegre';
  }

  findAll() {
    return `This action returns all WebhookSintegre`;
  }

  findOne(id: number) {
    return `This action returns a #${id} WebhookSintegre`;
  }

  update(id: number, updateWebhookSintegreDto: UpdateWebhookSintegreDto) {
    return `This action updates a #${id} WebhookSintegre`;
  }

  remove(id: number) {
    return `This action removes a #${id} WebhookSintegre`;
  }
}
