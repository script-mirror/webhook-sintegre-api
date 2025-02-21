import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { WebhookSintegreService } from './webhook-sintegre.service';
import { CreateWebhookSintegreDto } from './dto/create-webhook-sintegre.dto';
import { UpdateWebhookSintegreDto } from './dto/update-webhook-sintegre.dto';
import { AuthUser } from '@raizen-energy/nestjs-cognito';

@Controller('webhook-sintegre')
export class WebhookSintegreController {
  constructor(private readonly service: WebhookSintegreService) {}

  @Post()
  create(
    @Body() createWebhookSintegreDto: CreateWebhookSintegreDto,
    @AuthUser() user,
  ) {
    // Logs JWT payload, if user is authenticated
    console.log({ user });
    return this.service.create(createWebhookSintegreDto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWebhookSintegreDto: UpdateWebhookSintegreDto,
  ) {
    return this.service.update(+id, updateWebhookSintegreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
