// src/lib/enviarLead.ts
//
// Helper de cliente para CAPTURA DE LEAD SERVER-SIDE confiável.
// Envia o lead direto para a função serverless /api/enviar-email, garantindo o
// registro (e o BCC para engenharia) independentemente do mailto/wa.me do app.
//
// Reusável pelos Módulos III (capacitores) e II (BESS): o `resultado` aceita null
// (Módulo II não tem fator de potência) e o `extras.bess` carrega o relatório BESS.

import type { ResultadoCalculadoraIndustrial } from '../types/types';

// Tipagem flexível para não acoplar a campos exatos do DadosLead.
interface LeadFlex {
  nome?: string;
  empresa?: string;
  email?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
}

export type DispatchStatus = 'sent' | 'skipped' | 'error';
export interface EnvioLeadResposta {
  ok: boolean;
  dispatch?: { email: DispatchStatus; whatsapp: DispatchStatus };
  error?: string;
}

// Espelha o TarifaAneelMeta esperado por /api/enviar-email.
export interface TarifaAneelMeta {
  uf?: string;
  agente?: string;
  subgrupo?: string;
  modalidade?: string;
  posto?: string;
  icmsPct?: number;
  pisPct?: number;
  cofinsPct?: number;
  vlrTeLiquido?: number | null;
  vlrTusdLiquido?: number | null;
  tarifaLiquidaTotal?: number | null;
  tarifaComImpostoTotal?: number | null;
  inicioVigencia?: string | null;
  origem?: string;
}

// Resumo do BESS (Módulo II) para enriquecer o e-mail de proposta.
export interface ResumoBessLead {
  modalidade: string;
  cargaCritica: boolean;
  potenciaKw: number;
  energiaKwh: number;
  topologia: string;
  hardware: string;
  demandaContratadaOtimaKw: number;
  mesesUltrapassagem: number;
  faturaAtualAnual: number;
  faturaOtimizadaAnual: number;
  economiaAnual: number;
  reducaoPercentual: number;
  paybackAnos: number | null;
}

interface ExtrasComerciais {
  multaMensalReais?: number;
  temInversores?: boolean;
  investimentoReais?: number | null;
  uf?: string;
  tarifaAneel?: TarifaAneelMeta | null;
  bess?: ResumoBessLead | null;
}

export async function enviarLead(
  resultado: ResultadoCalculadoraIndustrial | null,
  lead: LeadFlex | null,
  extras: ExtrasComerciais = {},
): Promise<EnvioLeadResposta> {
  try {
    const resp = await fetch('/api/enviar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(resultado
          ? {
              potenciaAtivaKW: resultado.potenciaAtivaKw,
              fpAtual: resultado.fpAtual,
              fpAlvo: resultado.fpAlvo,
            }
          : {}),
        multaMensalReais: extras.multaMensalReais ?? 0,
        temInversores: extras.temInversores ?? false,
        investimentoReais: extras.investimentoReais ?? null,
        uf: extras.uf ?? lead?.estado ?? undefined,
        tarifaAneel: extras.tarifaAneel ?? null,
        bess: extras.bess ?? null,
        lead: lead
          ? {
              nome: lead.nome,
              empresa: lead.empresa,
              email: lead.email,
              telefone: lead.whatsapp,
              cidade: lead.cidade,
              estado: lead.estado,
            }
          : undefined,
      }),
    });
    return (await resp.json()) as EnvioLeadResposta;
  } catch {
    return { ok: false, error: 'Falha de rede ao enviar o lead.' };
  }
}
