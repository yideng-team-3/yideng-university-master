import { APIGatewayProxyHandler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';

let cachedServer: Server;

async function bootstrap(): Promise<Server> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );
    nestApp.enableCors();
    await nestApp.init();
    
    cachedServer = createServer(expressApp);
  }
  return cachedServer;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent, 
  context: Context
) => {
  const server = await bootstrap();
  return proxy(server, event, context, 'PROMISE').promise;
};
