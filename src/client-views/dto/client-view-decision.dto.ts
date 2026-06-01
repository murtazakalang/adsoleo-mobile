import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionType } from '@prisma/client';

export class ClientViewDecisionDto {
  @ApiProperty({
    description: 'The ID of the application being decided on',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({
    enum: DecisionType,
    description: 'The decision made by the client',
  })
  @IsEnum(DecisionType)
  @IsNotEmpty()
  decision: DecisionType;

  @ApiPropertyOptional({
    description: 'Optional comment from the client',
  })
  @IsString()
  @IsOptional()
  comment?: string;
}
