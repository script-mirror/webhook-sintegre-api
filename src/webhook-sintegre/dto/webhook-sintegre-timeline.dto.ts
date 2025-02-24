import { WebhookSintegre } from '../schemas/webhook-sintegre.schema';

export class WebhookTimelineEvent extends WebhookSintegre {}

export class WebhookTimelineGroup {
  nome: string;
  events: WebhookTimelineEvent[];
}

export class WebhookTimelineResponseDto {
  groups: WebhookTimelineGroup[];
}
