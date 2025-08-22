import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

export function createSwaggerDocument(
  app: NestFastifyApplication,
): OpenAPIObject {
  const {
    npm_package_name,
    npm_package_version,
    npm_package_description,
    NODE_ENV = 'development',
    SWAGGER_AUTO_GENERATE = false,
  } = process.env;
  const config = new DocumentBuilder()
    .setTitle(npm_package_name)
    .setDescription(npm_package_description)
    .setVersion(npm_package_version)
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-cognito-token',
        description: 'Enter x-cognito-token',
        in: 'header',
      },
      'COGNITO_AUTH',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  if (NODE_ENV === 'development' && SWAGGER_AUTO_GENERATE === 'true') {
    fs.mkdirSync(`./docs`, { recursive: true });
    fs.writeFileSync(`./docs/openapi.json`, JSON.stringify(document));
  }

  return document;
}
