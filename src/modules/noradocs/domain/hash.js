// Hash SHA-256 do conteúdo do arquivo, calculado no navegador.
//
// Serve à deduplicação: o mesmo documento enviado duas vezes (o cliente
// reenvia "porque não tinha certeza se foi") é detectado e sinalizado, em vez
// de virar dois arquivos no Drive. O índice único parcial em
// (tenant_company_id, content_hash) é quem impõe isso no banco.
//
// Roda sobre os bytes, não sobre o nome: renomear o arquivo não engana.

export async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
