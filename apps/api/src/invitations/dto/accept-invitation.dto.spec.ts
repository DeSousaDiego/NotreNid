import { plainToInstance } from 'class-transformer';

import { AcceptInvitationDto } from './accept-invitation.dto';

describe('AcceptInvitationDto', () => {
  it('normalizes a code with a display prefix, separators and mixed case', () => {
    const dto = plainToInstance(AcceptInvitationDto, { code: 'nid-7k4p-2q9d' });
    expect(dto.code).toBe('7K4P2Q9D');
  });

  it('leaves an already-normalized code untouched', () => {
    const dto = plainToInstance(AcceptInvitationDto, { code: '7K4P2Q9D' });
    expect(dto.code).toBe('7K4P2Q9D');
  });

  it('strips stray whitespace', () => {
    const dto = plainToInstance(AcceptInvitationDto, { code: '  7K4P 2Q9D  ' });
    expect(dto.code).toBe('7K4P2Q9D');
  });
});
