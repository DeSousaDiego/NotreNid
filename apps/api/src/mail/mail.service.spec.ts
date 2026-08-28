import type { ConfigService } from '@nestjs/config';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

import { MailService } from './mail.service';

function createConfigService(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('MailService', () => {
  beforeEach(() => {
    sendMail.mockReset();
  });

  it('returns delivered: true and logs nothing sensitive when sendMail succeeds', async () => {
    sendMail.mockResolvedValue(undefined);
    const service = new MailService(createConfigService({ NODE_ENV: 'production' }));

    const result = await service.sendInvitationEmail({
      to: 'sam@example.com',
      householdName: 'Le Nid',
      invitationToken: 'raw-token',
    });

    expect(result).toEqual({ delivered: true });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sam@example.com', from: expect.any(String) }),
    );
  });

  it('does not throw and returns delivered: false when sendMail fails (e.g. no SMTP configured)', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new MailService(createConfigService({ NODE_ENV: 'production' }));

    await expect(
      service.sendInvitationEmail({
        to: 'sam@example.com',
        householdName: 'Le Nid',
        invitationToken: 'raw-token',
      }),
    ).resolves.toEqual({ delivered: false });
  });

  it('logs the raw invitation token outside production but not in production', async () => {
    sendMail.mockResolvedValue(undefined);
    const devService = new MailService(createConfigService({ NODE_ENV: 'development' }));
    const prodService = new MailService(createConfigService({ NODE_ENV: 'production' }));

    const devLoggerSpy = jest.spyOn(
      (devService as unknown as { logger: { log: (msg: string) => void } }).logger,
      'log',
    );
    const prodLoggerSpy = jest.spyOn(
      (prodService as unknown as { logger: { log: (msg: string) => void } }).logger,
      'log',
    );

    await devService.sendInvitationEmail({
      to: 'sam@example.com',
      householdName: 'Le Nid',
      invitationToken: 'secret-token',
    });
    await prodService.sendInvitationEmail({
      to: 'sam@example.com',
      householdName: 'Le Nid',
      invitationToken: 'secret-token',
    });

    expect(devLoggerSpy).toHaveBeenCalledWith(expect.stringContaining('secret-token'));
    expect(prodLoggerSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret-token'));
  });
});
