import type { ResultadoExtracaoParcial } from '../../types/types';

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

function limparNumeroTexto(valor: string): string {
  return valor.replace(/[^\d,.-]/g, '').replace(/\s+/g, '');
}

function parseNumeroBR(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  const bruto = limparNumeroTexto(valor);
  if (!bruto) return undefined;

  // Correção da Regex inválida: Validação via métodos nativos de string para parênteses
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

function somar(...valores: Array<number | undefined>): number | undefined {
  const filtrados = valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!filtrados.length) return undefined;
  return filtrados.reduce((acc, atual) => acc + atual, 0);
}

function extrairPrimeiroNumero(texto: string, regexes: RegExp[]): number | undefined {
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match?.[1]) {
      const n = parseNumeroBR(match[1]);
      if (typeof n === 'number') return n;
    }
  }
  return undefined;
}

function deduzirFp(energiaAtivaKwh?: number, energiaReativaKvarh?: number): number | undefined {
  if (typeof energiaAtivaKwh !== 'number' || typeof energiaReativaKvarh !== 'number' || energiaAtivaKwh <= 0) {
    return undefined;
  }
  return energiaAtivaKwh / Math.sqrt(energiaAtivaKwh ** 2 + energiaReativaKvarh ** 2);
}

export function extrairDadosFaturaDoTexto(textoBruto: string): ResultadoExtracaoParcial {
  const texto = normalizarTexto(textoBruto);

  const tensaoV = extrairPrimeiroNumero(texto, [
    /TENSAO NOMINAL EM VOLTS\s*DISP[:\s]*([0-9][0-9\.\,]*)/i,
    /TENSAO CONTRATADA[:\s]*([0-9][0-9\.\,]*)/i,
    /DISP[:\s]*([0-9]{3,6})\b/i,
  ]);

  const diasFaturados = extrairPrimeiroNumero(texto, [
    /\bDIAS[:\s]*([0-9]{1,3})\b/i,
    /\bN[ºO]\s*DIAS\s*FAT[:\s]*([0-9]{1,3})\b/i,
  ]);

  const energiaAtivaForaPontaKwh = extrairPrimeiroNumero(texto, [
    /CONSUMO EM KWH\s*-\s*FORA PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /CONSUMO EM KWH\s*-\s*FPONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /CONSUMO EM KWH\s*-\s*F PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ENERGIA ATIVA EM KWH\s*-\s*FORA PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /FORA PONTA[\s\S]{0,120}?ENERGIA ATIVA EM KWH[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
  ]);

  const energiaAtivaPontaKwh = extrairPrimeiroNumero(texto, [
    /CONSUMO EM KWH\s*-\s*PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ENERGIA ATIVA EM KWH\s*-\s*PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /PONTA[\s\S]{0,120}?ENERGIA ATIVA EM KWH[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
  ]);

  const energiaReativaForaPontaKvarh = extrairPrimeiroNumero(texto, [
    /ENERGIA REATIVA EXCED(?:ENTE)? EM KWH\s*-\s*FORA PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ENERGIA REATIVA EXCED(?:ENTE)? EM KWH\s*-\s*FPONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ENERGIA REATIVA EXCED(?:ENTE)? EM KWH\s*-\s*F PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ERE[\s\S]{0,40}FPONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /FORA PONTA[\s\S]{0,120}?ERE[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
  ]);

  const energiaReativaPontaKvarh = extrairPrimeiroNumero(texto, [
    /ENERGIA REATIVA EXCED(?:ENTE)? EM KWH\s*-\s*PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /ERE[\s\S]{0,40}PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /PONTA[\s\S]{0,120}?ENERGIA REATIVA EXCED(?:ENTE)?[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
  ]);

  const demandaForaPontaKw = extrairPrimeiroNumero(texto, [
    /DEMANDA DE POTENCIA MEDIDA\s*-\s*FORA PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /DEMANDA FORA PONTA[:\s]*([0-9][0-9\.\,]*)/i,
    /FORA PONTA[:\s]*([0-9][0-9\.\,]*)\s*KW/i,
  ]);

  const demandaPontaKw = extrairPrimeiroNumero(texto, [
    /DEMANDA PONTA\s*-\s*KW[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /DEMANDA DE POTENCIA NAO CONSUMIDA\s*-\s*F PONTA[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /DEMANDA PONTA[:\s]*([0-9][0-9\.\,]*)/i,
  ]);

  const demandaTusdgKw = extrairPrimeiroNumero(texto, [
    /DEMANDA TUSDG\s*-\s*KW[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    /KWTG[:\s]*([0-9][0-9\.\,]*)/i,
    /DEMANDA DE GERACAO TUSDG[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
  ]);

  const energiaAtivaTotalKwh = somar(energiaAtivaForaPontaKwh, energiaAtivaPontaKwh);
  const energiaReativaTotalKvarh = somar(energiaReativaForaPontaKvarh, energiaReativaPontaKvarh);

  const energiaAtivaKwh =
    energiaAtivaTotalKwh ??
    extrairPrimeiroNumero(texto, [
      /CONSUMO FATURADO[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
      /\bTOTAL\s*:\s*([0-9][0-9\.\,]*)\b/i,
    ]);

  const energiaReativaKvarh =
    energiaReativaTotalKvarh ??
    extrairPrimeiroNumero(texto, [
      /\bERE\b[\s\S]{0,120}?([0-9][0-9\.\,]*)/i,
    ]);

  const fpEstimado = deduzirFp(energiaAtivaKwh, energiaReativaKvarh);
  const demandaKw = demandaForaPontaKw ?? demandaPontaKw ?? demandaTusdgKw;

  const potenciaAtivaKw =
    demandaForaPontaKw ??
    demandaKw ??
    (typeof energiaAtivaKwh === 'number' && typeof diasFaturados === 'number' && diasFaturados > 0
      ? energiaAtivaKwh / (diasFaturados * 24)
      : undefined);

  const variacaoCargaPct =
    typeof demandaForaPontaKw === 'number' && typeof demandaPontaKw === 'number' && demandaForaPontaKw > 0
      ? (Math.abs(demandaForaPontaKw - demandaPontaKw) / Math.max(demandaForaPontaKw, demandaPontaKw)) * 100
      : undefined;

  const camposFaltantes: string[] = [];
  if (typeof tensaoV !== 'number') camposFaltantes.push('tensaoV');
  if (typeof potenciaAtivaKw !== 'number') camposFaltantes.push('potenciaAtivaKw');
  if (typeof fpEstimado !== 'number') camposFaltantes.push('fpAtual');

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
    origemDados: 'fatura',
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