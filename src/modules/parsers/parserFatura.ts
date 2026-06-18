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
// Tensão
// ─────────────────────────────────────────────────────────────────────────────

function deduzirTensaoPelosLimites(texto: string): number | undefined {
  if (/12834\s*[aA]\s*14490|TENSAO CONTRATADA[:\s]*13800|TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*13800/i.test(texto)) return 13800;
  if (/19800\s*[aA]\s*24200/i.test(texto)) return 22000;
  if (/9900\s*[aA]\s*12100/i.test(texto)) return 11000;
  if (/6210\s*[aA]\s*7590/i.test(texto)) return 6900;
  if (/2070\s*[aA]\s*2530/i.test(texto)) return 2300;
  if (/396\s*[aA]\s*484/i.test(texto)) return 440;
  if (/342\s*[aA]\s*418/i.test(texto)) return 380;
  if (/198\s*[aA]\s*242/i.test(texto)) return 220;
  if (/117\s*[aA]\s*133|TENSAO CONTRATADA[:\s]*127|TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*127/i.test(texto)) return 127;
  return undefined;
}

function extrairTensao(texto: string): number | undefined {
  const tensaoExplicita = extrairPrimeiroNumero(texto, [
    /TENSAO NOMINAL EM VOLTS\s*DISP\s*:?\s*(\d[\d.,]*)/i,
    /TENSAO CONTRATADA\s*:?\s*(\d{2,6})\b/i,
  ]);
  return tensaoExplicita ?? deduzirTensaoPelosLimites(texto);
}

// ─────────────────────────────────────────────────────────────────────────────
// TABELA DE MEDIÇÃO — padrão Energisa MT
// ─────────────────────────────────────────────────────────────────────────────

