// Validação de CNPJ e CPF por dígito verificador. Módulo puro — sem React,
// sem DOM, sem rede.
//
// Existe porque o CNPJ é o sinal MAIS FORTE de identificação de cliente no
// motor de regras (Etapa 5): achar "12.345.678/0001-90" no texto de um PDF e
// casar com o cadastro é uma decisão determinística e auditável. Um cadastro
// com dígito errado envenena essa cadeia inteira em silêncio — por isso a
// validação acontece na entrada, não na hora de classificar.

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

// Rejeita repetição (00000000000000, 11111111111111...): passam na conta dos
// dígitos verificadores, mas nunca são documentos reais.
function isRepeated(digits) {
  return /^(\d)\1+$/.test(digits);
}

function dvFromWeights(digits, weights) {
  const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCNPJ(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || isRepeated(d)) return false;

  const dv1 = dvFromWeights(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = dvFromWeights(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

export function isValidCPF(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || isRepeated(d)) return false;

  // O CPF usa pesos decrescentes e trata resto 10 como zero — regra diferente
  // da do CNPJ, daí não reaproveitar dvFromWeights aqui.
  const dv = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatCNPJ(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (!d) return '';
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatCPF(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return '';
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
