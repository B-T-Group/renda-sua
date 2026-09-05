import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { AssistantIdentityService } from './assistant-identity.service';
import { AssistantService } from './assistant.service';
import {
  AssistantChatRequestDto,
  AssistantChatResponseDto,
} from './dto/assistant-chat.dto';

@ApiTags('assistant')
@Controller('assistant')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly identities: AssistantIdentityService
  ) {}

  @Post('chat')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chat with the Rendasua assistant using optional authentication',
  })
  @ApiBody({ type: AssistantChatRequestDto })
  @ApiResponse({ status: 200, type: AssistantChatResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid chat messages' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async chat(
    @ReqContext() context: RequestContext,
    @Body() body: AssistantChatRequestDto
  ): Promise<AssistantChatResponseDto> {
    const identity = await this.identities.resolveFromUserId(context.userId);
    const result = await this.assistant.chat({
      channel: 'app',
      messages: body.messages,
      identity,
      locale: identity.preferredLanguage,
    });
    return { reply: result.reply, handoff: result.handoff };
  }
}
