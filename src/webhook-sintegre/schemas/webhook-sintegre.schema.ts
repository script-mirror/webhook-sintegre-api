import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookSintegreDocument = WebhookSintegre & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class WebhookSintegre {
  id: string;

  @Prop({ required: true })
  nome: string;

  @Prop({ required: true })
  processo: string;

  @Prop({ required: true })
  dataProduto: string;

  @Prop({ required: true })
  macroProcesso: string;

  @Prop({ required: true })
  periodicidade: string;

  @Prop({ required: true })
  periodicidadeFinal: string;

  @Prop({ required: true })
  url: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING',
  })
  downloadStatus: 'PENDING' | 'SUCCESS' | 'FAILED';

  @Prop()
  s3Key?: string;

  @Prop()
  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const WebhookSintegreSchema = 
  SchemaFactory.createForClass(WebhookSintegre); 