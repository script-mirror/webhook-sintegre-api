import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { HealthModule } from './health.module';
import { ConfigModule } from '@nestjs/config';

describe('Health Controller (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }), HealthModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('GET /health/liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health/liveness');

    expect(response.status).toEqual(HttpStatus.OK);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('GET /health/readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/readiness');

    expect(response.status).toEqual(HttpStatus.OK);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
