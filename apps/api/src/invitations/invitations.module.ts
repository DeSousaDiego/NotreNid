import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module';

import { InvitationsController } from './invitations.controller';
import { InvitationsPublicController } from './invitations-public.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [MailModule],
  controllers: [InvitationsController, InvitationsPublicController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
