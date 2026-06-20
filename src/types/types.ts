export type OrigemDados = 'fatura' | 'manual' | 'lote' | string;

// Apelido mantido para o motor do banco industrial
export type BancoCapacitor = BancoRecomendado;

// Interface correta para capturar as strings brutas digitadas no formulário manual
export interface EntradaManual {
  potenciaAtivaKw: string;
  fpAtual: string;
  tensaoV: string;
  fpAlvo: string;
  origemDados: string;
  observacoes?: string;
  energiaAtivaKwh?: string;
  energiaReativaKvarh?: string;
  demandaKw?: string;
  demandaMinKw?: string;
  demandaMaxKw?: string;
  variacaoCargaPct?: string;
  energiaAtivaPontaKwh?: string;
  energiaAtivaForaPontaKwh?: string;
  energiaReativaPontaKvarh?: string;
  energiaReativaForaPontaKvarh?: string;
  demandaPontaKw?: string;
  demandaForaPontaKw?: string;
}

export interface DadosParciaisFatura {
  tensaoV?: number;
  potenciaAtivaKw?: number;
  fpAtual?: number;
  fpAlvo?: number;
  energiaAtivaKwh?: number;
  energiaReativaKvarh?: number;
  energiaAtivaForaPontaKwh?: number;
  energiaAtivaPontaKwh?: number;
  energiaReativaForaPontaKvarh?: number;
  energiaReativaPontaKvarh?: number;
  demandaKw?: number;
  demandaPontaKw?: number;
  demandaForaPontaKw?: number;
  demandaTusdgKw?: number;
  diasFaturados?: number;
  variacaoCargaPct?: number;
  origemDados: string;
  demandaMinKw?: number;
  demandaMaxKw?: number;
  observacoes?: string;
  valorReativaRS?: number;
}

export interface ResultadoExtracaoParcial {
  status: string;
  origemDados: string;
  mensagem: string;
  camposFaltantes: string[];
  dadosParciais: DadosParciaisFatura;
}

export interface DadosNormalizadosFP {
  potenciaAtivaKw: number;
  fpAtual: number;
  fpAlvo: number;
  tensaoV: number;
  energiaAtivaKwh?: number;
  energiaReativaKvarh?: number;
  demandaKw?: number;
  demandaMinKw?: number;
  demandaMaxKw?: number;
  variacaoCargaPct?: number;
  origemDados: string;
  observacoes?: string;
  energiaAtivaPontaKwh?: number;
  energiaAtivaForaPontaKwh?: number;
  energiaReativaPontaKvarh?: number;
  energiaReativaForaPontaKvarh?: number;
  demandaPontaKw?: number;
  demandaForaPontaKw?: number;
  demandaTusdgKw?: number;
  diasFaturados?: number;
  // NOVO: cargas não-lineares (inversores de frequência) para diagnóstico de harmônicos
  temInversores?: boolean;
}

export interface EtapaBanco {
  kvar: number;
  quantidade: number;
}

export interface BancoRecomendado {
  estrategia: string;
  totalKvarInstalado: number;
  etapas: EtapaBanco[];
  alerta?: string;
}

export interface ResultadoCalculadoraIndustrial {
  fpAtual: number;
  fpAlvo: number;
  potenciaAtivaKw: number;
  tensaoV: number;
  nivelTensao: string;
  qcKvar: number;
  qcComMargemKvar: number;
  tipoBancoRecomendado: string;
  tipoLigacaoSugerida: string;
  tensaoTrabalhoCapacitor?: string;
  normaAplicavel?: string;
  banco: BancoRecomendado;
  precisaCorrecao: boolean;
  mensagem: string;
  observacoesTecnicas: string[];
  // NOVO: diagnóstico anti-harmônicos
  alertaHarmonicos?: boolean;
  recomendacaoHarmonicos?: string | null;
}
