import { PartialType } from '@nestjs/mapped-types';
import { CreateWebhookSintegreDto } from './create-webhook-sintegre.dto';

export class UpdateWebhookSintegreDto extends PartialType(
  CreateWebhookSintegreDto,
) {}
