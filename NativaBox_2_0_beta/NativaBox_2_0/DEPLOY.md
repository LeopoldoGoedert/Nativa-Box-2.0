# Nativa Box / Honey Monitor · GitHub e Vercel

Base recuperada: painel publicado `nativa-box-painel`, versão 1. Esta cópia preserva USB, importação, gráficos e histórico local. O site anterior não foi alterado. Novo monitor no topo, quatro colmeias e rotas `#colmeia/NATIVA-01` a `04`.

## Rodar agora sem hardware

Node.js 24. Na pasta deste arquivo:

```powershell
npm ci
npm test
npm start
```

Abra http://127.0.0.1:8787 e escolha **Abrir simulador · dados fictícios**. Sem senha ou banco externo para simular. Dados fictícios ficam só na memória da aba, perdem-se ao recarregar e nunca vão à ingestão real. Selecione cada colmeia e use os botões normal, bateria baixa, temperatura alta/baixa, perda de comunicação e sensor ausente. O cenário de perda de comunicação retrocede a recepção fictícia; não desconecta qualquer equipamento.

Para testar contas e ingestão local, copie `.env.example` para `.env.local`, preencha ADMIN_EMAIL, ADMIN_PASSWORD com senha exclusiva de pelo menos 14 caracteres, INGEST_TOKEN e CRON_SECRET com valores aleatórios longos. Deixe DATABASE_URL vazio: somente localmente será usado SQLite em `work/nativa.sqlite`. Reinicie o servidor. A primeira autenticação cria o administrador definido no ambiente. Alterar ADMIN_PASSWORD depois disso não altera a conta existente. A administração permite criar/atualizar/desativar outras contas; não permite alterar a própria conta. Não há recuperação de senha por e-mail nesta versão.

## GitHub

Crie um repositório privado vazio, por exemplo `nativa-box`. Envie **o conteúdo desta pasta**, incluindo `api/`, `lib/`, `dist/`, `tests/`, `examples/`, `package.json`, `package-lock.json`, `vercel.json` e `.gitignore`.

```powershell
git init
git add .
git commit -m "Recupera painel Nativa Box e adiciona monitor e automacoes"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/nativa-box.git
git push -u origin main
```

Substitua SEU_USUARIO. Segredos, SQLite, caches e node_modules estão ignorados. A pasta `dist` contém fontes HTML/JS/CSS e precisa estar versionada. O workflow incluído executa os testes nos pushes e pull requests. O Git não precisa de tokens Vercel para deploy via integração nativa.

## Vercel e banco persistente

1. Vercel → Add New → Project → importar o repositório. Framework: **Other**. Root Directory: pasta que contém este arquivo. Output Directory: **dist**. Sem build customizado. Node.js **24.x**. A instalação usa o lockfile. As rotas `api/[route].js` são Functions Node.
2. Adicione **Neon PostgreSQL** pela seção Storage/Marketplace do projeto. Selecione região próxima da aplicação. Guarde DATABASE_URL somente nas variáveis de ambiente do servidor.
3. Configure DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, INGEST_TOKEN, CRON_SECRET. Use segredos distintos gerados por um gerenciador de senhas; não cole os valores em chat, no código ou no GitHub.
4. Faça o primeiro deploy, copie a origem HTTPS exata (sem barra final) para APP_ORIGIN e faça redeploy. Exemplo de formato: `https://seu-projeto.vercel.app`. Defina também a origem correta para cada ambiente de preview que quiser usar. Não abra o CORS para qualquer origem.
5. Entre no painel. O banco cria a tabela `nativa_state` automaticamente, numa transação. Apenas NATIVA-01 começa ativada. Ative as demais quando forem necessárias. Configure os limiares e habilite avisos após validar os valores.
6. Push em branch gera preview; push na branch de produção publica pela integração Git da Vercel. Use banco e segredos separados nos previews, sem apontar simuladores ou testes para produção.

O backend recusa inicialização persistente na Vercel sem DATABASE_URL: não usa armazenamento efêmero como histórico. A transação PostgreSQL bloqueia a linha de estado durante leitura/modificação para evitar colisões entre Functions. Esta implementação inicial guarda até 1.000 pacotes e 1.000 eventos por colmeia; não é um arquivo histórico ilimitado. Em intervalo de 10 s, 1.000 pacotes cobrem aproximadamente 2 h 47 min, não sete dias. Filtros mostram apenas o que ainda está retido. Para semanas/meses, migrar leituras para tabela própria com paginação e política de retenção antes do uso contínuo.

## Endpoint para o receptor/gateway

`POST https://SEU_DOMINIO/api/ingest`

