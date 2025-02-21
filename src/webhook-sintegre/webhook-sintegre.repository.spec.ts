import { WebhookSintegreRepository } from './webhook-sintegre.repository';
import { TestBed } from '@automock/jest';

describe('WebhookSintegreRepository', () => {
  let repository: WebhookSintegreRepository;

  beforeEach(async () => {
    const { unit } = TestBed.create(WebhookSintegreRepository).compile();
    repository = unit;
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });
});
