-- NoraDocs — tira "cliente" das palavras-chave de Contas a receber.
--
-- A palavra aparece em praticamente qualquer texto de documento ou corpo de
-- e-mail, então ela não distingue categoria nenhuma: só garante que "Contas a
-- receber" vença sempre que houver texto corrido.
--
-- Foi o que aconteceu com uma DANFE anexada a um aviso de entrega: o corpo do
-- e-mail dizia "cliente", e a nota fiscal foi arquivada como conta a receber.
--
-- As demais palavras da categoria ("receber", "recebimento", "faturamento")
-- continuam, e essas de fato indicam o assunto.

update public.noradocs_categories
set keywords = array_remove(keywords, 'cliente')
where slug = 'contas-a-receber'
  and 'cliente' = any(keywords);
