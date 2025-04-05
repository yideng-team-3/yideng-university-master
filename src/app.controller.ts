import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('App')
@Controller({
  version: VERSION_NEUTRAL
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Welcome message', description: 'Returns a welcome message for the API' })
  @ApiResponse({ status: 200, description: 'The welcome message' })
  getWelcome(): string {
    return this.appService.getWelcome();
  }

  @Public()
  @Get('db-test')
  @ApiOperation({ summary: '数据库连接测试', description: '测试数据库连接是否正常' })
  @ApiResponse({ status: 200, description: '数据库连接状态' })
  async testDatabaseConnection(): Promise<object> {
    return await this.appService.testDatabaseConnection();
  }
}