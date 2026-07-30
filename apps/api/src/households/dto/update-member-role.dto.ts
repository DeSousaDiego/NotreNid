import { ApiProperty } from '@nestjs/swagger';
import { HouseholdRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: HouseholdRole })
  @IsEnum(HouseholdRole)
  role!: HouseholdRole;
}
