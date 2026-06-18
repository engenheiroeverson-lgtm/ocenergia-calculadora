import type { ResultadoExtracaoParcial } from '../../types/types';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarTexto(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limparNumero(valor: string): string {
  return valor.replace(/[^\d,.-]/g, '').replace(/\s+/g, '');
}

function parseNumeroBR(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  const bruto = limparNumero(valor);
  if (!bruto) return undefined;
  const negativo = bruto.startsWith('-') || (valor.includes('(') && valor.includes(')'));
  const semSinais = bruto.replace(/[()-]/g, '');
  const ultimaVirgula = semSinais.lastIndexOf(',');
  const ultimoPonto = semSinais.lastIndexOf('.');
  let normalizado = semSinais;
  if (ultimaVirgula > ultimoPonto) {
    normalizado = semSinais.replace(/\./g, '').replace(',', '.');
  } else if (ultimoPonto > ultimaVirgula) {
    normalizado = semSinais.replace(/,/g, '');
  } else {
    normalizado = semSinais.replace(/,/g, '');
  }
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return undefined;
  return negativo ? -Math.abs(numero) : numero;
}

function extrairPrimeiroNumero(
  texto: string,
  regexes: RegExp[],
): number | undefined {
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match?.[1]) {
      const n = parseNumeroBR(match[1]);
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tensão
// ─────────────────────────────────────────────────────────────────────────────

function deduzirTensaoPelosLimites(texto: string): number | undefined {
  if (/12834\s*A\s*14490|TENSAO CONTRATADA[:\s]*13800|TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*13800/i.test(texto)) return 13800;
  if (/19800\s*A\s*24200/i.test(texto)) return 22000;
  if (/9900\s*A\s*12100/i.test(texto)) return 11000;
  if (/6210\s*A\s*7590/i.test(texto)) return 6900;
  if (/2070\s*A\s*2530/i.test(texto)) return 2300;
  if (/396\s*A\s*484/i.test(texto)) return 440;
  if (/342\s*A\s*418/i.test(texto)) return 380;
  if (/198\s*A\s*242/i.test(texto)) return 220;
  if (/117\s*A\s*133|TENSAO CONTRATADA[:\s]*127|TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*127/i.test(texto)) return 127;
  return undefined;
}

function extrairTensao(texto: string): number | undefined {
  const explicita = extrairPrimeiroNumero(texto, [
    /TENSAO NOMINAL EM VOLTS\s*DISP\s*:?\s*(\d[\d.,]*)/i,
    /TENSAO CONTRATADA\s*:?\s*(\d{2,6})\b/i,
  ]);
  return explicita ?? deduzirTensaoPelosLimites(texto);
}

function somar(...valores: Array<number | undefined>): number | undefined {
  const filtrados = valores.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (!filtrados.length) return undefined;
  return filtrados.reduce((acc, atual) => acc + atual, 0);
}

function deduzirFp(
  energiaAtivaKwh?: number,
  energiaReativaKvarh?: number,
): number | undefined {
  if (
    typeof energiaAtivaKwh !== 'number' ||
    typeof energiaReativaKvarh !== 'number' ||
    energiaAtivaKwh <= 0 ||
    energiaReativaKvarh < 0
  ) return undefined;
  const fp = energiaAtivaKwh / Math.sqrt(energiaAtivaKwh ** 2 + energiaReativaKvarh ** 2);
  return fp > 0 && fp <= 1 ? fp : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de medição MT/AT
// ─────────────────────────────────────────────────────────────────────────────

function extrairEnergiaTabelaMedicao(
  texto: string,
  periodo: 'PONTA' | 'FORA PONTA',
  tipo: 'ENERGIA ATIVA' | 'ENERGIA INJETADA',
): number | undefined {
  const periodoRegex = periodo === 'PONTA' ? '(?:^|\\s)PONTA(?:\\s|$)' : 'FORA PONTA';
  const tipoRegex = tipo === 'ENERGIA ATIVA' ? 'ENERGIA ATIVA EM KWH' : 'ENERGIA INJETADA';

  const regex = new RegExp(
    `\\d{8,12}\\s+${periodoRegex}\\s+${tipoRegex}\\s+[\\d.,]+\\s+([\\d.,]+)`,
    'i',
  );

  const match = texto.match(regex);
  if (match?.[1]) {
    const n = parseNumeroBR(match[1]);
    if (typeof n === 'number' && n > 0) return n;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERE — Energia Reativa Excedente
// ─────────────────────────────────────────────────────────────────────────────

function extrairERETabelaMedicao(
  texto: string,
  periodo: 'PONTA' | 'FPONTA',
): number | undefined {
  const periodoStr = periodo === 'PONTA' ? 'PONTA' : 'FPONTA';

  const regex = new RegExp(`ERE\\s+${periodoStr}\\s+([\\d.,]+)`, 'i');

  const match = texto.match(regex);
  if (match?.[1]) {
    const n = parseNumeroBR(match[1]);
    if (typeof n === 'number' && n > 0) return n;
  }

  const fallbackRegex = periodo === 'FPONTA'
    ? /ENERGIA REATIVA EXCED(?:ENTE)?\s+EM\s+KWH?\s*-?\s*F(?:ORA\s*)?PONTA\s+([\d.,]+)/i
    : /ENERGIA REATIVA EXCED(?:ENTE)?\s+EM\s+KWH?\s*-?\s*PONTA\s+([\d.,]+)/i;

  const fallback = texto.match(fallbackRegex);
  if (fallback?.[1]) {
    const n = parseNumeroBR(fallback[1]);
    if (typeof n === 'number' && n > 1) return n;
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valor R$ de Reativa Excedente
// ─────────────────────────────────────────────────────────────────────────────

function extrairValorReativaRS(texto: string): number | undefined {
  const regexes = [
    /ENERGIA REATIVA EXCED(?:ENTE)?\s+EM\s+KWH?\s*-?\s*F(?:ORA\s*)?PONTA[^\n]{0,80}?([\d.,]+)\s*$/im,
    /ENERGIA REATIVA EXCED(?:ENTE)?\s+EM\s+KWH?\s*-?\s*PONTA[^\n]{0,80}?([\d.,]+)\s*$/im,
  ];
  const valores: number[] = [];
  for (const r of regexes) {
    const m = texto.match(r);
    if (m?.[1]) {
      const n = parseNumeroBR(m[1]);
      if (typeof n === 'number' && n > 0) valores.push(n);
    }
  }
  return valores.length ? valores.reduce((a, b) => a + b, 0) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dias faturados
// ─────────────────────────────────────────────────────────────────────────────

function extrairDiasFaturados(texto: string): number | undefined {
  return extrairPrimeiroNumero(texto, [
    /DIAS\s*(?:FATURADOS|DE\s*FORNECIMENTO|FATURAMENTO)[:\s]*(\d{1,3})/i,
    /(?:LEITURA\s*ATUAL|LEITURA\s*ANT)[^)]{0,60}DIAS[:\s]*(\d{1,3})/i,
    /\bDIAS\s*:\s*(\d{1,3})\b/i,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demandas
// ─────────────────────────────────────────────────────────────────────────────

function extrairDemandas(texto: string): {
  demandaKw: number | undefined;
  demandaPontaKw: number | undefined;
  demandaForaPontaKw: number | undefined;
  demandaTusdgKw: number | undefined;
} {
  const demandaForaPontaKw = extrairPrimeiroNumero(texto, [
    /FORA\s*PONTA\s*:\s*([\d.,]+)\s*KW/i,
    /DEMANDA\s+(?:DE\s+)?POTENCIA\s+MEDIDA\s*-?\s*F(?:ORA\s*)?PONTA\s+([\d.,]+)/i,
    /DEMANDA\s+(?:FORA\s*)?PONTA\s+([\d.,]+)/i,
  ]);

  const demandaPontaKw = extrairPrimeiroNumero(texto, [
    /KW\s*PONTA\s*:\s*([\d.,]+)/i,
    /DEMANDA\s+(?:DE\s+)?POTENCIA\s+MEDIDA\s*-?\s*PONTA\s+([\d.,]+)/i,
  ]);

  const demandaTusdgKw = extrairPrimeiroNumero(texto, [
    /TUSDG\s*:\s*([\d.,]+)/i,
    /DEMANDA\s+(?:DE\s+)?GERACAO\s+TUSDG\s+([\d.,]+)/i,
  ]);

  const demandaKw = demandaForaPontaKw ?? demandaPontaKw ?? extrairPrimeiroNumero(texto, [
    /DEMANDA\s+POTENCIA[^-\n]{0,30}([\d.,]+)/i,
    /DEMANDA\s+CONTRATADA[:\s]*([\d.,]+)/i,
  ]);

  return { demandaKw, demandaPontaKw, demandaForaPontaKw, demandaTusdgKw };
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumo BT
// ─────────────────────────────────────────────────────────────────────────────

function extrairConsumoBT(texto: string): number | undefined {
  const regex = /\d{8,12}\s+(?:PONTA|FORA\s+PONTA)?\s*ENERGIA\s+ATIVA\s+EM\s+KWH\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)/i;
  const match = texto.match(regex);
  if (match?.[1]) {
    const n = parseNumeroBR(match[1]);
    if (typeof n === 'number' && n > 0) return n;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

export function extrairDadosFaturaDoTexto(
  textoOriginal: string,
): ResultadoExtracaoParcial {
  const texto = normalizarTexto(textoOriginal);

  const tensaoV = extrairTensao(texto);
  const ehAltaTensao = typeof tensaoV === 'number' && tensaoV >= 1000;
  const diasFaturados = extrairDiasFaturados(texto);
  const { demandaKw, demandaPontaKw, demandaForaPontaKw, demandaTusdgKw } = extrairDemandas(texto);

  let energiaAtivaPontaKwh: number | undefined;
  let energiaAtivaForaPontaKwh: number | undefined;
  let energiaAtivaKwh: number | undefined;

  if (ehAltaTensao) {
    energiaAtivaPontaKwh = extrairEnergiaTabelaMedicao(texto, 'PONTA', 'ENERGIA ATIVA');
    energiaAtivaForaPontaKwh = extrairEnergiaTabelaMedicao(texto, 'FORA PONTA', 'ENERGIA ATIVA');
    energiaAtivaKwh = somar(energiaAtivaPontaKwh, energiaAtivaForaPontaKwh);
  } else {
    energiaAtivaKwh = extrairConsumoBT(texto);
    if (!energiaAtivaKwh) {
      energiaAtivaKwh = extrairPrimeiroNumero(texto, [
        /CONSUMO\s+EM\s+KWH\s+([\d.,]+)/i,
        /CONSUMO\s+KWH\s+([\d.,]+)/i,
        /CONSUMO\s+FATURADO[^\d]{0,30}([\d.,]+)/i,
      ]);
    }
  }

  const energiaReativaPontaKvarh = extrairERETabelaMedicao(texto, 'PONTA');
  const energiaReativaForaPontaKvarh = extrairERETabelaMedicao(texto, 'FPONTA');
  const energiaReativaKvarh = somar(energiaReativaPontaKvarh, energiaReativaForaPontaKvarh);

  const valorReativaRS = extrairValorReativaRS(texto);
  const fpEstimado = deduzirFp(energiaAtivaKwh, energiaReativaKvarh);

  const potenciaAtivaKw =
    demandaForaPontaKw ??
    demandaKw ??
    (typeof energiaAtivaKwh === 'number' &&
    typeof diasFaturados === 'number' &&
    diasFaturados > 0
      ? energiaAtivaKwh / (diasFaturados * 24)
      : undefined);

  const variacaoCargaPct =
    typeof demandaForaPontaKw === 'number' &&
    typeof demandaPontaKw === 'number' &&
    Math.max(demandaForaPontaKw, demandaPontaKw) > 0
      ? (Math.abs(demandaForaPontaKw - demandaPontaKw) /
          Math.max(demandaForaPontaKw, demandaPontaKw)) * 100
      : undefined;

  const camposFaltantes: string[] = [];
  if (typeof tensaoV !== 'number') camposFaltantes.push('tensaoV');
  if (typeof potenciaAtivaKw !== 'number') camposFaltantes.push('potenciaAtivaKw');
  if (typeof fpEstimado !== 'number') camposFaltantes.push('fpAtual');
  if (typeof energiaAtivaKwh !== 'number') camposFaltantes.push('energiaAtivaKwh');

  const dadosParciais = {
    tensaoV,
    potenciaAtivaKw,
    fpAtual: fpEstimado,
    energiaAtivaKwh,
    energiaReativaKvarh,
    energiaAtivaForaPontaKwh,
    energiaAtivaPontaKwh,
    energiaReativaForaPontaKvarh,
    energiaReativaPontaKvarh,
    demandaKw,
    demandaPontaKw,
    demandaForaPontaKw,
    demandaTusdgKw,
    diasFaturados,
    variacaoCargaPct,
    valorReativaRS,
    origemDados: 'fatura' as const,
  };

  const status =
    camposFaltantes.length === 0
      ? 'Dados principais identificados'
      : 'Extração parcial — complementação manual recomendada';

  const mensagem =
    camposFaltantes.length === 0
      ? 'A fatura forneceu os dados suficientes para cálculo automático.'
      : `A fatura foi lida, mas ainda faltam: ${camposFaltantes.join(', ')}.`;

  return { status, origemDados: 'fatura', mensagem, camposFaltantes, dadosParciais };
}