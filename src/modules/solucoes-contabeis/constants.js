// Identidade do módulo "Soluções Contábeis" dentro do produto NoraTech.
//
// O slug canônico é `solucoes-contabeis`. Por compatibilidade com assinaturas
// criadas antes do renomeio, `acompanhamento-contabil` continua sendo aceito
// pela RLS do Supabase e pelo SystemsGrid da área do cliente — ver
// supabase/accounting_schema.sql (função has_accounting_access).

export const SOLUCOES_CONTABEIS_SLUG = 'solucoes-contabeis';
export const SOLUCOES_CONTABEIS_LEGACY_SLUGS = ['acompanhamento-contabil'];
export const SOLUCOES_CONTABEIS_ROUTE = '/solucoes-contabeis';
export const SOLUCOES_CONTABEIS_LEGACY_ROUTE = '/acompanhamento-contabil';
export const SOLUCOES_CONTABEIS_NAME = 'Soluções Contábeis';
