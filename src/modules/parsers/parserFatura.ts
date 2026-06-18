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

  const negativo =
    bruto.startsWith('-') || (valor.includes('(') && valor.includes(')'));

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
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
        return n;
      }
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
  ) {
    return undefined;
  }

  const fp =
    energiaAtivaKwh /
    Math.sqrt(energiaAtivaKwh ** 2 + energiaReativaKvarh ** 2);

  return fp > 0 && fp <= 1 ? fp : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tensão por limites
// ─────────────────────────────────────────────────────────────────────────────

function deduzirTensaoPelosLimites(texto: string): number | undefined {
  if (
    /LIM\.?\s*MIN\.?\s*:?\s*12\.?834/i.test(texto) ||
    /12834\s*A\s*14490/i.test(texto) ||
    /TENSAO CONTRATADA[:\s]*13800/i.test(texto) ||
    /TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*13800/i.test(texto)
  ) return 13800;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*19\.?800/i.test(texto) ||
    /19800\s*A\s*24200/i.test(texto)
  ) return 22000;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*9\.?900/i.test(texto) ||
    /9900\s*A\s*12100/i.test(texto)
  ) return 11000;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*6\.?210/i.test(texto) ||
    /6210\s*A\s*7590/i.test(texto)
  ) return 6900;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*2\.?070/i.test(texto) ||
    /2070\s*A\s*2530/i.test(texto)
  ) return 2300;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*396/i.test(texto) ||
    /396\s*A\s*484/i.test(texto)
  ) return 440;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*342/i.test(texto) ||
    /342\s*A\s*418/i.test(texto)
  ) return 380;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*198/i.test(texto) ||
    /198\s*A\s*242/i.test(texto)
  ) return 220;

  if (
    /LIM\.?\s*MIN\.?\s*:?\s*117/i.test(texto) ||
    /117\s*A\s*133/i.test(texto) ||
    /TENSAO CONTRATADA\s*127/i.test(texto) ||
    /TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*127/i.test(texto)
  ) return 127;

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
// Consumo BT em linha de medição
// ─────────────────────────────────────────────────────────────────────────────

