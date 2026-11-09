# Nativa Box 2.1 — roteiro de implantação segura

**Não é necessário trocar nenhum firmware do ESP32.** O protocolo V1.2 e a URL da API continuam iguais.

1. Confirmar que NATIVA-01 e NATIVA-02 estão online no dashboard atual.
2. Obter backup/branch de recuperação no Neon `neon-aqua-lens` antes de alterar o backend em produção.
3. Atualizar os arquivos na mesma pasta raiz conectada à Vercel: `NativaBox_2_0_beta/NativaBox_2_0`.
4. Garantir que o projeto aponta para o **banco atual da Nativa Box 2.0** via `DATABASE_URL`, não para banco antigo e nem para um novo vazio.
5. Fazer commit `Nativa Box 2.1 - historico 30 dias` em `main`.
6. Após `Ready`, testar login e envio normal. A tabela `telemetry_records` e o índice são criados no primeiro acesso transacional; os registros até então existentes no JSON são migrados uma vez.
7. Confirmar contagem do dashboard e consulta de 30 dias. Exportar arquivo CSV para cada colmeia, salvá-lo em dois locais e testar a leitura.
8. Para consultar dados anteriores a 30 dias, usar Histórico → Datas específicas e exportar períodos de até 30 dias.

**Retenção:** registros históricos não são excluídos automaticamente. Isso evita perda de dados se a exportação falhar, mas consome armazenamento do Neon. Planejar arquivamento externo automatizado e política de exclusão apenas depois de configurar e verificar o destino dos arquivos.

**Rollback:** restaurar o commit anterior em `main` ou repromover a implantação anterior. A nova tabela é independente da estrutura de login e não deve ser apagada; leituras recebidas durante a versão 2.1 podem permanecer somente nela caso seja feito rollback para 2.0.

**Atenção:** o teste automatizado utiliza SQLite local. A criação da tabela e a migração devem ser validadas no Neon com backup disponível.
