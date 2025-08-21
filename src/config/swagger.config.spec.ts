import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createSwaggerDocument } from './swagger.config';
import * as fs from 'fs';

describe('createSwaggerDocument', () => {
  let app: NestFastifyApplication;

  beforeAll(() => {
    process.env.npm_package_name = 'MockedAppName';
    process.env.npm_package_version = 'MockedAppVersion';
    process.env.npm_package_description = 'MockedAppDescription';
    jest.spyOn(fs, 'mkdirSync');
    jest.spyOn(fs, 'writeFileSync');
  });

  afterAll(() => {
    delete process.env.npm_package_name;
    delete process.env.npm_package_version;
    delete process.env.npm_package_description;
    delete process.env.NODE_ENV;
    delete process.env.SWAGGER_AUTO_GENERATE;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({}).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should not create a Swagger document without defined NODE_ENV and SWAGGER_AUTO_GENERATE', () => {
    delete process.env.NODE_ENV;
    delete process.env.SWAGGER_AUTO_GENERATE;

    createSwaggerDocument(app);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should not create a Swagger document when SWAGGER_AUTO_GENERATE false', () => {
    process.env.NODE_ENV = 'development';
    process.env.SWAGGER_AUTO_GENERATE = 'false';

    createSwaggerDocument(app);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should not create a Swagger document when NODE_ENV production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SWAGGER_AUTO_GENERATE = 'false';

    createSwaggerDocument(app);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should create a Swagger document when SWAGGER_AUTO_GENERATE true', () => {
    process.env.NODE_ENV = 'development';
    process.env.SWAGGER_AUTO_GENERATE = 'true';

    const swaggerDocument = createSwaggerDocument(app);
    const { npm_package_name, npm_package_version, npm_package_description } =
      process.env;

    expect(swaggerDocument).toBeDefined();
    expect(swaggerDocument.info.title).toBeDefined();
    expect(swaggerDocument.info.title).toBe(npm_package_name);
    expect(swaggerDocument.info.version).toBeDefined();
    expect(swaggerDocument.info.version).toBe(npm_package_version);
    expect(swaggerDocument.info.description).toBeDefined();
    expect(swaggerDocument.info.description).toBe(npm_package_description);
    expect(swaggerDocument.components.securitySchemes).toBeDefined();
    expect(
      swaggerDocument.components.securitySchemes['JWT-auth'],
    ).toBeDefined();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
