// src/lib/enviarLead.ts
//
// Helper de cliente para CAPTURA DE LEAD SERVER-SIDE confiável.
// Envia o lead direto para a função serverless /api/enviar-email, garantindo o
// registro (e o BCC para engenharia) independentemente do mailto/wa.me do app.
//
// O motor: (1) reconstrói a fatura atual de demanda+energia dos 12 meses,
// (2) diagnostica ultrapassagem, (3) dimensiona o BESS para peak shaving na ponta
// + arbitragem (deslocar energia da ponta para fora-ponta), (4) recomenda a
// topologia (crítico vs. econômico) e o hardware WEG, e (5) simula a fatura
// otimizada, economia e payback.
// ─────────────────────────────────────────────────────────────────────────────

export type Modalidade = 'Azul' | 'Verde';

// ── Parâmetros regulatórios (VALIDAR) ───────────────────────────────────────
export const PARAMETROS_REGULATORIOS = {
  toleranciaUltrapassagem: 0.05, 
  multiplicadorUltrapassagem: 2, 
};

// ── Parâmetros físicos/operacionais do BESS (ajustáveis) ─────────────────────
export const PARAMETROS_BESS = {
  eficienciaCiclo: 0.88, 
  horasPonta: 3, 
  diasUteisMes: 21, 
  profundidadeDescarga: 0.9, 
};

// ── Catálogo WEG C&I (All-in-One BSCW) — dados do material WEG fornecido ──────
export interface ModeloBess {
  modelo: string;
  potenciaKw: number;
  energiaKwh: number;
  familia: string;
}
export const CATALOGO_WEG_CI: ModeloBess[] = [
  { modelo: 'BSCW610', potenciaKw: 85, energiaKwh: 261, familia: 'All-in-One BSCW' },
  { modelo: 'BSCW400', potenciaKw: 100, energiaKwh: 215, familia: 'All-in-One BSCW' },
  { modelo: 'BSCW420', potenciaKw: 125, energiaKwh: 241, familia: 'All-in-One BSCW' },
  { modelo: 'BSCW400H', potenciaKw: 125, energiaKwh: 261, familia: 'All-in-One BSCW' },
];

// ── Entradas ─────────────────────────────────────────────────────────────────
export interface MesDemanda {
  referencia: string; 
  consumoPontaKwh: number;
  consumoForaPontaKwh: number;
  demandaMedidaPontaKw: number;
  demandaMedidaForaPontaKw: number;
  demandaContratadaPontaKw: number;
  demandaContratadaForaPontaKw: number;
}

export interface Tarifas {
  tusdDemandaPonta: number;
  tusdDemandaForaPonta: number;
  tePonta: number;
  tusdEnergiaPonta: number;
  teForaPonta: number;
  tusdEnergiaForaPonta: number;
}

export interface EntradaModuloII {
  modalidade: Modalidade;
  cargaCritica: boolean; 
  meses: MesDemanda[]; 
  tarifas: Tarifas;
  capexBessReais?: number; 
  parametrosRegulatorios?: typeof PARAMETROS_REGULATORIOS;
  parametrosBess?: typeof PARAMETROS_BESS;
}

// ── Resultados ────────────────────────────────────────────────────────────────
export interface CustoDemandaPosto {
  demandaFaturavelKw: number;
  demandaUltrapassagemKw: number;
  custoNormal: number;
  custoUltrapassagem: number;
  total: number;
}
export interface FaturaMensal {
  referencia: string;
  custoEnergia: number;
  demandaPonta: CustoDemandaPosto | null; 
  demandaForaPonta: CustoDemandaPosto;
  totalDemanda: number;
  totalMes: number;
  houveUltrapassagem: boolean;
}
export interface DimensionamentoBess {
  potenciaKw: number;
  energiaKwh: number;
  energiaUtilDiariaKwh: number;
}
export interface RecomendacaoTopologia {
  tipo: 'Dupla Conversão Unidirecional' | 'Bidirecional Clássico (AC Coupling)';
  conexao: string;
  tempoAtuacao: string;
  enfase: string;
}
export interface RecomendacaoHardware {
  tipo: 'unidade-unica' | 'multiplas-unidades' | 'utility';
  descricao: string;
  modeloBase?: ModeloBess;
  quantidade?: number;
}
export interface Financeiro {
  faturaAtualAnual: number;
  faturaOtimizadaAnual: number;
  economiaAnual: number;
  reducaoPercentual: number;
  capexBessReais: number | null;
  paybackAnos: number | null;
  fluxoCaixa10Anos: { ano: number; fluxoAcumulado: number }[];
}
export interface ResultadoModuloII {
  faturasAtuais: FaturaMensal[];
  ultrapassagemDetectada: boolean;
  mesesComUltrapassagem: string[];
  dimensionamento: DimensionamentoBess;
  demandaContratadaOtimaPonta: number;
  demandaContratadaOtimaForaPonta: number;
  topologia: RecomendacaoTopologia;
  hardware: RecomendacaoHardware;
  financeiro: Financeiro;
  avisos: string[];
}

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

// NOVO — resumo do BESS (Módulo II) para enriquecer o e-mail de proposta.
export interface ResumoBessLead {
  modalidade: string;
  cargaCritica: boolean;
  potenciaKw: number;
  energiaKwh: number;
  topologia: string;
  hardware: string;
  demandaContratadaOtimaKw: number; // 🌟 Linha adicionada com sucesso aqui!
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
