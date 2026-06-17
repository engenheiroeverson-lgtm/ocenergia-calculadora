import type { DadosNormalizadosFP, ResultadoExtracaoParcial } from '../../types/types';

type ComplementoManual = Partial<Omit<DadosNormalizadosFP, 'origemDados'>>;

function toNumber(valor: unknown): number | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  const texto = String(valor)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (!texto) return undefined;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : undefined;
}

function primeiroNumero(...valores: Array<number | undefined>): number | undefined {
  for (const v of valores) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

function calcularFp(energiaAtivaKwh?: number, energiaReativaKvarh?: number): number | undefined {
  if (typeof energiaAtivaKwh !== 'number' || typeof energiaReativaKvarh !== 'number' || energiaAtivaKwh <= 0) {
    return undefined;
  }
  return energiaAtivaKwh / Math.sqrt(energiaAtivaKwh ** 2 + energiaReativaKvarh ** 2);
}

export function completarDadosParciais(
  base: ResultadoExtracaoParcial,
  complemento: ComplementoManual = {},
): DadosNormalizadosFP {
  const parcial = base.dadosParciais || {};

  const energiaAtivaPontaKwh = primeiroNumero(toNumber(complemento.energiaAtivaPontaKwh), parcial.energiaAtivaPontaKwh);
  const energiaAtivaForaPontaKwh = primeiroNumero(toNumber(complemento.energiaAtivaForaPontaKwh), parcial.energiaAtivaForaPontaKwh);
  const energiaReativaPontaKvarh = primeiroNumero(toNumber(complemento.energiaReativaPontaKvarh), parcial.energiaReativaPontaKvarh);
  const energiaReativaForaPontaKvarh = primeiroNumero(toNumber(complemento.energiaReativaForaPontaKvarh), parcial.energiaReativaForaPontaKvarh);

  const energiaAtivaKwh = primeiroNumero(
    toNumber(complemento.energiaAtivaKwh),
    parcial.energiaAtivaKwh,
    energiaAtivaPontaKwh !== undefined && energiaAtivaForaPontaKwh !== undefined ? energiaAtivaPontaKwh + energiaAtivaForaPontaKwh : undefined
  );

  const energiaReativaKvarh = primeiroNumero(
    toNumber(complemento.energiaReativaKvarh),
    parcial.energiaReativaKvarh,
    energiaReativaPontaKvarh !== undefined && energiaReativaForaPontaKvarh !== undefined ? energiaReativaPontaKvarh + energiaReativaForaPontaKvarh : undefined
  );

  const demandaPontaKw = primeiroNumero(toNumber(complemento.demandaPontaKw), parcial.demandaPontaKw);
  const demandaForaPontaKw = primeiroNumero(toNumber(complemento.demandaForaPontaKw), parcial.demandaForaPontaKw);
  const demandaTusdgKw = primeiroNumero(toNumber(complemento.demandaTusdgKw), parcial.demandaTusdgKw);

  const demandaKw = primeiroNumero(
    toNumber(complemento.demandaKw),
    parcial.demandaKw,
    demandaForaPontaKw,
    demandaPontaKw,
    demandaTusdgKw
  );

  const potenciaAtivaKw = primeiroNumero(
    toNumber(complemento.potenciaAtivaKw),
    parcial.potenciaAtivaKw,
    demandaForaPontaKw,
    demandaKw,
    demandaPontaKw,
    demandaTusdgKw
  ) ?? (typeof energiaAtivaKwh === 'number' && typeof parcial.diasFaturados === 'number' && parcial.diasFaturados > 0
    ? energiaAtivaKwh / (parcial.diasFaturados * 24)
    : undefined);

  const tensaoV = primeiroNumero(toNumber(complemento.tensaoV), parcial.tensaoV);
  const fpManual = primeiroNumero(toNumber(complemento.fpAtual), parcial.fpAtual);
  const fpCalculado = calcularFp(energiaAtivaKwh, energiaReativaKvarh);
  const fpAtual = fpManual ?? fpCalculado;
  const fpAlvo = primeiroNumero(toNumber(complemento.fpAlvo), parcial.fpAlvo) ?? 0.95;

  const variacaoCargaPct = primeiroNumero(toNumber(complemento.variacaoCargaPct), parcial.variacaoCargaPct) ??
    (typeof demandaPontaKw === 'number' && typeof demandaForaPontaKw === 'number' && Math.max(demandaPontaKw, demandaForaPontaKw) > 0
      ? (Math.abs(demandaPontaKw - demandaForaPontaKw) / Math.max(demandaPontaKw, demandaForaPontaKw)) * 100
      : undefined);

  if (typeof potenciaAtivaKw !== 'number') {
    throw new Error('Não foi possível definir a potência ativa. Informe a demanda ou a potência manualmente.');
  }
  if (typeof tensaoV !== 'number') {
    throw new Error('Não foi possível definir a tensão. Informe a tensão manualmente.');
  }
  if (typeof fpAtual !== 'number') {
    throw new Error('Não foi possível calcular o FP atual. Informe o FP manual.');
  }

  return {
    potenciaAtivaKw,
    fpAtual,
    fpAlvo,
    tensaoV,
    energiaAtivaKwh,
    energiaReativaKvarh,
    demandaKw,
    demandaMinKw: primeiroNumero(toNumber(complemento.demandaMinKw)),
    demandaMaxKw: primeiroNumero(toNumber(complemento.demandaMaxKw)),
    variacaoCargaPct,
    origemDados: base.origemDados ?? 'manual',
    observacoes: complemento.observacoes,
    energiaAtivaPontaKwh,
    energiaAtivaForaPontaKwh,
    energiaReativaPontaKvarh,
    energiaReativaForaPontaKvarh,
    demandaPontaKw,
    demandaForaPontaKw,
    demandaTusdgKw,
    diasFaturados: parcial.diasFaturados,
  };
}