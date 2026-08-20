-- NoraDocs — fecha o buraco entre a trilha "append-only" e o que o banco
-- realmente impedia.
--
-- noradocs_events e noradocs_classification_runs foram criadas sem policy de
-- update nem de delete, de propósito: a trilha só cresce, e é ela que
-- responde "por que este arquivo foi parar aqui?" semanas depois.
--
-- Só que noradocs_documents tinha uma policy `for all`, e events.document_id
-- é `on delete cascade`. Ou seja: qualquer membro podia apagar o documento e
-- levar a trilha inteira junto — pela porta dos fundos, sem nunca tocar na
-- tabela protegida. A garantia existia no comentário, não no banco.
--
-- O produto nunca apagou documento: descartar é uma mudança de status
-- ('descartado'), reversível e registrada como evento. Então tirar o delete
-- não remove nenhuma capacidade em uso — só para de conceder uma que
-- contradiz a auditabilidade.
--
-- Quem precisar mesmo remover (offboarding do escritório) continua tendo o
-- caminho: apagar a company cascateia tudo, e isso é service_role.

drop policy if exists "noradocs_documents_access" on public.noradocs_documents;

create policy "noradocs_documents_read"
  on public.noradocs_documents for select
  using (public.has_noradocs_access(tenant_company_id));

create policy "noradocs_documents_insert"
  on public.noradocs_documents for insert
  with check (public.has_noradocs_access(tenant_company_id));

create policy "noradocs_documents_update"
  on public.noradocs_documents for update
  using (public.has_noradocs_access(tenant_company_id))
  with check (public.has_noradocs_access(tenant_company_id));

-- (sem policy de delete, intencionalmente — ver acima)

comment on table public.noradocs_documents is
  'Documentos recebidos. Sem policy de DELETE: remover um documento apagaria '
  'em cascata a trilha em noradocs_events. Para tirar da frente, use o status '
  'descartado.';
