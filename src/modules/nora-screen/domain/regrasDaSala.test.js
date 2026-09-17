import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRADA,
  MOTIVOS_ENTRADA,
  REGRAS_PADRAO,
  decisaoDaEntrada,
  podeCompartilhar,
  regrasDaLinha,
  saidaObrigatoria,
} from './regrasDaSala.js';

test('sala sem linha no banco usa as regras padrão', () => {
  assert.deepEqual(regrasDaLinha(null), REGRAS_PADRAO);
  assert.deepEqual(regrasDaLinha(undefined), REGRAS_PADRAO);
});

test('linha do banco vira regras, tolerando nulos', () => {
  assert.deepEqual(
    regrasDaLinha({ entradas_bloqueadas: true, somente_host_compartilha: null, encerrada: false }),
    {
      entradasBloqueadas: true,
      somenteHostCompartilha: false,
      encerrada: false,
      maxParticipantes: null,
      admins: [],
      donoId: null,
    },
  );
});

test('somente-host barra convidado e libera o host', () => {
  const regras = { ...REGRAS_PADRAO, somenteHostCompartilha: true };
  assert.equal(podeCompartilhar({ regras, souHost: false }).motivo, 'somente-host');
  assert.ok(podeCompartilhar({ regras, souHost: true }).pode);
});

test('bloqueio individual fala mais alto que a regra geral', () => {
  // Quem foi bloqueado pelo host precisa ler o motivo certo, e não
  // "só o host compartilha", que sugeriria um impedimento diferente.
  const regras = { ...REGRAS_PADRAO, somenteHostCompartilha: true };
  assert.equal(
    podeCompartilhar({ regras, souHost: false, bloqueadoIndividualmente: true }).motivo,
    'bloqueado',
  );
});

test('sala encerrada impede compartilhar até para o host', () => {
  const regras = { ...REGRAS_PADRAO, encerrada: true };
  assert.equal(podeCompartilhar({ regras, souHost: true }).motivo, 'encerrada');
});

test('vários compartilham ao mesmo tempo: ninguém espera a vez', () => {
  // A sala deixou de ter uma vaga só de transmissão; quem chega depois
  // divide o palco em vez de ser recusado.
  assert.ok(podeCompartilhar({}).pode);
  assert.ok(podeCompartilhar({ souHost: false }).pode);
});

test('limite de participantes atravessa a linha do banco', () => {
  assert.equal(regrasDaLinha({ max_participantes: 8 }).maxParticipantes, 8);
  // Sem limite é null, e zero ou lixo também: "sala que não aceita
  // ninguém" é outra coisa, e tem nome próprio.
  assert.equal(regrasDaLinha({ max_participantes: null }).maxParticipantes, null);
  assert.equal(regrasDaLinha({ max_participantes: 0 }).maxParticipantes, null);
  assert.equal(regrasDaLinha({ max_participantes: 'abc' }).maxParticipantes, null);
  assert.deepEqual(regrasDaLinha({ admins: ['a', 'b'] }).admins, ['a', 'b']);
  assert.deepEqual(regrasDaLinha({ admins: null }).admins, []);
  // Quem é o dono também vem do banco, e não de quem se diz dono.
  assert.equal(regrasDaLinha({ dono_id: 'abc' }).donoId, 'abc');
  assert.equal(regrasDaLinha({}).donoId, null);
});

test('sala lotada é recusa do servidor, com texto próprio', () => {
  const d = decisaoDaEntrada({
    autorizado: false, motivo: 'lotada', e_host: false,
    entradas_bloqueadas: false, somente_host_compartilha: false, encerrada: false,
    max_participantes: 4,
  });
  assert.equal(d.estado, ENTRADA.RECUSADA);
  assert.equal(d.motivo, 'lotada');
  assert.equal(d.regras.maxParticipantes, 4);
  assert.equal(MOTIVOS_ENTRADA.lotada, 'Esta sala atingiu o limite de participantes.');
});

// ═══════════════════════════════════════════════════════════════
// Entrada decidida pelo servidor.
//
// O bug que estes testes prendem: "bloquear novas entradas" era uma
// conclusão que o cliente tirava sozinho lendo a linha da sala. Qualquer
// falha nessa leitura virava "tudo liberado" e a pessoa entrava. Agora a
// resposta vem julgada do banco, e ausência de resposta é recusa.
// ═══════════════════════════════════════════════════════════════

// Espelha o que a RPC nora_screen_entrar_na_sala devolve.
const respostaDoServidor = (extra) => ({
  autorizado: true,
  motivo: null,
  e_host: false,
  entradas_bloqueadas: false,
  somente_host_compartilha: false,
  encerrada: false,
  ...extra,
});

