-- NoraDocs — coluna para a pasta "_descartados" no Drive.
--
-- Descartar uma revisão só marcava o documento como 'descartado' no banco; o
-- arquivo continuava parado em _triagem (ou _verificação) no Drive, como se
-- ainda estivesse esperando alguém decidir. Passa a existir uma quarta pasta
-- de trabalho, irmã de _triagem e _verificação, e o botão "descartar" move o
-- arquivo para lá — sai da vista de quem está arquivando, sem apagar nada.
--
-- Mesmo padrão de drive_verificacao_folder_id: coluna opcional, criada sob
-- demanda na primeira vez que alguém descarta algo, para não obrigar quem já
-- conectou o Drive a reconfigurar a conexão.

alter table public.noradocs_settings
  add column if not exists drive_descartados_folder_id text;
