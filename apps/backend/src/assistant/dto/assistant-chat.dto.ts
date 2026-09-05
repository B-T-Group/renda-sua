import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssistantChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class AssistantChatRequestDto {
  @ApiProperty({ type: [AssistantChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssistantChatMessageDto)
  messages!: AssistantChatMessageDto[];
}

export class AssistantChatResponseDto {
  @ApiProperty()
  reply!: string;

  @ApiProperty({ description: 'Whether human support should take over' })
  handoff!: boolean;
}
