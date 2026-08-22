-- NoraDocs — tira "recebimento" das palavras-chave de Contas a receber.
--
-- Toda DANFE/NF-e traz, no canhoto de confirmação de entrega, a frase "Data
-- de Recebimento" — texto padrão do documento, não indício de que o arquivo
-- é uma conta a receber. Como o motor de classificação escolhe a
-- palavra-chave mais LONGA entre as que casam, "recebimento" (11 caracteres)
-- vencia até "danfe" (5) e "nota fiscal" (11, empate resolvido pela ordem
-- das categorias) sempre que o texto do PDF chegava a ser lido — foi
-- exatamente o que aconteceu com a primeira DANFE reclassificada pela leitura
-- de PDF pós-upload: categorizada como "Contas a receber" com "DANFE"
-- cadastrada e presente no texto.
--
-- "receber" e "faturamento" continuam — não fazem parte do texto padrão de
-- nota fiscal nenhuma.

update public.noradocs_categories
set keywords = array_remove(keywords, 'recebimento')
where slug = 'contas-a-receber'
  and 'recebimento' = any(keywords);
