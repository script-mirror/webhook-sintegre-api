import { Module } from '@nestjs/common';
import { WebhookSintegreModule } from './webhook-sintegre/webhook-sintegre.module';
import { CognitoAuthModule } from '@nestjs-cognito/auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HttpModule } from '@nestjs/axios';
import { HealthModule } from './health/health.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpRequestBodyInterceptor } from './utils/http.interceptor';
import { MongooseModule } from '@nestjs/mongoose';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    WebhookSintegreModule,
    HttpModule,
    HealthModule,
    ConfigModule.forRoot(),
    ConfigModule.forRoot({
      load: [databaseConfig],
      isGlobal: true,
    }),
    CognitoAuthModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        jwtVerifier: {
          userPoolId: configService.getOrThrow('AWS_COGNITO_USER_POOL_ID'),
          clientId: null, // Allow any client ID like the original configuration
          tokenUse: 'id', // Using ID token as per documentation recommendation for legacy compatibility
        },
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
        redact: ['req.headers.authorization'],
        quietReqLogger: true,
        quietResLogger: true,
        transport: {
          target: 'pino-pretty',
          options: {
            messageFormat: '[{reqId}] [{context}] {msg}',
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            singleLine: true,
            colorize: true,
          },
        },
      },
      exclude: ['/health/liveness', '/health/readiness'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URI'),
        retryAttempts: 3,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpRequestBodyInterceptor,
    },
  ],
})
export class AppModule {}
