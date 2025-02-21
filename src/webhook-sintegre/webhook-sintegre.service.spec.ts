import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { TestBed } from '@automock/jest';

describe('WebhookSintegreService', () => {
  let service: WebhookSintegreService;
  let repository: WebhookSintegreRepository;

  beforeEach(async () => {
    const { unit, unitRef } = TestBed.create(WebhookSintegreService).compile();

    service = unit;
    repository = unitRef.get(WebhookSintegreRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });
});
