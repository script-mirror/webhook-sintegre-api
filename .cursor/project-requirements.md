`Project Requirements rules *@docs/project-requirements.md* You will use tools codebase to know what are the details of the files of this *@docs/project-requirements.md* directory files to check the project requirements and the project standards that you need to follow. This will be the guide for you to make sure you are following the project standards. So make sure to read this when planning and implementing the project to avoid duplications, conflicts, and errors. Don't touch that folder and files, you will only read it. Don't over do it to the point that you are not following the project requirements. DON'T REMOVE THIS LINE 1!!!!`

# Sintegre Webhook API

Este documento descreve o projeto de uma API que:

1. **Recebe webhooks do Sintegre** com o payload no formato JSON.
2. **Armazena os dados** recebidos em um banco de dados não relacional (MongoDB).
3. **Baixa o arquivo** indicado pela URL no payload do webhook.
4. **Armazena o arquivo** em um bucket S3 (ou serviço compatível).
5. **Disponibiliza endpoints** para:
   - Consulta dos registros de webhooks recebidos.
   - Consulta dos arquivos baixados (download).
   - Métricas de webhooks (horários, tipos, produtos, etc.).

## 1. Formato do Payload Recebido

Exemplo de payload enviado pelo webhook Sintegre:

```json
{
  "nome": "IPDO (Informativo Preliminar Diário da Operação)",
  "processo": "Operação em Tempo Real",
  "dataProduto": "20/02/2025",
  "macroProcesso": "Operação do Sistema",
  "periodicidade": "2025-02-20T00:00:00",
  "periodicidadeFinal": "2025-02-20T23:59:59",
  "url": "https://apps08.ons.org.br/ONS.Sintegre.Proxy/webhook?token=<TOKEN_EXEMPLO>"
}
```

### Campos Importantes
- **nome**: Identifica o produto/relatório (ex: "IPDO (Informativo Preliminar Diário da Operação)").
- **processo**: Ex.: "Operação em Tempo Real".
- **dataProduto**: Data de referência do produto.
- **macroProcesso**: Ex.: "Operação do Sistema".
- **periodicidade** / **periodicidadeFinal**: Indicam intervalos de datas/horas.
- **url**: URL de onde baixar o arquivo.

A partir desse payload, precisamos efetuar o download do arquivo em `url` e guardar localmente (ou temporariamente) antes de enviá-lo ao S3.

---

## 2. Funcionalidades Principais

1. **Recebimento do Webhook**  
   - Endpoint público para receber as requisições de webhook (provavelmente via método `POST`).
   - Validação mínima do payload (estrutura JSON, campos obrigatórios).
   - Registro do payload no banco (MongoDB).

2. **Download do Arquivo**  
   - Após receber o payload, o serviço faz o download do arquivo na URL indicada.
   - Armazena o arquivo em um bucket S3, utilizando metadados que permitam posterior identificação (ID do webhook, data, nome do produto, etc.).
   - Lida com cenários de falha (URL inválida, tempo de resposta excedido, etc.).

3. **Armazenamento de Dados no MongoDB**  
   - Cada webhook é salvo com:
     - `_id` gerado pelo MongoDB.
     - Dados originais do payload (nome, processo, dataProduto etc.).
     - Informações do processo de download (status, data/hora, link gerado no S3, tamanho do arquivo, etc.).
     - Timestamps (criação, atualização).

4. **APIs de Consulta**  
   - **Listar Webhooks Recebidos**: Filtros por data, tipo de produto, processo, etc.
   - **Detalhes de um Webhook**: Consulta por `_id` para retornar detalhes do registro, incluindo o link do arquivo no S3.
   - **Download de Arquivo**: Endpoint que gera um link temporário (signed URL) para o arquivo no S3, ou realiza o redirecionamento direto se apropriado.

5. **Métricas de Webhooks**  
   - Estatísticas sobre quantidade de webhooks recebidos em determinados intervalos.
   - Métricas de sucesso/falha de download.
   - Tempos médios de processamento, filtrados por:
     - Tipo ou nome do produto.
     - Intervalos de datas.
     - Outros campos relevantes (e.g., processo).

---

## 3. Arquitetura e Tecnologias

