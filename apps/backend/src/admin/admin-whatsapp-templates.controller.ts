import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminWhatsAppTemplatesService } from './admin-whatsapp-templates.service';
import { TestWhatsAppTemplateDto } from './dto/test-whatsapp-template.dto';

const BODY_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
});

@ApiTags('admin-whatsapp')
@Controller('admin/whatsapp/templates')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.OPS_USER_MESSAGES)
@ApiBearerAuth()
export class AdminWhatsAppTemplatesController {
  constructor(private readonly service: AdminWhatsAppTemplatesService) {}

  @Get()
  @ApiOperation({
    summary: 'List WhatsApp templates and required send params',
    operationId: 'adminListWhatsAppTemplates',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'],
  })
  @ApiResponse({ status: 200, description: 'Template catalog' })
  list(@Query('category') category?: string) {
    return this.service.list(category);
  }

  @Post('test')
  @UsePipes(BODY_PIPE)
  @ApiOperation({
    summary: 'Send a test WhatsApp template message',
    operationId: 'adminTestWhatsAppTemplate',
  })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: TestWhatsAppTemplateDto })
  @ApiResponse({ status: 200, description: 'Send attempted' })
  @ApiResponse({ status: 400, description: 'Unknown template or missing vars' })
  sendTest(@Body() body: TestWhatsAppTemplateDto) {
    return this.service.sendTest(body);
  }
}