test('servidor autoriza: entrada liberada e regras vêm junto', () => {
  const d = decisaoDaEntrada(respostaDoServidor({ somente_host_compartilha: true }));
  assert.equal(d.estado, ENTRADA.AUTORIZADA);
  assert.equal(d.motivo, null);
  assert.equal(d.regras.somenteHostCompartilha, true);
});

test('servidor recusa: o motivo dele é que vale', () => {
  const d = decisaoDaEntrada(respostaDoServidor({
    autorizado: false, motivo: 'entradas-bloqueadas', entradas_bloqueadas: true,
  }));
  assert.equal(d.estado, ENTRADA.RECUSADA);
  assert.equal(d.motivo, 'entradas-bloqueadas');
});

test('sem resposta do servidor a porta fica FECHADA, não aberta', () => {
  // O coração do bug: antes, não conseguir saber caía no padrão liberado.
  for (const nada of [null, undefined, '', 0]) {
    const d = decisaoDaEntrada(nada);
    assert.equal(d.estado, ENTRADA.RECUSADA, `${JSON.stringify(nada)} deveria recusar`);
    assert.equal(d.motivo, 'indisponivel');
  }
});

test('host reconhecido pelo servidor atravessa o próprio bloqueio', () => {
  const d = decisaoDaEntrada(respostaDoServidor({ e_host: true, entradas_bloqueadas: true }));
  assert.equal(d.estado, ENTRADA.AUTORIZADA);
  assert.equal(d.eHost, true);
});

test('bloquear entradas não expulsa quem já está na sala', () => {
  const regras = { ...REGRAS_PADRAO, entradasBloqueadas: true };
  assert.equal(saidaObrigatoria({ regras }), null);
});

test('encerrar a sala tira todo mundo de dentro', () => {
  assert.equal(saidaObrigatoria({ regras: { ...REGRAS_PADRAO, encerrada: true } }), 'encerrada');
  assert.equal(saidaObrigatoria({ regras: REGRAS_PADRAO }), null);
});

test('a porta de recusa tem texto para todo motivo que o servidor devolve', () => {
  for (const motivo of ['entradas-bloqueadas', 'encerrada', 'inexistente', 'indisponivel']) {
    assert.ok(MOTIVOS_ENTRADA[motivo], `falta texto para ${motivo}`);
  }
  assert.equal(
    MOTIVOS_ENTRADA['entradas-bloqueadas'],
    'Esta sala não está aceitando novas entradas no momento.',
  );
});

// ── O cenário completo, na ordem em que acontece ──
test('host bloqueia, quem está dentro fica, quem chega é barrado, host libera, entra', () => {
  // A sala roda com as regras do servidor; cada participante é um estado.
  let regras = { ...REGRAS_PADRAO };
  const servidorResponde = ({ token } = {}) => {
    const eHost = token === 'token-do-host';
    if (regras.encerrada) {
      return respostaDoServidor({ autorizado: false, motivo: 'encerrada', encerrada: true });
    }
    if (regras.entradasBloqueadas && !eHost) {
      return respostaDoServidor({
        autorizado: false, motivo: 'entradas-bloqueadas', entradas_bloqueadas: true,
      });
    }
    return respostaDoServidor({
      autorizado: true, e_host: eHost, entradas_bloqueadas: regras.entradasBloqueadas,
    });
  };

  // 1. Ana entra com a sala livre e fica dentro.
  const ana = decisaoDaEntrada(servidorResponde());
  assert.equal(ana.estado, ENTRADA.AUTORIZADA);

  // 2. O host bloqueia novas entradas.
  regras = { ...regras, entradasBloqueadas: true };

  // 3. Ana, que já estava, continua normalmente: nada a expulsa.
  assert.equal(saidaObrigatoria({ regras }), null);

  // 4. Bruno chega agora e é recusado — pelo servidor, não pela tela.
  const bruno = decisaoDaEntrada(servidorResponde());
  assert.equal(bruno.estado, ENTRADA.RECUSADA);
  assert.equal(bruno.motivo, 'entradas-bloqueadas');

  // 4b. E o host continua entrando, mesmo com o bloqueio dele no ar.
  assert.equal(decisaoDaEntrada(servidorResponde({ token: 'token-do-host' })).estado, ENTRADA.AUTORIZADA);

  // 5. O host libera.
  regras = { ...regras, entradasBloqueadas: false };

  // 6. Bruno tenta de novo e entra.
  const brunoDeNovo = decisaoDaEntrada(servidorResponde());
  assert.equal(brunoDeNovo.estado, ENTRADA.AUTORIZADA);
  assert.equal(brunoDeNovo.motivo, null);

  // E Ana nunca foi perturbada por nada disso.
  assert.equal(saidaObrigatoria({ regras }), null);
});
