import { WebhookSintegreController } from './webhook-sintegre.controller';
import { TestBed } from '@automock/jest';

describe('WebhookSintegreController', () => {
  let controller: WebhookSintegreController;

  beforeEach(async () => {
    const { unit } = TestBed.create(WebhookSintegreController).compile();
    controller = unit;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
