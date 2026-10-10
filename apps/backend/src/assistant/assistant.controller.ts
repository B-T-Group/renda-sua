import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: AssistantChatRequestDto
  ): Promise<AssistantChatResponseDto> {
    const identity = await this.identities.resolveFromUserId(
      context.userId,
      body.market,
      context.activePersona,
      context.activeDelegation
    );
    const result = await this.assistant.chat({
      channel: 'app',
      messages: body.messages,
      identity,
      locale: identity.preferredLanguage,
      marketContext: body.market,
      threadId: body.threadId,
      signal: clientDisconnectSignal(req, res),
    });
    return {
      reply: result.reply,
      handoff: result.handoff,
      cards: result.cards,
    };
  }
}

/** Aborts once the client goes away, so a closed tab does not keep running tools. */
function clientDisconnectSignal(req: Request, res: Response): AbortSignal {
  const controller = new AbortController();
  const stop = () => {
    if (!res.writableEnded) controller.abort();
  };
  req.on('close', stop);
  res.on('close', stop);
  return controller.signal;
}
