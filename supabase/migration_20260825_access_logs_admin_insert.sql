-- A trilha de auditoria do painel admin nunca gravou nada sobre outro usuário.
--
-- O SINTOMA: abrir "Gerenciar usuário" → "Logs de acesso" para qualquer
-- pessoa mostra "Nenhum log encontrado", inclusive para quem o admin já
-- gerenciou várias vezes. A tela ainda sugeria criar a tabela `access_logs`,
-- que existe desde sempre e tem linhas.
--
-- A CAUSA: a policy de INSERT era
--
--     with check (user_id = auth.uid())
--
-- e `logAccess()` grava com `user_id = targetUserId`, ou seja o usuário SOBRE
-- o qual se agiu — é o desenho documentado da função, e é o que faz sentido
-- para uma trilha "o que aconteceu com esta conta". Quando o admin mexe em
-- outra pessoa, `targetUserId <> auth.uid()`, a policy recusa, e o cliente do
-- Supabase devolve `{ error }` em vez de lançar. O `logAccess` antigo não
-- olhava esse retorno: a recusa sumia sem log, sem aviso, sem nada.
--
-- O resultado ficou visível nos dados: as 32 linhas da tabela pertencem todas
-- ao id do ÚNICO admin do projeto. São exatamente os casos em que ele agiu
-- sobre a própria conta e o `user_id` coincidiu com o `auth.uid()`. Todo o
-- resto foi recusado em silêncio.
--
-- A CORREÇÃO: quem já pode LER a trilha de qualquer usuário também precisa
-- poder ESCREVER nela. As policies de SELECT já usam exatamente este
-- predicado de admin; o INSERT ficou para trás.

begin;

drop policy if exists "System can insert access logs" on public.access_logs;

create policy "Usuário registra o próprio acesso, admin registra o de qualquer um"
  on public.access_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.can_access_admin = true)
    )
  );

-- Duas policies de SELECT idênticas, palavra por palavra ("Admins can read
-- access logs" e "Admins can view all access logs"). Policy é OR: manter as
-- duas não amplia nem restringe nada, só duplica a superfície a auditar
-- quando alguém for entender quem enxerga o quê.
drop policy if exists "Admins can view all access logs" on public.access_logs;

commit;

-- NOTA sobre o que esta trilha vale como prova, e que nenhuma policy resolve:
-- `access_logs` é escrita PELO NAVEGADOR. Qualquer usuário autenticado pode
-- inserir linhas para si mesmo com o `action` que quiser, e agora um admin
-- pode inserir para qualquer um. Isso serve como registro operacional — o que
-- o painel fez —, não como evidência contra quem tem acesso ao sistema.
--
-- Uma trilha que sirva de prova precisa ser escrita pelo servidor, onde o ator
-- não escolhe o que fica registrado. A RPC `register_access_log` já existe e
-- vai nessa direção (é SECURITY DEFINER e força `auth.uid()`), mas hoje não é
-- chamada de lugar nenhum — ver a observação sobre login não registrado.