### 3.1 Servidor da API
- **Stack Sugerida**: Node.js + NestJS
- **Linguagem**: TypeScript (seguindo boas práticas de tipagem).
- **Bibliotecas**:
  - **Express** ou **Fastify**.
  - **Axios** ou **node-fetch** para download do arquivo.
  - **Mongoose** (para conectar ao MongoDB).
  - **AWS SDK** (para upload e manipulação de arquivos no S3).

### 3.2 Banco de Dados (MongoDB)
- **Coleção**: `webhooks`
  - Armazenará cada registro de webhook recebido, com campos como:
    - `nome`, `processo`, `dataProduto`, `macroProcesso`, `periodicidade`, `periodicidadeFinal`, `url`.
    - `downloadStatus`, `s3Key`, `createdAt`, `updatedAt`.
  - Índices para facilitar as consultas:
    - Por datas (`createdAt`).
    - Por nome (`nome`).
    - Por processo (`processo`).

### 3.3 Armazenamento de Arquivos (S3)
- **Bucket**: `sintegre-webhook-files` (exemplo)
- **Chaves de Acesso**: Gerenciadas via variáveis de ambiente e usuários IAM com permissões adequadas.
- **Fluxo**:
  1. Download local/temporário do arquivo usando a `url` do payload.
  2. Upload do arquivo para o S3, retornando o `key` do objeto.
  3. Armazenamento do `key` no documento do webhook (campo `s3Key`).
  4. Exclusão do arquivo temporário local.

### 3.4 Segurança e Boas Práticas
- **Conexão SSL/TLS** no endpoint de webhook.
- **Verificação de Assinatura** (opcional, caso Sintegre forneça uma chave ou token para validar a origem).
- **Rate Limiting / Throttling** para evitar sobrecarga.
- **Logs e Monitoramento** de cada etapa do processo (recebimento, download, upload).
- **Métricas** de aplicações (tempo de resposta, contagem de chamadas, etc.) usando ferramentas de observabilidade (Prometheus, Grafana, ou outro).

---

## 4. Modelo de Dados (Exemplo em TypeScript/Mongoose)

```ts
import { Schema, model, Document } from 'mongoose';

interface IWebhook extends Document {
  nome: string;
  processo: string;
  dataProduto: string;
  macroProcesso: string;
  periodicidade: string;
  periodicidadeFinal: string;
  url: string;
  downloadStatus?: string; // e.g. 'PENDING', 'SUCCESS', 'FAILED'
  s3Key?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema<IWebhook>(
  {
    nome: { type: String, required: true },
    processo: { type: String, required: true },
    dataProduto: { type: String },
    macroProcesso: { type: String },
    periodicidade: { type: String },
    periodicidadeFinal: { type: String },
    url: { type: String, required: true },
    downloadStatus: { type: String, default: 'PENDING' },
    s3Key: { type: String },
  },
  { timestamps: true }
);

export const WebhookModel = model<IWebhook>('Webhook', WebhookSchema);
```

---

## 5. Endpoints Propostos

### 5.1 Recebimento de Webhook

- **POST** `/api/webhooks/sintegre`
  - **Descrição**: Recebe o payload do Sintegre.
  - **Body (JSON)**:  
    ```json
    {
      "nome": "IPDO",
      "processo": "Operação em Tempo Real",
      "dataProduto": "...",
      "macroProcesso": "...",
      "periodicidade": "...",
      "periodicidadeFinal": "...",
      "url": "https://..."
    }
    ```
  - **Ações**:
    1. Valida o JSON.
    2. Salva no MongoDB (status `PENDING`).
    3. Retorna `201 Created` com objeto que contém o `_id`.

- **Processo de Download em Segundo Plano (Worker/Queue)**  
  - Assim que salvo, dispara-se um processo para fazer o download do arquivo em `url` e enviar ao S3.
  - Atualiza o `downloadStatus` para `SUCCESS` ou `FAILED`.

### 5.2 Listar Webhooks Recebidos

- **GET** `/api/webhooks`
  - **Query Params (opcional)**:
    - `nome`, `processo`, `dataInicio`, `dataFim`, etc.
  - **Retorno**:
    - Array de objetos com dados do webhook (sem o arquivo, apenas metadados).
    - Paginação (page, limit) caso a lista seja grande.

