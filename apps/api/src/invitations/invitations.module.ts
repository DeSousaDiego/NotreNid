import { Module } from '@nestjs/common';

import { InvitationsPublicController } from './invitations-public.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [InvitationsController, InvitationsPublicController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
