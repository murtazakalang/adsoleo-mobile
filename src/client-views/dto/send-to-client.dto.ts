import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendToClientDto {
  @ApiProperty()
  @IsEmail()
  clientEmail: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  applicationIds: string[];

  @ApiProperty({ description: 'Days until the link expires', enum: [7, 14] })
  @IsIn([7, 14])
  expiresInDays: 7 | 14;
}
