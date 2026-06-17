export interface DadosParciaisFatura {
  tensaoV?: number;
  potenciaAtivaKw?: number;
  fpAtual?: number;
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
  tensaoTrabalhoCapacitor: string;
  normaAplicavel: string;
  banco: BancoRecomendado;
  precisaCorrecao: boolean;
  mensagem: string;
  observacoesTecnicas: string[];
}