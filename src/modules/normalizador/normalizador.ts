import type { DadosNormalizadosFP, EntradaManual } from '../../types/types';

function parseNumeroSeguro(valor: string | undefined): number | undefined {
  if (!valor || valor.trim() === '') return undefined;
  let v = valor.trim().replace(/[^\d.,+-]/g, '');
  const temVirgula = v.includes(',');
  const temPonto = v.includes('.');
  if (temVirgula && temPonto) {
    const ultimoVirgula = v.lastIndexOf(',');
    const ultimoPonto = v.lastIndexOf('.');
    if (ultimoVirgula > ultimoPonto) {
      v = v.replace(/\./g, '').replace(',', '.');
    } else {
      v = v.replace(/,/g, '');
    }
  } else if (temVirgula) {
    v = v.replace(',', '.');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function validarObrigatorio(
  valor: string | undefined,
  nomeCampo: string,
): number {
  const n = parseNumeroSeguro(valor);
  if (n === undefined) {
    throw new Error(`Campo obrigatório ausente ou inválido: ${nomeCampo}`);
  }
  return n;
}

export function normalizarEntradaManual(
  entrada: EntradaManual,
): DadosNormalizadosFP {
  const potenciaAtivaKw = validarObrigatorio(
    entrada.potenciaAtivaKw,
    'potenciaAtivaKw',
  );
  const fpAtual = validarObrigatorio(entrada.fpAtual, 'fpAtual');
  const tensaoV = validarObrigatorio(entrada.tensaoV, 'tensaoV');

  if (potenciaAtivaKw <= 0) throw new Error('Campo inválido: potenciaAtivaKw');
  if (fpAtual <= 0 || fpAtual > 1) throw new Error('Campo inválido: fpAtual');
  if (tensaoV <= 0) throw new Error('Campo inválido: tensaoV');

  const fpAlvo = parseNumeroSeguro(entrada.fpAlvo) ?? 0.95;

  return {
    origemDados: entrada.origemDados,
    potenciaAtivaKw,
    fpAtual,
    tensaoV,
    fpAlvo,
    energiaAtivaKwh: parseNumeroSeguro(entrada.energiaAtivaKwh),
    energiaReativaKvarh: parseNumeroSeguro(entrada.energiaReativaKvarh),
    demandaKw: parseNumeroSeguro(entrada.demandaKw),
    demandaMinKw: parseNumeroSeguro(entrada.demandaMinKw),
    demandaMaxKw: parseNumeroSeguro(entrada.demandaMaxKw),
    variacaoCargaPct: parseNumeroSeguro(entrada.variacaoCargaPct),
    observacoes: entrada.observacoes?.trim() || undefined,
  };
}