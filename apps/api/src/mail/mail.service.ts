import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from =
      this.configService.get<string>('SMTP_FROM') ?? 'Notre Nid <no-reply@notre-nid.local>';
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

  /**
   * Ne lève jamais : un échec d'envoi ne doit pas faire échouer la création de
   * l'invitation, déjà persistée en base à ce stade (voir InvitationsService.create).
   * L'appelant décide de l'UX à partir de `delivered`.
   */
  async sendInvitationEmail(params: {
    to: string;
    householdName: string;
    invitationCode: string;
  }): Promise<{ delivered: boolean }> {
    const { to, householdName, invitationCode } = params;

    // En développement, sans service email externe configuré, on trace le code
    // d'invitation dans les logs (voir docs/NOTRE_NID_PRD.md section 7).
    // Ne jamais faire cela en production : le code ne doit pas finir dans des logs
    // agrégés externes (voir aussi InvitationsService, qui ne le journalise jamais).
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(
        `Invitation pour ${to} au foyer "${householdName}" — code : ${invitationCode}`,
      );
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `Invitation à rejoindre le foyer « ${householdName} » sur Notre Nid`,
        text: [
          `Vous avez été invité·e à rejoindre le foyer « ${householdName} » sur Notre Nid.`,
          '',
          `Code d'invitation : ${invitationCode}`,
          '',
          "Ouvrez l'application Notre Nid, choisissez « Rejoindre un foyer » et saisissez ce code.",
        ].join('\n'),
      });
      return { delivered: true };
    } catch (error) {
      this.logger.warn(
        `Échec de l'envoi de l'email d'invitation à ${to} : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { delivered: false };
    }
  }

  private hasCredentials(): boolean {
    return Boolean(this.configService.get<string>('SMTP_USER'));
  }
}
