// Cálculo de totais de uma proposta — puro, sem I/O, pra dar preview
// instantâneo no editor enquanto o admin digita. O valor que de fato conta
// é recalculado do mesmo jeito no banco (admin_save_proposal, SECURITY
// DEFINER) — este arquivo existe só pra não fazer o admin esperar um
// round-trip pra ver o total mudar.

/**
 * @param {object} args
 *   items          [{ amount }] — só o campo `amount` importa aqui.
 *   discountType   'percent' | 'amount' | null
 *   discountValue  número (ou string numérica) — % ou R$, conforme o tipo.
 *   setupFee       número (ou string numérica) — implantação, somada DEPOIS do desconto.
 * @returns {{ subtotal: number, discountAmount: number, total: number }}
 */
export function calcularTotais({ items = [], discountType = null, discountValue = 0, setupFee = 0 }) {
  const subtotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round(subtotal * (Number(discountValue) || 0) / 100 * 100) / 100;
  } else if (discountType === 'amount') {
    discountAmount = Number(discountValue) || 0;
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);

  const total = Math.max(subtotal - discountAmount, 0) + (Number(setupFee) || 0);

  return { subtotal, discountAmount, total };
}