Headers: `Content-Type: application/json` e `Authorization: Bearer <INGEST_TOKEN>`.

Corpo: exemplos em `examples/`. São **fixtures sintéticas**, não medições reais. Não envie esses arquivos ao ambiente de produção. `simulated:false` demonstra o contrato exigido pelo endpoint real; o simulador da interface nunca chama esse endpoint.

O gateway precisa acrescentar `hive`, `bootId` e `simulated:false` ao pacote LoRa original. **bootId deve identificar o boot do transmissor**, persistindo nas retransmissões e mudando quando a sequência reiniciar. Um boot ID só do gateway não detecta reinício independente do transmissor; isso precisará ser resolvido no firmware ou pelo gateway antes da integração. Não invente identificadores de colmeia com base apenas no RSSI. Em caso de dúvida de origem, rejeite o pacote.

`receivedAt` é gerado pelo servidor e usado no timeout. `measuredAt` é opcional, ISO UTC, aceito até 24 h atrás e no máximo 60 s à frente; ausente permanece null. O gráfico identifica horário de recepção, sem fingir saber a hora da medição. Duplicatas `(hive, bootId, seq)` retidas retornam `{duplicate:true}`; sequência menor no mesmo boot é rejeitada. O endpoint retorna 401 sem token, 400 para envelope inválido e 409 para colmeia não ativada. Campos massa_g são forçados a null enquanto não houver calibração validada. Leituras ausentes não viram zero. Status 1/2 invalida o sensor; códigos 3/4 preservam valores brutos e caráter experimental do firmware V1.2.

O sketch Wi-Fi anterior ainda precisa ser adaptado e testado para HTTPS com validação de certificado e este envelope. Nenhuma conexão física ou teste de rádio foi feito nesta etapa.

## Automações

- Eventos e alarmes: bateria baixa, temperatura interna baixa/alta, falta de comunicação. Histerese, intervalo mínimo e silêncio por até sete dias, por colmeia. Ausência de sensor não normaliza falsamente um alarme. Colmeia nunca vista fica aguardando o primeiro pacote.
- Limiares iniciais são exemplos de engenharia, não prescrições biológicas nem valores aprovados para a bateria instalada. Avisos vêm desativados no ambiente real. Simulador os ativa para demonstrar o fluxo.
- Sem porcentagem de bateria, sem conversão para dB, sem inferir direção/quantidade de abelhas pelo IR. Peso e tendências de peso bloqueados até calibração e validação. Não há comandos enviados a atuadores ou hardware.
- Cada ingestão verifica a respectiva colmeia; consulta autenticada do painel verifica todas as ativadas. Os avisos aparecem na lista de eventos, com repetição limitada e marca de silêncio.
- Para detectar perda de comunicação **com o navegador fechado**, agende `GET /api/cron` com `Authorization: Bearer <CRON_SECRET>`. Proteja esse segredo. O endpoint existe; um agendador frequente NÃO está ativado no pacote.
- No Vercel Hobby, Cron permite frequência diária, inadequada para detectar perdas em minutos. Em plano com frequência compatível, acrescente ao `vercel.json`: `"crons":[{"path":"/api/cron","schedule":"* * * * *"}]`. Um intervalo de um minuto implica atraso adicional aproximado de até um minuto, sem garantia de tempo exato. Confira limites e custo do plano antes de habilitar. Alternativa: scheduler externo autenticado compatível com o plano.
- **Não há envio externo de e-mail, SMS, push ou WhatsApp.** Esses canais exigem provedor, destinatários e teste de entrega; o campo `notify` significa aviso elegível no painel, não entrega externa concluída.

## Verificação e limites

Execute `npm test`: validações do payload, null/zero, CSV, lacunas, histerese, silêncio, perda de comunicação, autenticação, perfis, idempotência e ingestão. A prévia permite navegar sem equipamento. PostgreSQL e deploy na Vercel exigem criar e conectar os serviços: testes locais não comprovam a integração com uma conta real.

O estado local da interface anterior continua separado do backend. CSV da colmeia exporta todos os registros retidos da colmeia; no simulador respeita o filtro de período e usa fonte SIMULADO. O CSV legado pode conter massa bruta previamente importada, sem validação; não use esse campo para tomar decisões. Sessões duram 8 h; cookies HttpOnly/SameSite e Secure na Vercel. Senhas usam scrypt; token de gateway é separado da sessão de usuários. Login limita tentativas por conta em janela de 15 minutos. Para uso público, acrescente limitação por IP no perímetro, monitoramento e backups do PostgreSQL.

Referências: https://vercel.com/docs/git · https://vercel.com/docs/cron-jobs/usage-and-pricing · https://neon.com/docs/serverless/serverless-driver
