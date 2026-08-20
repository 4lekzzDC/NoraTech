/**
 * NoraDocs — complemento do Gmail.
 *
 * Abre no painel lateral do e-mail aberto e arquiva os anexos direto no Drive
 * do escritório, já na pasta certa.
 *
 * O que este arquivo NÃO faz, e é o ponto:
 *
 *   - não lê a caixa de entrada. O escopo é
 *     `gmail.addons.current.message.readonly`, que só enxerga a mensagem que o
 *     contador abriu, e só enquanto o painel está em execução. Não há
 *     monitoramento, não há varredura, não existe "ler todos os e-mails".
 *   - não pede escopo do Drive. Os bytes vão para uma URL de sessão de uso
 *     único que o NoraDocs emite — ela já vem autorizada para aquele arquivo
 *     naquela pasta e para mais nada.
 *   - não decide nada. Classificação, destino e cadastro são do servidor. Aqui
 *     só se lê o anexo, calcula-se o hash e reporta-se o resultado.
 *
 * Instalação e implantação em docs/noradocs/complemento-gmail.md.
 */

// ── Configuração ─────────────────────────────────────────────────────────
// Trocar pela URL do projeto Supabase do NoraDocs.
var NORADOCS_URL = 'https://arazzkhdgmgaavgirtxy.supabase.co/functions/v1/noradocs-inbound';

// Onde fica o token de entrada. UserProperties, não ScriptProperties: cada
// pessoa do escritório cola o seu, e revogar o de uma não derruba as outras.
var CHAVE_TOKEN = 'noradocs_token';

// O Gmail não entrega anexo acima disto, mas um e-mail encaminhado com um
// arquivo do Drive pode declarar mais. Recusar antes de ler os bytes evita
// estourar a memória do Apps Script.
var TAMANHO_MAXIMO = 25 * 1024 * 1024;


// ── Gatilhos ─────────────────────────────────────────────────────────────

function aoAbrirInicio() {
  return cartaoDeConfiguracao(
    'O NoraDocs arquiva os anexos dos e-mails na pasta certa do Drive do '
    + 'escritório. Abra um e-mail para começar.'
  );
}

function aoAbrirMensagem(e) {
  if (!token()) {
    return cartaoDeConfiguracao('Cole o token de entrada gerado em Configurações do NoraDocs.');
  }

  var mensagem = mensagemAtual(e);
  var anexos = anexosDe(mensagem);

  if (!anexos.length) {
    return cartaoSimples('Sem anexos', 'Este e-mail não tem arquivos para arquivar.');
  }

  var secao = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      '<b>De:</b> ' + escapar(mensagem.getFrom())
    ));

  // Checkboxes marcadas por padrão: o caso comum é arquivar tudo. Desmarcar o
  // que não interessa (a imagem de assinatura que escapou do filtro) é menos
  // trabalho do que marcar cinco anexos um a um.
  var selecao = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName('anexos');

  for (var i = 0; i < anexos.length; i++) {
    var a = anexos[i];
    // getSize(), não getBytes().length: ler o conteúdo de cada anexo só
    // para exibir o tamanho gastaria memória e segundos por nada.
    selecao.addItem(a.getName() + '  (' + tamanhoLegivel(a.getSize()) + ')', String(i), true);
  }
  secao.addWidget(selecao);

  secao.addWidget(CardService.newTextButton()
    .setText('Arquivar no NoraDocs')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction()
      .setFunctionName('aoArquivar')
      .setParameters({ messageId: e.gmail.messageId, accessToken: e.gmail.accessToken })));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('NoraDocs'))
    .addSection(secao)
    .build();
}


// ── Ação principal ───────────────────────────────────────────────────────

