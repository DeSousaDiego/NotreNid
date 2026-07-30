import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_FROM') ?? 'Notre Nid <no-reply@notre-nid.local>';
    this.transporter = createTransport({
      host: this.configService.get<string>('SMTP_HOST') ?? 'localhost',
      port: this.configService.get<number>('SMTP_PORT') ?? 1025,
      secure: false,
      auth: this.hasCredentials()
        ? {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
  }

  async sendInvitationEmail(params: {
    to: string;
    householdName: string;
    invitationToken: string;
  }): Promise<void> {
    const { to, householdName, invitationToken } = params;

    // En développement, sans service email externe configuré, on trace toujours
    // le lien/le jeton d'invitation dans les logs (voir docs/NOTRE_NID_PRD.md section 7).
    this.logger.log(`Invitation pour ${to} au foyer "${householdName}" — jeton : ${invitationToken}`);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Invitation à rejoindre le foyer « ${householdName} » sur Notre Nid`,
      text: [
        `Vous avez été invité·e à rejoindre le foyer « ${householdName} » sur Notre Nid.`,
        '',
        `Code d'invitation : ${invitationToken}`,
        '',
        "Utilisez ce code dans l'application pour rejoindre le foyer.",
      ].join('\n'),
    });
  }

  private hasCredentials(): boolean {
    return Boolean(this.configService.get<string>('SMTP_USER'));
  }
}
