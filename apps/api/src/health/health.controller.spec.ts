import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports ok on /health', () => {
    expect(controller.check().status).toBe('ok');
  });

  it('reports ok on /health/ready', () => {
    expect(controller.ready().status).toBe('ok');
  });
});