function aoArquivar(e) {
  // Checkbox com várias marcações chega em `formInputs` (plural). O
  // `formInput` singular só carrega um valor, e usá-lo faria o complemento
  // arquivar um anexo e ignorar os outros em silêncio.
  var escolhidos = (e.formInputs && e.formInputs.anexos)
    || (e.formInput && e.formInput.anexos)
    || [];
  if (!Array.isArray(escolhidos)) escolhidos = [escolhidos];
  if (!escolhidos.length) return notificar('Nenhum anexo selecionado.');

  var mensagem = mensagemAtual({ gmail: e.parameters });
  var anexos = anexosDe(mensagem);

  var contexto = {
    remetente: emailDe(mensagem.getFrom()),
    remetenteNome: nomeDe(mensagem.getFrom()),
    assunto: mensagem.getSubject() || '',
    recebidoEm: mensagem.getDate().toISOString(),
    // O corpo vai como texto puro e serve a um propósito só: achar um CNPJ que
    // não esteja no nome do arquivo. Cortado curto porque assinatura, aviso de
    // confidencialidade e histórico de resposta não ajudam em nada.
    texto: (mensagem.getPlainBody() || '').slice(0, 4000)
  };

  var linhas = [];
  var falhas = 0;

  for (var i = 0; i < escolhidos.length; i++) {
    var anexo = anexos[Number(escolhidos[i])];
    if (!anexo) continue;
    var r = arquivarAnexo(anexo, contexto);
    linhas.push(r.linha);
    if (!r.ok) falhas++;
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(cartaoDeResultado(linhas)))
    .setNotification(CardService.newNotification().setText(
      falhas ? falhas + ' de ' + linhas.length + ' não foram arquivados.'
             : linhas.length + ' arquivado(s).'
    ))
    .build();
}

/**
 * Três passos, na ordem que o servidor espera: preparar (classifica e devolve
 * a URL de upload), enviar os bytes, concluir (registra que chegaram).
 *
 * Uma falha no envio é REPORTADA ao servidor, não engolida. Sem o `concluir`
 * com erro, o documento ficaria "processando" para sempre e o contador veria
 * uma linha travada sem explicação na caixa de entrada.
 */
function arquivarAnexo(anexo, contexto) {
  var nome = anexo.getName();

  // O tamanho é conferido ANTES de materializar o conteúdo: um anexo grande
  // demais derrubaria o Apps Script por memória antes de chegar à mensagem de
  // erro que explica o motivo.
  if (anexo.getSize() > TAMANHO_MAXIMO) {
    return { ok: false, linha: '✕ ' + nome + ' — maior que 25 MB.' };
  }
  var bytes = anexo.getBytes();

  var preparo;
  try {
    preparo = chamar('preparar', {
      fileName: nome,
      mimeType: anexo.getContentType() || 'application/octet-stream',
      sizeBytes: bytes.length,
      contentHash: sha256Hex(bytes),
      remetente: contexto.remetente,
      remetenteNome: contexto.remetenteNome,
      assunto: contexto.assunto,
      texto: contexto.texto,
      recebidoEm: contexto.recebidoEm
    });
  } catch (err) {
    return { ok: false, linha: '✕ ' + nome + ' — ' + err.message };
  }

  if (preparo.duplicado) {
    // Não é falha: reencaminhar o mesmo anexo é comum, e o produto está certo
    // em recusar. Dizer onde ele já está é o que evita a busca manual.
    return { ok: true, linha: '• ' + nome + ' — ' + preparo.mensagem };
  }

  var envio = UrlFetchApp.fetch(preparo.uploadUrl, {
    method: 'put',
    contentType: anexo.getContentType() || 'application/octet-stream',
    payload: bytes,
    muteHttpExceptions: true
  });

  if (envio.getResponseCode() >= 300) {
    var detalhe = 'O Google recusou o envio (' + envio.getResponseCode() + ').';
    try { chamar('concluir', { documentId: preparo.documentId, erro: detalhe }); } catch (ignora) { /* já falhou */ }
    return { ok: false, linha: '✕ ' + nome + ' — ' + detalhe };
  }

  var criado = {};
  try { criado = JSON.parse(envio.getContentText()); } catch (ignora) { /* resposta sem corpo */ }

  var fim;
  try {
    fim = chamar('concluir', {
      documentId: preparo.documentId,
      driveFileId: criado.id || '',
      webViewLink: criado.webViewLink || ''
    });
  } catch (err) {
    return { ok: false, linha: '✕ ' + nome + ' — enviado, mas o registro falhou: ' + err.message };
  }

  var onde = fim.destino || (preparo.cliente ? preparo.cliente.nome : 'triagem');
  var marca = fim.status === 'organizado' ? '✓' : '⚠';
  var nota = fim.status === 'organizado' ? '' : ' (aguarda revisão)';
  return { ok: true, linha: marca + ' ' + nome + ' → ' + onde + nota };
}


// ── Comunicação com o NoraDocs ───────────────────────────────────────────

