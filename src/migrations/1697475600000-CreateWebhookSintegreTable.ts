import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookSintegreTable1697475600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_sintegre',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: '(UUID())',
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'processo',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'dataProduto',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'macroProcesso',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'periodicidade',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'periodicidadeFinal',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'downloadStatus',
            type: 'enum',
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'PROCESSED'],
            default: '"PENDING"',
          },
          {
            name: 's3Key',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'retryHistory',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'nextRetryAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex('webhook_sintegre', 
      new TableIndex({
        name: 'IDX_WEBHOOK_SINTEGRE_NOME',
        columnNames: ['nome'],
      }),
    );
    
    await queryRunner.createIndex('webhook_sintegre', 
      new TableIndex({
        name: 'IDX_WEBHOOK_SINTEGRE_STATUS',
        columnNames: ['downloadStatus'],
      }),
    );
    
    await queryRunner.createIndex('webhook_sintegre', 
      new TableIndex({
        name: 'IDX_WEBHOOK_SINTEGRE_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_sintegre');
  }
}
