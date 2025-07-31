import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      genReqId: (req) => {
        const existingID = req.id ?? req.headers['x-request-id'];
        if (existingID) return existingID;
        const id = randomUUID();
        return id;
      },
    }),
  );
  app.useLogger(app.get(Logger));

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addServer('/webhook')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  document.security = [{ 'access-token': [] }];

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      showExtensions: true,
      deepLinking: true,
      operationsSorter: 'alpha',
      tagsSorter: 'alpha',
    },
  });
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://main.d2xsdrugrvc2p.amplifyapp.com',
      'https://qa.d2xsdrugrvc2p.amplifyapp.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen({
    host: '0.0.0.0',
    port: 3000,
  });
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