function chamar(acao, corpo) {
  corpo.action = acao;
  var resposta = UrlFetchApp.fetch(NORADOCS_URL, {
    method: 'post',
    contentType: 'application/json',
    // Cabeçalho próprio: este token não é um JWT do Supabase, e mandá-lo em
    // Authorization convidaria a confusão com a sessão do navegador.
    headers: { 'X-NoraDocs-Token': token() },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true
  });

  var texto = resposta.getContentText();
  var dados;
  try { dados = JSON.parse(texto); } catch (e) { dados = {}; }

  if (resposta.getResponseCode() >= 300) {
    throw new Error(dados.error || ('erro ' + resposta.getResponseCode()));
  }
  if (dados.error) throw new Error(dados.error);
  return dados;
}


// ── Token ────────────────────────────────────────────────────────────────

function token() {
  return PropertiesService.getUserProperties().getProperty(CHAVE_TOKEN) || '';
}

function aoSalvarToken(e) {
  var valor = ((e.formInput && e.formInput.token) || '').trim();
  if (valor.indexOf('ndin_') !== 0) {
    return notificar('O token deve começar com "ndin_". Gere um em Configurações do NoraDocs.');
  }
  PropertiesService.getUserProperties().setProperty(CHAVE_TOKEN, valor);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Token salvo. Abra um e-mail com anexo.'))
    .setNavigation(CardService.newNavigation().updateCard(cartaoDeConfiguracao('Token salvo.')))
    .build();
}

function aoApagarToken() {
  PropertiesService.getUserProperties().deleteProperty(CHAVE_TOKEN);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Token removido deste dispositivo.'))
    .setNavigation(CardService.newNavigation().updateCard(cartaoDeConfiguracao('Cole um token para conectar.')))
    .build();
}


// ── Cartões ──────────────────────────────────────────────────────────────

function cartaoDeConfiguracao(explicacao) {
  var atual = token();
  var secao = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(escapar(explicacao)));

  if (atual) {
    // Só o começo e o fim. Mostrar o token inteiro numa tela que alguém pode
    // estar compartilhando não tem serventia nenhuma — quem precisa dele já
    // o colou.
    secao.addWidget(CardService.newDecoratedText()
      .setTopLabel('Conectado com')
      .setText(atual.slice(0, 10) + '…' + atual.slice(-4)));
    secao.addWidget(CardService.newTextButton()
      .setText('Desconectar')
      .setOnClickAction(CardService.newAction().setFunctionName('aoApagarToken')));
  } else {
    secao.addWidget(CardService.newTextInput()
      .setFieldName('token')
      .setTitle('Token de entrada')
      .setHint('Começa com ndin_'));
    secao.addWidget(CardService.newTextButton()
      .setText('Conectar')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName('aoSalvarToken')));
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('NoraDocs'))
    .addSection(secao)
    .build();
}

function cartaoDeResultado(linhas) {
  var secao = CardService.newCardSection();
  for (var i = 0; i < linhas.length; i++) {
    secao.addWidget(CardService.newTextParagraph().setText(escapar(linhas[i])));
  }
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Resultado'))
    .addSection(secao)
    .build();
}

function cartaoSimples(titulo, texto) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(titulo))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(escapar(texto))))
    .build();
}

function notificar(texto) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(texto))
    .build();
}


// ── Utilidades ───────────────────────────────────────────────────────────

function mensagemAtual(e) {
  // Sem este token o GmailApp não enxerga a mensagem: o escopo do complemento
  // não dá acesso à caixa, só à mensagem aberta, e é este token que representa
  // essa permissão momentânea.
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return GmailApp.getMessageById(e.gmail.messageId);
}

function anexosDe(mensagem) {
  // Imagens embutidas fora: logotipo de assinatura e ícone de rede social são
  // anexo para o Gmail, e arquivá-los encheria o Drive do escritório de lixo.
  return mensagem.getAttachments({ includeInlineImages: false, includeAttachments: true });
}

function sha256Hex(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    // Os bytes do Apps Script são com sinal (-128..127); sem o & 0xFF, todo
    // byte acima de 127 vira um hexadecimal negativo e o hash não bate com o
    // que o servidor calcula.
    var b = (digest[i] & 0xFF).toString(16);
    hex += b.length === 1 ? '0' + b : b;
  }
  return hex;
}

function emailDe(remetente) {
  var m = /<([^>]+)>/.exec(remetente || '');
  return (m ? m[1] : (remetente || '')).trim().toLowerCase();
}

function nomeDe(remetente) {
  var m = /^\s*"?([^"<]*?)"?\s*</.exec(remetente || '');
  return m ? m[1].trim() : '';
}

function tamanhoLegivel(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// Os cartões aceitam um subconjunto de HTML. Nome de arquivo e assunto vêm de
// fora e podem conter '<' — sem escapar, o cartão quebra ou some com o texto.
function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
