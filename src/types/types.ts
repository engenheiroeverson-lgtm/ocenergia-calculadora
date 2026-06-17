export type OrigemDados =
  | 'manual'
  | 'fatura'
  | 'relatorio_massa';

export type DadosNormalizadosFP = {
  origemDados: OrigemDados;
  potenciaAtivaKw: number;
  fpAtual: number;
  tensaoV: number;
  fpAlvo?: number;
  energiaAtivaKwh?: number;
  energiaReativaKvarh?: number;
  demandaKw?: number;
  demandaMinKw?: number;
  demandaMaxKw?: number;
  variacaoCargaPct?: number;
  observacoes?: string;
};

export type EntradaManual = {
  origemDados: OrigemDados;
  potenciaAtivaKw: string;
  fpAtual: string;
  tensaoV: string;
  fpAlvo?: string;
  energiaAtivaKwh?: string;
  energiaReativaKvarh?: string;
  demandaKw?: string;
  demandaMinKw?: string;
  demandaMaxKw?: string;
  variacaoCargaPct?: string;
  observacoes?: string;
};

export type EtapaBanco = {
  kvar: number;
  quantidade: number;
};

export type BancoCapacitor = {
  estrategia: string;
  etapas: EtapaBanco[];
  totalKvarInstalado: number;
  alerta?: string;
};

export type ResultadoCalculadoraIndustrial = {
  potenciaAtivaKw: number;
  fpAtual: number;
  fpAlvo: number;
  tensaoV: number;
  nivelTensao: string;
  qcKvar: number;
  qcComMargemKvar: number;
  tipoBancoRecomendado: string;
  tipoLigacaoSugerida: string;
  banco: BancoCapacitor;
  precisaCorrecao: boolean;
  mensagem: string;
  observacoesTecnicas: string[];
};

export type ResultadoExtracaoParcial = {
  status: 'completo' | 'parcial';
  origemDados: OrigemDados;
  camposFaltantes: string[];
  mensagem: string;
  dadosParciais: Partial<DadosNormalizadosFP>;
};

export type ResultadoExtracaoRelatorioMassa = ResultadoExtracaoParcial & {
  totalRegistros: number;
  registros: {
    indice: number;
    dadosParciais: Partial<DadosNormalizadosFP>;
    camposFaltantes: string[];
    status: 'completo' | 'parcial';
    score: number;
  }[];
  resumo: string;
};