### 5.3 Detalhes de um Webhook

- **GET** `/api/webhooks/:id`
  - **Descrição**: Retorna os detalhes de um webhook específico, incluindo o status de download e a `s3Key`.
  - **Retorno (JSON)**:
    ```json
    {
      "_id": "...",
      "nome": "...",
      "processo": "...",
      "url": "...",
      "downloadStatus": "...",
      "s3Key": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
    ```

### 5.4 Download do Arquivo

- **GET** `/api/webhooks/:id/download`
  - **Descrição**: Gera ou retorna um link de download do arquivo armazenado no S3.
  - **Fluxo**:
    1. Busca o `s3Key` no documento do webhook.
    2. Gera um link temporário (signed URL) ou faz streaming do arquivo.
    3. Retorna o link ou inicia o download.

### 5.5 Métricas de Webhooks

- **GET** `/api/webhooks/metrics`
  - **Descrição**: Retorna estatísticas como:
    - Total de webhooks recebidos por dia/hora.
    - Tempo médio de download.
    - Contagem de webhooks por status (`PENDING`, `SUCCESS`, `FAILED`).
    - Possibilidade de filtrar por `nome`, `processo`, etc.
  - **Exemplo de Retorno**:
    ```json
    {
      "totalRecebidos": 150,
      "porDia": [
        { "data": "2025-02-20", "count": 50 },
        { "data": "2025-02-21", "count": 100 }
      ],
      "tempoMedioDownloadSegundos": 2.4,
      "distribuicaoStatus": {
        "PENDING": 10,
        "SUCCESS": 130,
        "FAILED": 10
      }
    }
    ```

---

## 6. Fluxo de Implementação (Roadmap Simplificado)

1. **Configuração do Projeto (1 dia)**
   - Inicializar repositório.
   - Definir estrutura básica (Node.js/Next.js + TypeScript).
   - Configurar Mongoose + conexão MongoDB.
   - Configurar credenciais AWS (S3).

2. **API de Recebimento e Armazenamento (2-3 dias)**
   - Criar endpoint `POST /api/webhooks/sintegre`.
   - Implementar validação mínima (Zod ou Joi).
   - Salvar payload no MongoDB.

3. **Módulo de Download e Upload (2 dias)**
   - Implementar função que recebe a `url` e faz o download do arquivo.
   - Integrar com AWS S3.
   - Atualizar `s3Key` e `downloadStatus` no MongoDB.

4. **Endpoints de Consulta (2-3 dias)**
   - GET `/api/webhooks` (listar e filtrar).
   - GET `/api/webhooks/:id` (detalhes).
   - GET `/api/webhooks/:id/download` (link ou streaming).

5. **Métricas e Relatórios (2 dias)**
   - Endpoint GET `/api/webhooks/metrics` com estatísticas agregadas.
   - Implementar consultas de agregação no MongoDB.

6. **Testes e Documentação (2 dias)**
   - Testes unitários e de integração (Jest).
   - Documentação das rotas (ex: Swagger/OpenAPI).

---

## 7. Boas Práticas de Segurança

- **Criptografia**: Acesso ao MongoDB via TLS.
- **Autenticação**: Se necessário, proteger endpoints com token ou API Key.
- **Registros de Log**: Registrar cada etapa (recebimento do webhook, resultado do download, upload ao S3).
- **Escalonamento**: Caso haja grande volume de webhooks, utilizar filas (BullMQ, RabbitMQ, SQS) para processar downloads de forma assíncrona.

---

## 8. Conclusão

Este projeto oferece uma solução completa para:

1. **Receber** webhooks do Sintegre.
2. **Salvar** o payload em MongoDB.
3. **Fazer o download** do arquivo indicado e enviá-lo ao S3.
4. **Fornecer consultas** sobre os webhooks recebidos (filtros e detalhes).
5. **Disponibilizar o arquivo** baixado (via endpoint).
6. **Exibir métricas** sobre desempenho, volume e status de processamento.

Seguindo este documento, a equipe de desenvolvimento pode implementar passo a passo a solução, garantindo confiabilidade, rastreabilidade e fácil manutenção do sistema.