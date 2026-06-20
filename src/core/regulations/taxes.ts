// src/core/regulations/taxes.ts
//
// Motor fiscal "por dentro" (gross-up de tributos sobre a tarifa de energia).
// CORRIGIDO conforme validação empírica contra faturas reais Energisa MT (ref 02–04/2026).
//
// TRÊS PONTOS DE HONESTIDADE TÉCNICA:
//
// (1) GROSS-UP SEQUENCIAL — não divisor único.
//     Validado ao centavo na fatura de abril/2026 (linha de demanda):
//       32,74 (líquida) ÷ (1 − 0,0057) = 32,928 ÷ (1 − 0,17) = 39,672
//       (a fatura traz exatamente 39,671910)
//     Um divisor único (1 − ICMS − PIS − COFINS) daria 39,718 — não bate.
//
// (2) PIS/COFINS EFETIVOS ≠ nominais (1,65% / 7,60%).
//     Sobre energia, a distribuidora apura no regime não-cumulativo com créditos;
//     a alíquota efetiva é menor e VARIA mês a mês. Nas suas faturas:
//       abril 0,1017% / 0,4683% | maio 0,4659% / 2,1458% | junho 1,2074% / 5,5613%
//     Por isso PIS/COFINS DEVEM vir da fatura — nunca fixos no código.
//
// (3) ICMS varia por UF e mudou após a LC 194/2022 (energia = bem essencial).
//     A tabela abaixo é FALLBACK NÃO verificado (exceto MT = 17%, confirmado na fatura).
//     Sempre prefira a alíquota efetiva da própria fatura.

export interface TaxRates {
  aliquotaIcms: number;    // fração, ex.: 0.17
  aliquotaPis: number;     // EFETIVA da fatura (fração), NÃO o nominal 0.0165
  aliquotaCofins: number;  // EFETIVA da fatura (fração), NÃO o nominal 0.0760
}

export interface TariffInput {
  vlrTe: number;    // Tarifa de Energia líquida (ANEEL)
  vlrTusd: number;  // Tarifa de Distribuição líquida (ANEEL)
}

export interface IntegratedTariffOutput {
  vlrTeComImposto: number;
  vlrTusdComImposto: number;
  tarifaTotalComImposto: number;
  divisorPisCofins: number;
  divisorIcms: number;
  ufUtilizada: string;
}

/**
 * FALLBACK de ICMS por UF — NÃO garantidamente vigente.
 * Verificar a legislação estadual atual (pós LC 194/2022). Apenas MT (0,17) foi
 * confirmado contra fatura real. Use a alíquota da fatura sempre que possível.
 */
export const MAPA_ICMS_FALLBACK: Record<string, number> = {
  AC: 0.19, AL: 0.20, AM: 0.20, AP: 0.18, BA: 0.205, CE: 0.20, DF: 0.20,
  ES: 0.17, GO: 0.19, MA: 0.23, MG: 0.18, MS: 0.17, MT: 0.17, PA: 0.19,
  PB: 0.20, PE: 0.205, PI: 0.225, PR: 0.195, RJ: 0.22, RN: 0.20, RO: 0.195,
  RR: 0.20, RS: 0.17, SC: 0.17, SE: 0.20, SP: 0.18, TO: 0.20,
};

/** Retorna o ICMS de fallback da UF (sede MT como último recurso). */
export function icmsFallbackPorUf(uf: string): number {
  const u = (uf ?? '').toUpperCase().trim();
  return MAPA_ICMS_FALLBACK[u] ?? 0.17;
}

/** Gross-up "por dentro" SEQUENCIAL: primeiro PIS+COFINS, depois ICMS. */
function grossUpPorDentro(
  valorLiquido: number,
  pis: number,
  cofins: number,
  icms: number,
): number {
  const divisorPisCofins = 1 - (pis + cofins);
  const divisorIcms = 1 - icms;
  if (divisorPisCofins <= 0 || divisorIcms <= 0) {
    throw new Error('Matriz fiscal inválida: alíquotas inviabilizam o gross-up.');
  }
  return valorLiquido / divisorPisCofins / divisorIcms;
}

/**
 * Aplica o gross-up "por dentro" sobre TE e TUSD.
 * @param input  valores líquidos da ANEEL (TE e TUSD)
 * @param rates  alíquotas EFETIVAS — idealmente lidas da fatura. Para ICMS sem
 *               fatura, use icmsFallbackPorUf(uf), ciente de que é fallback.
 * @param uf     apenas para rastreio no retorno
 */
export function calcularTarifaPorDentro(
  input: TariffInput,
  rates: TaxRates,
  uf: string = 'MT',
): IntegratedTariffOutput {
  const { aliquotaIcms, aliquotaPis, aliquotaCofins } = rates;

  const vlrTeComImposto = grossUpPorDentro(input.vlrTe, aliquotaPis, aliquotaCofins, aliquotaIcms);
  const vlrTusdComImposto = grossUpPorDentro(input.vlrTusd, aliquotaPis, aliquotaCofins, aliquotaIcms);

  return {
    vlrTeComImposto: +vlrTeComImposto.toFixed(5),
    vlrTusdComImposto: +vlrTusdComImposto.toFixed(5),
    tarifaTotalComImposto: +(vlrTeComImposto + vlrTusdComImposto).toFixed(5),
    divisorPisCofins: +(1 - (aliquotaPis + aliquotaCofins)).toFixed(4),
    divisorIcms: +(1 - aliquotaIcms).toFixed(4),
    ufUtilizada: (uf ?? '').toUpperCase().trim(),
  };
}

// --- Conferência rápida (Energisa MT, demanda abril/2026) ---
// calcularTarifaPorDentro({ vlrTe: 0, vlrTusd: 32.74 },
//   { aliquotaIcms: 0.17, aliquotaPis: 0.001017, aliquotaCofins: 0.004683 })
//   => vlrTusdComImposto ≈ 39.672  (fatura: 39.671910)
