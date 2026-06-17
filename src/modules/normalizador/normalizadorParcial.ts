import type {
    DadosNormalizadosFP,
    ResultadoExtracaoParcial,
  } from '../../types/types';
  
  type ComplementoParcial = {
    potenciaAtivaKw?: number;
    fpAtual?: number;
    tensaoV?: number;
    fpAlvo?: number;
    energiaAtivaKwh?: number;
    energiaReativaKvarh?: number;
    demandaKw?: number;
    demandaMinKw?: number;
    demandaMaxKw?: number;
    variacaoCargaPct?: number;
    observacoes?: string;
  };
  
  function isNumeroValido(valor: unknown): valor is number {
    return typeof valor === 'number' && Number.isFinite(valor);
  }
  
  function validarObrigatorio(valor: number | undefined, nomeCampo: string): number {
    if (!isNumeroValido(valor)) {
      throw new Error(`Campo obrigatório ausente ou inválido: ${nomeCampo}`);
    }
    return valor;
  }
  
  function juntarObservacoes(
    observacaoOriginal?: string,
    observacaoExtra?: string,
  ): string | undefined {
    const partes = [observacaoOriginal?.trim(), observacaoExtra?.trim()].filter(Boolean);
    if (partes.length === 0) return undefined;
    return partes.join(' | ');
  }
  
  export function completarDadosParciais(
    extracao: ResultadoExtracaoParcial,
    complemento: ComplementoParcial = {},
  ): DadosNormalizadosFP {
    const dados = extracao.dadosParciais ?? {};
  
    const potenciaAtivaKw = validarObrigatorio(
      complemento.potenciaAtivaKw ?? dados.potenciaAtivaKw,
      'potenciaAtivaKw',
    );
  
    const fpAtual = validarObrigatorio(
      complemento.fpAtual ?? dados.fpAtual,
      'fpAtual',
    );
  
    const tensaoV = validarObrigatorio(
      complemento.tensaoV ?? dados.tensaoV,
      'tensaoV',
    );
  
    const fpAlvo = complemento.fpAlvo ?? dados.fpAlvo ?? 0.95;
  
    if (fpAlvo <= 0 || fpAlvo > 1) {
      throw new Error('Campo inválido: fpAlvo');
    }
  
    if (fpAtual <= 0 || fpAtual > 1) {
      throw new Error('Campo inválido: fpAtual');
    }
  
    if (potenciaAtivaKw <= 0) {
      throw new Error('Campo inválido: potenciaAtivaKw');
    }
  
    if (tensaoV <= 0) {
      throw new Error('Campo inválido: tensaoV');
    }
  
    const energiaAtivaKwh = complemento.energiaAtivaKwh ?? dados.energiaAtivaKwh;
    const energiaReativaKvarh = complemento.energiaReativaKvarh ?? dados.energiaReativaKvarh;
    const demandaKw = complemento.demandaKw ?? dados.demandaKw;
    const demandaMinKw = complemento.demandaMinKw ?? dados.demandaMinKw;
    const demandaMaxKw = complemento.demandaMaxKw ?? dados.demandaMaxKw;
    const variacaoCargaPct = complemento.variacaoCargaPct ?? dados.variacaoCargaPct;
  
    return {
      origemDados: extracao.origemDados,
      potenciaAtivaKw,
      fpAtual,
      tensaoV,
      fpAlvo,
      observacoes: juntarObservacoes(
        dados.observacoes,
        complemento.observacoes,
      ),
      energiaAtivaKwh,
      energiaReativaKvarh,
      demandaKw,
      demandaMinKw,
      demandaMaxKw,
      variacaoCargaPct,
    };
  }
  
  export function listarCamposFaltantesParaCompletar(
    extracao: ResultadoExtracaoParcial,
    complemento: ComplementoParcial = {},
  ): string[] {
    const faltantes = new Set<string>(extracao.camposFaltantes ?? []);
  
    if (!isNumeroValido(complemento.potenciaAtivaKw) && !isNumeroValido(extracao.dadosParciais.potenciaAtivaKw)) {
      faltantes.add('potenciaAtivaKw');
    }
  
    if (!isNumeroValido(complemento.fpAtual) && !isNumeroValido(extracao.dadosParciais.fpAtual)) {
      faltantes.add('fpAtual');
    }
  
    if (!isNumeroValido(complemento.tensaoV) && !isNumeroValido(extracao.dadosParciais.tensaoV)) {
      faltantes.add('tensaoV');
    }
  
    return Array.from(faltantes);
  }