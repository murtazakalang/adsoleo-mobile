import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateCreatorDto {
  @ApiProperty({ example: 'creator@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Temp@1234', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Sophie Martin' })
  @IsOptional()
  @IsString()
  publicName?: string;
}
