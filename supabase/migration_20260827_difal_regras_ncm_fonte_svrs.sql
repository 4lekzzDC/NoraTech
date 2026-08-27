-- Adiciona 'svrs' às fontes aceitas em difal_regras_ncm.fonte.
--
-- O Portal da DIFAL (SVRS — Sefaz Virtual do Rio Grande do Sul,
-- https://dfe-portal.svrs.rs.gov.br/Difal/Aliquotas) é fonte pública oficial,
-- cobre as 27 UFs numa página estática só, sem captcha e sem Termos de Uso de
-- terceiro pago — ao contrário da Econet, cuja consulta é protegida por
-- captcha (por isso só entra por cópia manual, nunca por robô). A tela de
-- importação em src/modules/solucoes-contabeis/sistemas/difal/
-- GerenciadorRegrasNcm.jsx grava com fonte='svrs' as regras que a pessoa
-- confirmou a partir do HTML salvo do Portal.
--
-- Aplicada em produção (projeto NoraTech, arazzkhdgmgaavgirtxy) em 27/08/2026.

alter table public.difal_regras_ncm
  drop constraint difal_regras_ncm_fonte_check;

alter table public.difal_regras_ncm
  add constraint difal_regras_ncm_fonte_check
  check (fonte in ('manual', 'seed', 'econet', 'planilha', 'svrs'));
