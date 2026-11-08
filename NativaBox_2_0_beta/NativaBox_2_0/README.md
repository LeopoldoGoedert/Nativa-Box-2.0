# Nativa Box 2.1.1 — Histórico Científico

Painel de monitoramento de NATIVA-01 e NATIVA-02, com API HTTPS V1.2 para ESP32, autenticação, alertas e histórico pesquisável.

## O que mudou

- O backend agora grava **cada telemetria** em `telemetry_records` (PostgreSQL Neon), com chave única `(hive,boot_id,seq)` e índice por colmeia/hora.
- **O limite de 1.000 registros não se aplica mais ao histórico.** A lista `hives.*.records` conserva até 1.000 itens como cache recente para dashboard/alertas, mas a tabela `telemetry_records` mantém os registros independentemente.
- A primeira transação após o deploy transfere os registros ainda presentes na lista antiga para a nova tabela. O campo interno `telemetryMigrated` evita remigração.
- A tela Histórico consulta o banco para 24 h, 7, 15 e 30 dias ou um período específico de até 30 dias. O gráfico recebe até 320 amostras distribuídas no período, para manter a interface leve.
- **Exportar CSV** busca todos os registros do intervalo escolhido, em lotes de até 5.000, e monta um CSV único com dados completos, não apenas os pontos do gráfico.
- Não há rotina de exclusão automática. Dados de mais de 30 dias continuam no banco e podem ser exportados selecionando um período antigo, mas é necessário acompanhar a capacidade do plano Neon.

## IMPORTANTE: arquivamento permanente

A versão 2.1 NÃO transfere arquivos automaticamente para armazenamento externo: não existe destino de backup conectado. Para garantir histórico permanente independente do Neon, baixe e guarde os CSVs de cada colmeia **mensalmente**, idealmente com uma segunda cópia (Drive ou disco externo). Não exclua registros do banco sem confirmar a integridade dos CSVs. Backup PostgreSQL também é necessário para recuperar usuários/configurações.

## Publicação na Vercel

1. **Faça backup ou crie uma branch do Neon** antes do deploy. O banco atual deve continuar o mesmo para preservar registros e login.
2. Substitua os arquivos da aplicação do projeto `LeopoldoGoedert/Nativa-Box-2.0` no mesmo Root Directory utilizado atualmente (`NativaBox_2_0_beta/NativaBox_2_0`). Não envie `.env`, senhas nem tokens para o GitHub.
3. Confirme `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `INGEST_TOKEN` e `APP_ORIGIN` no projeto Vercel existente. **Não troque as senhas existentes** e não crie outro banco.
4. Faça commit na branch `main`; a Vercel iniciará o deploy. Aguarde `Ready`.
5. No dashboard, confira o total de registros. Deve ser pelo menos igual ao total anterior e continuar crescendo acima de 1.000.
6. Em Histórico, escolha 30 dias, visualize o gráfico e clique `Exportar CSV`; confirme linhas e datas do arquivo baixado.
7. Confira que ambos os ESP32 continuam transmitindo, sem alterar o firmware nem o `INGEST_TOKEN`.

### API

`POST /api/ingest` continua com payload V1.2, `Authorization: Bearer <INGEST_TOKEN>`.

Novas consultas autenticadas:
- `GET /api/history?hive=NATIVA-01&from=<ISO>&to=<ISO>`: dados para gráfico (até 320 pontos).
- `GET /api/export?hive=NATIVA-01&from=<ISO>&to=<ISO>&offset=0`: CSV em lotes de 5.000, usando `X-Next-Offset` para paginação. A interface faz a união automática dos lotes.

Limite por consulta: 31 dias; é possível consultar intervalos históricos anteriores, sem corte automático.

## Limitações

- Sem backup externo automático ou limpeza automática; os CSVs baixados devem ser arquivados pelo responsável.
- Limites de armazenamento, tempo de execução e tráfego dependem do Neon e Vercel contratados.
- Migração PostgreSQL e performance na Vercel ainda precisam ser confirmadas em ambiente real. Os testes executados localmente usam SQLite.
- Bateria, IR e HX711 continuam sujeitos a calibração física; peso permanece `null`.
- Som não é utilizado: não aparece no painel, nos gráficos ou nos CSVs. O backend mantém os campos legados `som_adc` e `som_pp` apenas para aceitar os firmwares V1.2 já instalados; não é necessário regravar os ESP32 por esta alteração.

## Testes

`npm test`

`node --check dist/v2.js`
