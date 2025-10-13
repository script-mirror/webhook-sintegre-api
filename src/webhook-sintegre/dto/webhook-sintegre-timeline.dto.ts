import { WebhookSintegre } from '../entities/webhook-sintegre.entity';

export class WebhookTimelineEvent extends WebhookSintegre {}

export class WebhookTimelineGroup {
  nome: string;
  events: WebhookTimelineEvent[];
}

export class WebhookTimelineResponseDto {
  groups: WebhookTimelineGroup[];
}
