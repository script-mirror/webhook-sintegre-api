import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('webhook_sintegre')
export class WebhookSintegre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 255 })
  processo: string;

  @Column({ type: 'varchar', length: 255 })
  dataProduto: string;

  @Column({ type: 'varchar', length: 255 })
  macroProcesso: string;

  @Column({ type: 'varchar', length: 255 })
  periodicidade: string;

  @Column({ type: 'varchar', length: 255 })
  periodicidadeFinal: string;

  @Column({ type: 'text' })
  url: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'PROCESSED'],
    default: 'PENDING',
  })
  downloadStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSED';

  @Column({ type: 'varchar', length: 500, nullable: true })
  s3Key?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'json', nullable: true })
  retryHistory: Date[];

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
