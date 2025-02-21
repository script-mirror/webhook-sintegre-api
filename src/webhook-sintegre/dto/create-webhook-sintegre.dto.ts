import { IsString, IsDateString, IsUrl, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookSintegreDto {
  @ApiProperty({
    example: 'IPDO (Informativo Preliminar Diário da Operação)',
    description: 'Nome do produto/relatório',
  })
  @IsString()
  nome: string;

  @ApiProperty({
    example: 'Operação em Tempo Real',
    description: 'Processo relacionado',
  })
  @IsString()
  processo: string;

  @ApiProperty({
    example: '20/02/2025',
    description: 'Data de referência do produto',
  })
  @IsString()
  dataProduto: string;

  @ApiProperty({
    example: 'Operação do Sistema',
    description: 'Macro processo',
  })
  @IsString()
  macroProcesso: string;

  @ApiProperty({
    example: '2025-02-20T00:00:00',
    description: 'Data/hora inicial da periodicidade',
  })
  @IsDateString()
  periodicidade: string;

  @ApiProperty({
    example: '2025-02-20T23:59:59',
    description: 'Data/hora final da periodicidade',
  })
  @IsDateString()
  periodicidadeFinal: string;

  @ApiProperty({
    example: 'https://apps08.ons.org.br/ONS.Sintegre.Proxy/webhook?token=<TOKEN>',
    description: 'URL para download do arquivo',
  })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING',
    description: 'Status do download do arquivo',
  })
  @IsOptional()
  @IsEnum(['PENDING', 'SUCCESS', 'FAILED'])
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED';
}
