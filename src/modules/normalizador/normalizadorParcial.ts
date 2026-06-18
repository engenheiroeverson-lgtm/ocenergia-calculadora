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

function calcularFp(
  energiaAtivaKwh?: number,
  energiaReativaKvarh?: number,
): number | undefined {
  if (
    typeof energiaAtivaKwh !== 'number' ||
    typeof energiaReativaKvarh !== 'number' ||
    energiaAtivaKwh <= 0
  ) {
    return undefined;
  }

  return (
    energiaAtivaKwh /
    Math.sqrt(energiaAtivaKwh ** 2 + energiaReativaKvarh ** 2)
  );
}

export function completarDadosParciais(
  base: ResultadoExtracaoParcial,
  complemento: ComplementoManual = {},
): DadosNormalizadosFP {
  const parcial = base.dadosParciais ?? {};

  // ─── Energia ativa ponta / fora ponta ───────────────────────────────────
  const energiaAtivaPontaKwh = primeiroNumero(
    toNumber(complemento.energiaAtivaPontaKwh),
    parcial.energiaAtivaPontaKwh,
  );

  const energiaAtivaForaPontaKwh = primeiroNumero(
    toNumber(complemento.energiaAtivaForaPontaKwh),
    parcial.energiaAtivaForaPontaKwh,
  );

  // ─── Energia reativa ponta / fora ponta ─────────────────────────────────
  const energiaReativaPontaKvarh = primeiroNumero(
    toNumber(complemento.energiaReativaPontaKvarh),
    parcial.energiaReativaPontaKvarh,
  );

  const energiaReativaForaPontaKvarh = primeiroNumero(
    toNumber(complemento.energiaReativaForaPontaKvarh),
    parcial.energiaReativaForaPontaKvarh,
  );

  // ─── Energia ativa total ─────────────────────────────────────────────────
  // Usa diretamente ou soma ponta + fora ponta
  const energiaAtivaKwh =
    primeiroNumero(
      toNumber(complemento.energiaAtivaKwh),
      parcial.energiaAtivaKwh,
      energiaAtivaPontaKwh !== undefined && energiaAtivaForaPontaKwh !== undefined
        ? energiaAtivaPontaKwh + energiaAtivaForaPontaKwh
        : undefined,
    );

  // ─── Energia reativa total ───────────────────────────────────────────────
  // Usa diretamente ou soma ponta + fora ponta
  const energiaReativaKvarh =
    primeiroNumero(
      toNumber(complemento.energiaReativaKvarh),
      parcial.energiaReativaKvarh,
      energiaReativaPontaKvarh !== undefined && energiaReativaForaPontaKvarh !== undefined
        ? energiaReativaPontaKvarh + energiaReativaForaPontaKvarh
        : undefined,
    );

  // ─── Demandas ────────────────────────────────────────────────────────────
  const demandaPontaKw = primeiroNumero(
    toNumber(complemento.demandaPontaKw),
    parcial.demandaPontaKw,
  );

  const demandaForaPontaKw = primeiroNumero(
    toNumber(complemento.demandaForaPontaKw),
    parcial.demandaForaPontaKw,
  );

  const demandaTusdgKw = primeiroNumero(
    toNumber(complemento.demandaTusdgKw),
    parcial.demandaTusdgKw,
  );

  const demandaKw = primeiroNumero(
    toNumber(complemento.demandaKw),
    parcial.demandaKw,
    demandaForaPontaKw,
    demandaPontaKw,
    demandaTusdgKw,
  );

  // ─── Potência ativa ──────────────────────────────────────────────────────
  // Prioridade: manual > extraído > demanda fora ponta > demanda >
  //             demanda ponta > demanda TUSDG > estimativa por kWh/dias
  const potenciaAtivaKw =
    primeiroNumero(
      toNumber(complemento.potenciaAtivaKw),
      parcial.potenciaAtivaKw,
      demandaForaPontaKw,
      demandaKw,
      demandaPontaKw,
      demandaTusdgKw,
    ) ??
    (typeof energiaAtivaKwh === 'number' &&
    typeof parcial.diasFaturados === 'number' &&
    parcial.diasFaturados > 0
      ? energiaAtivaKwh / (parcial.diasFaturados * 24)
      : undefined);

  // ─── Tensão ──────────────────────────────────────────────────────────────
  const tensaoV = primeiroNumero(
    toNumber(complemento.tensaoV),
    parcial.tensaoV,
  );

  // Tensão final com fallback para 380 V
  const tensaoFinal = tensaoV ?? 380;

  // ─── Fator de Potência ───────────────────────────────────────────────────
  // Prioridade: manual > calculado pela fatura > padrão conservador 0,80
  const fpManual = primeiroNumero(
    toNumber(complemento.fpAtual),
    parcial.fpAtual,
  );

  const fpCalculado = calcularFp(energiaAtivaKwh, energiaReativaKvarh);

  const fpAtual = fpManual ?? fpCalculado ?? 0.80;

  // FP alvo — padrão ANEEL 0,92
  const fpAlvo =
    primeiroNumero(
      toNumber(complemento.fpAlvo),
      parcial.fpAlvo,
    ) ?? 0.92;

  // ─── Variação de carga ───────────────────────────────────────────────────
  const variacaoCargaPct =
    primeiroNumero(
      toNumber(complemento.variacaoCargaPct),
      parcial.variacaoCargaPct,
    ) ??
    (typeof demandaPontaKw === 'number' &&
    typeof demandaForaPontaKw === 'number' &&
    Math.max(demandaPontaKw, demandaForaPontaKw) > 0
      ? (Math.abs(demandaPontaKw - demandaForaPontaKw) /
          Math.max(demandaPontaKw, demandaForaPontaKw)) *
        100
      : undefined);

  // ─── Avisos automáticos quando valores padrão foram usados ───────────────
  const avisosPadrao: string[] = [];

  if (fpManual == null && fpCalculado == null) {
    avisosPadrao.push(
      'FP atual não informado: aplicado padrão 0,80 conforme prática técnica conservadora.',
    );
  }

  if (fpManual == null && fpCalculado != null) {
    avisosPadrao.push(
      `FP estimado pela fatura (kWh/kVArh): ${fpCalculado.toFixed(3)} — representa o FP médio mensal.`,
    );
  }

  if (complemento.fpAlvo == null && parcial.fpAlvo == null) {
    avisosPadrao.push(
      'FP alvo não informado: aplicado padrão 0,92 conforme resolução ANEEL 1000/2021.',
    );
  }

  if (tensaoV == null) {
    avisosPadrao.push(
      'Tensão não informada: considerada tensão típica de 380 V (mais comum no mercado brasileiro).',
    );
  }

  // ─── Validações de segurança ─────────────────────────────────────────────

  // Potência ativa deve ser um número positivo
  if (typeof potenciaAtivaKw !== 'number' || potenciaAtivaKw <= 0) {
    throw new Error(
      'Não foi possível definir a potência ativa válida. Informe a demanda ou a potência manualmente.',
    );
  }

  // Tensão deve ser positiva
  if (tensaoFinal <= 0) {
    throw new Error(
      'A tensão final da instalação deve ser um número maior que zero.',
    );
  }

  // FP atual deve estar entre 0,01 e 1,00
  if (fpAtual <= 0 || fpAtual > 1) {
    throw new Error(
      'O Fator de Potência atual deve estar entre 0,01 e 1,00. Verifique os dados informados.',
    );
  }

  // FP alvo deve estar entre 0,01 e 1,00
  if (fpAlvo <= 0 || fpAlvo > 1) {
    throw new Error(
      'O Fator de Potência alvo deve estar entre 0,01 e 1,00. Verifique os dados informados.',
    );
  }

  // FP alvo não pode ser menor que o FP atual
  // (se já está acima do alvo, o sistema informa — não é erro, apenas aviso)
  if (fpAlvo < fpAtual) {
    avisosPadrao.push(
      `FP atual (${fpAtual.toFixed(3)}) já supera o FP alvo (${fpAlvo.toFixed(2)}). Nenhuma correção necessária — verifique cobrança de reativa excedente na fatura.`,
    );
  }

  // ─── Observações finais ──────────────────────────────────────────────────
  // Une observações do usuário + avisos automáticos
  const observacoes = [
    complemento.observacoes,
    parcial.observacoes,
    ...avisosPadrao,
  ]
    .filter(Boolean)
    .join(' | ') || undefined;

  // ─── Retorno ─────────────────────────────────────────────────────────────
  return {
    potenciaAtivaKw,
    fpAtual,
    fpAlvo,
    tensaoV: tensaoFinal,
    energiaAtivaKwh,
    energiaReativaKvarh,
    demandaKw,
    demandaMinKw: primeiroNumero(
      toNumber(complemento.demandaMinKw),
      parcial.demandaMinKw,
    ),
    demandaMaxKw: primeiroNumero(
      toNumber(complemento.demandaMaxKw),
      parcial.demandaMaxKw,
    ),
    variacaoCargaPct,
    origemDados: parcial.origemDados ?? base.origemDados ?? 'manual',
    observacoes,
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