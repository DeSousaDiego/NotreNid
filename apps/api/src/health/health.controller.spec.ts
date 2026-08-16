import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { AppException } from '../common/exceptions/app-exception';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports ok on /health without touching the database', () => {
    expect(controller.check().status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports ok on /health/ready when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.ready();

    expect(result.status).toBe('ok');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports DATABASE_UNAVAILABLE on /health/ready when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.ready()).rejects.toMatchObject(
      expect.objectContaining({
        code: 'DATABASE_UNAVAILABLE',
      }) as Partial<AppException>,
    );
  });
});
