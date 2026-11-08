# Nativa Box 2.0 — duas colmeias

Frontend reconstruído: `dist/index.html`, `dist/v2.js`, `dist/v2.css`. Backend existente reaproveitado: `api/`, `lib/`, `dist/data.js`.

## Publicação
- Execute como projeto Vercel com **Root Directory** nesta pasta (`nativa-web`) e Output Directory `dist`.
- Configure `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `INGEST_TOKEN`, `APP_ORIGIN` em Production. `APP_ORIGIN` é a origem exata, por exemplo `https://nativa-box.vercel.app`.
- **Não inclua segredos em arquivos do GitHub nem no frontend.**
- Faça deploy em **projeto/URL de teste**, sem apontar para o Neon de produção antes de realizar backup e decidir se deseja reutilizar os dados.
- Para preservar o Neon atual em um projeto de teste, prefira criar um *branch* de banco no Neon ou uma instância de testes; evite que duas instâncias escrevam no mesmo registro `nativa_state`.
- Se o banco estiver vazio, o login inicial é criado a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 14 caracteres). Se já houver usuários, essas variáveis não redefinem senhas.

## Contrato do ESP32
`POST /api/ingest` com cabeçalho `Authorization: Bearer <INGEST_TOKEN>` e payload V1.2. O ESP32 **não** deve conectar diretamente ao PostgreSQL. NATIVA-02 deve estar ativada em Administração antes do teste.

## Limitações atuais
- UI mostra apenas NATIVA-01 e NATIVA-02; estrutura do banco ainda contém 4 IDs por compatibilidade com dados existentes.
- Peso permanece `null` até calibração do HX711.
- Bateria e contagem IR precisam de validação física.
- Banco legado retém 1.000 medições por colmeia. Para histórico de longo prazo, migrar para tabela de telemetria com armazenamento por registro.
- A configuração usa token de ingestão compartilhado para todas as estações; rotacionar o token exige atualizar todos os ESP32 ativos.
- Não foi realizada validação ponta a ponta na Vercel neste ambiente.

## Testes
`npm test` executa testes do backend. `node --check dist/v2.js` valida a sintaxe JS do novo frontend.
## Status da implantação

Nativa Box 2.0 — primeira implantação na Vercel.
