import { Module } from '@nestjs/common';
import { WebhookSintegreModule } from './webhook-sintegre/webhook-sintegre.module';
import { AuthModule } from '@raizen-energy/nestjs-cognito';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FeatureToggleModule } from '@raizen-energy/nestjs-appconfig';
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
    AuthModule.registerAsync({
      //Docs: https://github.com/raizen-energy/raizen-power-lib-nestjs-cognito
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // List of authorized Cognito user pools
        userPools: [
          {
            // Authorized client ID or null if want to allow any client ID
            clientId: null,
            // Authorized token use: "id", "access" or null if want to allow any token use
            tokenUse: null,
            // Cognito User Pool ID, including region. Example: us-east-2_cdKDJ9hzc
            userPoolId: configService.getOrThrow('AWS_COGNITO_USER_POOL_ID'),
          },
        ],
        insecurelyDisableAuth:
          configService.get('INSECURELY_DESABLE_AUTH') === 'true',
        // List of URLs which bypass authentication
        requestUrlExceptions: [
          '/health/liveness',
          '/health/readiness',
          '/api/webhooks/sintegre',
        ],
        // Optional: name of the HTTP header containing the JWT token as a value. "Bearer " will be removed from the value.
        requestHeaderName: ['authorization', 'x-cognito-token'],
      }),
    }),

    FeatureToggleModule.registerAsync({
      //Docs: https://github.com/raizen-energy/raizen-power-lib-nestjs-appconfig
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        applicationId: configService.get('APPCONFIG_APPLICATION_ID'),
        environmentId: configService.get('APPCONFIG_ENVIRONMENT_ID'),
        configurationProfileId: configService.get(
          'APPCONFIG_CONFIGURATION_PROFILE_ID',
        ),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
        redact: ['req.headers.authorization', 'req.headers["x-cognito-token"]'],
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
        uri: configService.get<string>('database.uri'),
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