function extrairConsumoBT(texto: string): number | undefined {
  const padroes = [
    /[A-Z0-9]{3,}\s+PONTA\s+ENERGIA ATIVA EM KWH\s+\d+\s+(\d+(?:[.,]\d+)?)\s+\d+\s+\d+/i,
    /PONTA\s+ENERGIA ATIVA EM KWH\s+\d+\s+(\d+(?:[.,]\d+)?)\s+\d+\s+\d+/i,
    /CONSUMO EM KWH\s+(\d{3,7}(?:[.,]\d{2})?)\b/i,
    /CONSUMO KWH\s+(\d{3,7}(?:[.,]\d{2})?)\b/i,
  ];

  for (const regex of padroes) {
    const match = texto.match(regex);
    if (match?.[1]) {
      const n = parseNumeroBR(match[1]);
      if (typeof n === 'number' && n > 0) return n;
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Energia MT pela tabela de medição (página 2)
// ─────────────────────────────────────────────────────────────────────────────

function extrairEnergiaMTTabelaMedicao(
  texto: string,
  tipo: 'FORA PONTA' | 'PONTA',
): number | undefined {
  const regex = new RegExp(
    `[A-Z0-9]{3,}\\s+${tipo}\\s+ENERGIA ATIVA EM KWH\\s+\\d+\\s+(\\d[\\d.,]+)\\s+\\d[\\d.,]+\\s+\\d[\\d.,]+`,
    'i',
  );

  const match = texto.match(regex);
  if (match?.[1]) {
    const n = parseNumeroBR(match[1]);
    if (typeof n === 'number' && n > 0) return n;
  }

  const regex2 = new RegExp(
    `${tipo}\\s+ENERGIA ATIVA EM KWH\\s+\\d+\\s+(\\d[\\d.,]+)\\s+\\d[\\d.,]+\\s+\\d[\\d.,]+`,
    'i',
  );

  const match2 = texto.match(regex2);
  if (match2?.[1]) {
    const n = parseNumeroBR(match2[1]);
    if (typeof n === 'number' && n > 0) return n;
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Energia reativa MT pela tabela de medição (página 2)
// ─────────────────────────────────────────────────────────────────────────────

function extrairReativaMTTabelaMedicao(
  texto: string,
  tipo: 'FPONTA' | 'PONTA',
): number | undefined {
  if (tipo === 'FPONTA') {
    const padroes = [
      /ERE\s+FPONTA\s+([\d.,]+)/i,
      /ERE\s+F\s*PONTA\s+([\d.,]+)/i,
      /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*FPONTA[\s\S]{0,200}?(\d{1,5}[.,]\d{2,3})\b/i,
      /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*FORA\s*PONTA[\s\S]{0,200}?(\d{1,5}[.,]\d{2,3})\b/i,
      /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*F\s*PONTA[\s\S]{0,200}?(\d{1,5}[.,]\d{2,3})\b/i,
    ];

    for (const regex of padroes) {
      const match = texto.match(regex);
      if (match?.[1]) {
        const n = parseNumeroBR(match[1]);
        if (typeof n === 'number' && n > 0) return n;
      }
    }
  }

  if (tipo === 'PONTA') {
    const padroes = [
      /ERE\s+PONTA\s+([\d.,]+)/i,
      /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*PONTA[\s\S]{0,200}?(\d{1,5}[.,]\d{2,3})\b/i,
    ];

    for (const regex of padroes) {
      const match = texto.match(regex);
      if (match?.[1]) {
        const n = parseNumeroBR(match[1]);
        if (typeof n === 'number' && n > 0) return n;
      }
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extração de valor R$ de ERE na página 1
// ─────────────────────────────────────────────────────────────────────────────

function extrairValorReativaRS(texto: string): number | undefined {
  const padroes = [
    /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*FPONTA\s+[\d.,]+\s+([\d.,]+)/i,
    /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s*-\s*FORA\s*PONTA\s+[\d.,]+\s+([\d.,]+)/i,
    /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s+[\d.,]+\s+([\d.,]+)/i,
  ];

  let total = 0;
  let encontrou = false;

  for (const regex of padroes) {
    const matches = [...texto.matchAll(new RegExp(regex.source, 'gi'))];
    for (const match of matches) {
      if (match[1]) {
        const n = parseNumeroBR(match[1]);
        if (typeof n === 'number' && n > 0) {
          total += n;
          encontrou = true;
        }
      }
    }
    if (encontrou) break;
  }

  return encontrou ? total : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extração principal
// ─────────────────────────────────────────────────────────────────────────────

export function extrairDadosFaturaDoTexto(
  textoBruto: string,
): ResultadoExtracaoParcial {
  const texto = normalizarTexto(textoBruto);

  // ── Tensão ────────────────────────────────────────────────────────────────
  const tensaoV = extrairTensao(texto);

  // ── Dias faturados ───────────────────────────────────────────────────────
  const diasFaturados = extrairPrimeiroNumero(texto, [
    /DIAS\s*:\s*(\d{1,3})\b/i,
    /N[ºO]\s*DIAS\s*FAT\s*:?\s*(\d{1,3})\b/i,
    /DIAS\s+FAT\s+(\d{1,3})\b/i,
  ]);

  // ── Energia ativa fora ponta ─────────────────────────────────────────────
  const energiaAtivaForaPontaKwh =
    extrairEnergiaMTTabelaMedicao(texto, 'FORA PONTA') ??
    extrairPrimeiroNumero(texto, [
      /CONSUMO EM KWH\s*-\s*FORA\s*PONTA\s[\s\S]{0,300}?\b(\d{5,6}[.,]\d{2,3})\b/i,
      /CONSUMO EM KWH\s*-\s*FPONTA\s[\s\S]{0,300}?\b(\d{5,6}[.,]\d{2,3})\b/i,
      /CONSUMO EM KWH\s*-\s*F\s*PONTA\s[\s\S]{0,300}?\b(\d{5,6}[.,]\d{2,3})\b/i,
    ]);

  // ── Energia ativa ponta ──────────────────────────────────────────────────
  const energiaAtivaPontaKwh =
    extrairEnergiaMTTabelaMedicao(texto, 'PONTA') ??
    extrairPrimeiroNumero(texto, [
      /CONSUMO EM KWH\s*-\s*PONTA\s[\s\S]{0,300}?\b(\d{4,6}[.,]\d{2,3})\b/i,
    ]);

  // ── Consumo BT ───────────────────────────────────────────────────────────
  const consumoBT =
    energiaAtivaForaPontaKwh == null ? extrairConsumoBT(texto) : undefined;

  // ── Energia reativa fora ponta ───────────────────────────────────────────
  const energiaReativaForaPontaKvarh = extrairReativaMTTabelaMedicao(texto, 'FPONTA');

  // ── Energia reativa ponta ────────────────────────────────────────────────
  const energiaReativaPontaKvarh = extrairReativaMTTabelaMedicao(texto, 'PONTA');

  // ── Energia reativa única ────────────────────────────────────────────────
  const energiaReativaUnica =
    energiaReativaForaPontaKvarh == null && energiaReativaPontaKvarh == null
      ? extrairPrimeiroNumero(texto, [
          /ENERGIA REATIVA EXCED(?:ENTE)?\s*EM\s*KWH\s[\s\S]{0,400}?(\d{1,5}[.,]\d{2,3})/i,
        ])
      : undefined;

  // ── Valor R$ de reativa cobrada na fatura ────────────────────────────────
  const valorReativaRS = extrairValorReativaRS(texto);

  // ── Demandas ─────────────────────────────────────────────────────────────
  const demandaForaPontaKw = extrairPrimeiroNumero(texto, [
    /FORA PONTA\s*:\s*(\d{1,4})\b/i,
    /DEMANDA DE POTENCIA MEDIDA\s*-\s*F(?:ORA)?\s*PONTA\s[\s\S]{0,400}?(\d{1,4}(?:[.,]\d{1,3})?)\s/i,
    /DEMANDA FORA PONTA\s*[-:]\s*KW[\s\S]{0,200}?(\d{1,4})\b/i,
  ]);

  const demandaPontaKw = extrairPrimeiroNumero(texto, [
    /KW\s*PONTA\s*:\s*(\d{1,4})\b/i,
    /DEMANDA PONTA\s*-\s*KW[\s\S]{0,200}?(\d{1,4})\b/i,
    /DEMANDA DE POTENCIA NAO CONSUMIDA\s*-\s*F\s*PONTA[\s\S]{0,200}?(\d{1,4})\b/i,
  ]);

  const demandaTusdgKw = extrairPrimeiroNumero(texto, [
    /TUSDG\s*:\s*(\d{1,4})\b/i,
    /DEMANDA TUSDG\s*-\s*KW[\s\S]{0,200}?(\d{1,4})\b/i,
    /KWTG\s*:\s*(\d{1,4})\b/i,
    /DEMANDA DE GERACAO\s*TUSDG[\s\S]{0,200}?(\d{1,4})\b/i,
  ]);

  // ── Energia ativa total ──────────────────────────────────────────────────
  const energiaAtivaTotal = somar(energiaAtivaForaPontaKwh, energiaAtivaPontaKwh);

  const energiaAtivaKwh =
    energiaAtivaTotal ??
    consumoBT ??
    extrairPrimeiroNumero(texto, [
      /CONSUMO FATURADO[\s\S]{0,200}?(\d{3,7}(?:[.,]\d{2})?)\b/i,
      /CONSUMO KWH[\s\S]{0,200}?(\d{3,7}(?:[.,]\d{2})?)\b/i,
    ]);

  // ── Energia reativa total ────────────────────────────────────────────────
  const energiaReativaKvarh =
    somar(energiaReativaForaPontaKvarh, energiaReativaPontaKvarh) ??
    energiaReativaUnica;

  // ── FP estimado ──────────────────────────────────────────────────────────
  const fpEstimado = deduzirFp(energiaAtivaKwh, energiaReativaKvarh);

  // ── Demanda consolidada ─────────────────────────────────────────────────
  const demandaKw = demandaForaPontaKw ?? demandaPontaKw ?? demandaTusdgKw;

  // ── Potência ativa ───────────────────────────────────────────────────────
  const potenciaAtivaKw =
    demandaForaPontaKw ??
    demandaKw ??
    (typeof energiaAtivaKwh === 'number' &&
    typeof diasFaturados === 'number' &&
    diasFaturados > 0
      ? energiaAtivaKwh / (diasFaturados * 24)
      : undefined);

  // ── Variação de carga ────────────────────────────────────────────────────
  const variacaoCargaPct =
    typeof demandaForaPontaKw === 'number' &&
    typeof demandaPontaKw === 'number' &&
    Math.max(demandaForaPontaKw, demandaPontaKw) > 0
      ? (Math.abs(demandaForaPontaKw - demandaPontaKw) /
          Math.max(demandaForaPontaKw, demandaPontaKw)) *
        100
      : undefined;

  // ── Campos faltantes ────────────────────────────────────────────────────
  const camposFaltantes: string[] = [];
  if (typeof tensaoV !== 'number') camposFaltantes.push('tensaoV');
  if (typeof potenciaAtivaKw !== 'number') camposFaltantes.push('potenciaAtivaKw');
  if (typeof fpEstimado !== 'number') camposFaltantes.push('fpAtual');
  if (typeof energiaAtivaKwh !== 'number') camposFaltantes.push('energiaAtivaKwh');

  // ── Resultado ─────────────────────────────────────────────────────────────
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