// src/lib/enviarLead.ts
//
// Helper de cliente para CAPTURA DE LEAD SERVER-SIDE confiável.
// Hoje o lead só sai se o usuário concluir o mailto/wa.me no app dele.
// Esta função envia o lead direto para a função serverless /api/enviar-email,
// garantindo o registro (e o BCC para engenharia) independentemente disso.
//
// Use em conjunto com o mailto/wa.me já existentes — não precisa remover nada:
// dispare este enviarLead() ao calcular/cadastrar, e mantenha os botões atuais.

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

interface ExtrasComerciais {
  multaMensalReais?: number;
  temInversores?: boolean;
  investimentoReais?: number | null;
}

export async function enviarLead(
  resultado: ResultadoCalculadoraIndustrial,
  lead: LeadFlex | null,
  extras: ExtrasComerciais = {},
): Promise<EnvioLeadResposta> {
  try {
    const resp = await fetch('/api/enviar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        potenciaAtivaKW: resultado.potenciaAtivaKw,
        fpAtual: resultado.fpAtual,
        fpAlvo: resultado.fpAlvo,
        multaMensalReais: extras.multaMensalReais ?? 0,
        temInversores: extras.temInversores ?? false,
        investimentoReais: extras.investimentoReais ?? null,
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
