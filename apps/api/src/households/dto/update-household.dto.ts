import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateHouseholdDto {
  @ApiProperty({ example: 'Notre nid' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
