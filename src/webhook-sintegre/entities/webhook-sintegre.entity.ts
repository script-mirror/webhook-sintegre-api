import { Document } from 'mongoose';

export interface WebhookSintegre extends Document {
  nome: string;
  processo: string;
  dataProduto: string;
  macroProcesso: string;
  periodicidade: string;
  periodicidadeFinal: string;
  url: string;
  downloadStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  s3Key?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