function extrairEnergiaTabelaMedicao(
  texto: string,
  tipo: 'PONTA' | 'FORA PONTA',
  campo: 'ENERGIA ATIVA' | 'ENERGIA INJETADA' | 'ERE',
): number | undefined {

  let descricao: string;
  if (campo === 'ENERGIA ATIVA') descricao = 'ENERGIA ATIVA EM KWH';
  else if (campo === 'ENERGIA INJETADA') descricao = 'ENERGIA INJETADA';
  else descricao = 'ERE';

  const tipoRegex = tipo === 'FORA PONTA' ? 'FORA\\s*PONTA' : 'PONTA';

  // Com código de medidor (MT/AT)
  const r1 = new RegExp(
    `[A-Z0-9]{5,}\\s+${tipoRegex}\\s+${descricao}\\s+(\\d+)\\s+([\\d.,]+)\\s+[\\d.,]+\\s+[\\d.,]+`,
    'i',
  );

  // Sem código de medidor
  const r2 = new RegExp(
    `${tipoRegex}\\s+${descricao}\\s+(\\d+)\\s+([\\d.,]+)\\s+[\\d.,]+\\s+[\\d.,]+`,
    'i',
  );

  for (const regex of [r1, r2]) {
    const match = texto.match(regex);
    if (match?.[2]) {
      const constante = parseNumeroBR(match[1]);
      const valorBruto = parseNumeroBR(match[2]);
      if (
        typeof valorBruto === 'number' &&
        valorBruto > 0 &&
        typeof constante === 'number' &&
        constante >= 1
      ) {
        return valorBruto;
      }
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reativa excedente (ERE) da TABELA DE MEDIÇÃO (página 2)
// ─────────────────────────────────────────────────────────────────────────────

function extrairERETabelaMedicao(
  texto: string,
  tipo: 'PONTA' | 'FPONTA',
): number | undefined {
  const tipoStr = tipo === 'FPONTA' ? 'FPONTA' : 'PONTA(?!\\s*F)';

  const regexes: RegExp[] = [
    new RegExp(`ERE\\s+${tipoStr}\\s+([\\d.,]+)`, 'i'),
    new RegExp(`ENERGIA REATIVA EXCED(?:ENTE)?\\s+(?:EM\\s+KWH\\s+-\\s+)?${tipo === 'FPONTA' ? 'F(?:ORA)?\\s*PONTA' : 'PONTA(?!\\s*F)'}[^\\d]*?([\\d.,]{3,})`, 'i'),
  ];

  for (const regex of regexes) {
    const matches = [...texto.matchAll(new RegExp(regex.source, 'gi'))];
    for (const match of matches) {
      if (match?.[1]) {
        const n = parseNumeroBR(match[1]);
        if (typeof n === 'number' && n > 0 && n < 999999) return n;
      }
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumo BT (linha de medição simples)
// ─────────────────────────────────────────────────────────────────────────────

function extrairConsumoBT(texto: string): number | undefined {
  const padroes: RegExp[] = [
    /[A-Z0-9]{5,}\s+PONTA\s+ENERGIA ATIVA EM KWH\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s+\d+\s+\d+/i,
    /PONTA\s+ENERGIA ATIVA EM KWH\s+(\d+)\s+(\d+(?:[.,]\d+)?)\s+\d+\s+\d+/i,
    /CONSUMO EM KWH\s+(\d{3,7}(?:[.,]\d{2})?)\b/i,
    /CONSUMO KWH\s+(\d{3,7}(?:[.,]\d{2})?)\b/i,
  ];

  for (const regex of padroes) {
    const match = texto.match(regex);
    if (match) {
      const valorIdx = match.length >= 3 ? 2 : 1;
      const n = parseNumeroBR(match[valorIdx]);
      if (typeof n === 'number' && n > 0) return n;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valor R$ de cobrança de reativa
// ─────────────────────────────────────────────────────────────────────────────

function extrairValorReativaRS(texto: string): number | undefined {
  const regexFPonta = /ENERGIA REATIVA EXCED(?:ENTE)?\s+(?:EM\\s+KWH\\s+-\\s+)?F(?:ORA)?\s*PONTA[^\d\n]{0,30}([\d.,]{4,})/gi;
  const regexPonta = /ENERGIA REATIVA EXCED(?:ENTE)?\s+(?:EM\\s+KWH\\s+-\\s+)?PONTA(?!\s*F)[^\d\n]{0,30}([\d.,]{4,})/gi;

  const valores: number[] = [];

  for (const regex of [regexFPonta, regexPonta]) {
    const matches = [...texto.matchAll(regex)];
    for (const match of matches) {
      if (match?.[1]) {
        const n = parseNumeroBR(match[1]);
        if (typeof n === 'number' && n > 0 && n < 100000) valores.push(n);
      }
    }
  }

  if (!valores.length) return undefined;
  return valores.reduce((a, b) => a + b, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demandas
// ─────────────────────────────────────────────────────────────────────────────

function extrairDemandas(texto: string): {
  demandaKw?: number;
  demandaPontaKw?: number;
  demandaForaPontaKw?: number;
  demandaTusdgKw?: number;
} {
  const demandaForaPontaP2 = extrairPrimeiroNumero(texto, [
    /FORA\s*PONTA\s*:\s*([\d.,]+)\s*KW/i,
    /DEMANDA\s+(?:DE\s+)?POT[EÊ]NCIA\s+MEDIDA\s*-?\s*FORA\s*PONTA[^\d]{0,20}([\d.,]+)/i,
    /DEMANDA\s+FORA\s*PONTA[^\d]{0,20}([\d.,]+)/i,
  ]);

  const demandaPontaP2 = extrairPrimeiroNumero(texto, [
    /KW\s*PONTA\s*:\s*([\d.,]+)/i,
    /DEMANDA\s+(?:PONTA|KW\s+PONTA)[^\d]{0,20}([\d.,]+)/i,
  ]);

  const demandaTusdg = extrairPrimeiroNumero(texto, [
    /TUSDG\s*:\s*([\d.,]+)/i,
    /DEMANDA\s+TUSDG[^\d]{0,20}([\d.,]+)/i,
    /DEMANDA\s+(?:DE\s+)?GERA[CÇ][AÃ]O\s+TUSDG[^\d]{0,20}([\d.,]+)/i,
  ]);

  const grandezas = texto.match(
    /GRANDEZAS\s+CONTRATADAS[\s\S]{0,200}?(\d[\d.,]+)\s*[\n\r]/i,
  );
  const demandaContratada = grandezas ? parseNumeroBR(grandezas[1]) : undefined;

  const demandaForaPontaKw = demandaForaPontaP2;
  const demandaPontaKw = demandaPontaP2;
  const demandaKw =
    demandaForaPontaKw ??
    (typeof demandaContratada === 'number' && demandaContratada > 0
      ? demandaContratada
      : undefined);

  return { demandaKw, demandaPontaKw, demandaForaPontaKw, demandaTusdgKw: demandaTusdg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dias faturados
// ─────────────────────────────────────────────────────────────────────────────

function extrairDiasFaturados(texto: string): number | undefined {
  return extrairPrimeiroNumero(texto, [
    /DIAS\s*:\s*(\d{2,3})/i,
    /N[UÚ]MERO\s+DE\s+DIAS\s*:?\s*(\d{2,3})/i,
    /\bDIAS\s+FAT(?:URADOS)?\s*(\d{2,3})/i,
  ]);
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

  const { demandaKw, demandaPontaKw, demandaForaPontaKw, demandaTusdgKw } =
    extrairDemandas(texto);

  let energiaAtivaPontaKwh: number | undefined;
  let energiaAtivaForaPontaKwh: number | undefined;

  if (ehAltaTensao) {
    energiaAtivaPontaKwh = extrairEnergiaTabelaMedicao(texto, 'PONTA', 'ENERGIA ATIVA');
    energiaAtivaForaPontaKwh = extrairEnergiaTabelaMedicao(texto, 'FORA PONTA', 'ENERGIA ATIVA');
  }

  let energiaAtivaKwh: number | undefined;

  if (ehAltaTensao) {
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
          Math.max(demandaForaPontaKw, demandaPontaKw)) *
        100
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

  return {
    status,
    origemDados: 'fatura',
    mensagem,
    camposFaltantes,
    dadosParciais,
  };
}