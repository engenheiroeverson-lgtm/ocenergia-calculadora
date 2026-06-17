import type {
    OrigemDados,
    ResultadoExtracaoParcial,
    DadosNormalizadosFP,
  } from '../../types/types';
  
  function normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s,.;:/()%+-]/gu, ' ');
  }
  
  function parseNumeroSeguro(valor: string): number | undefined {
    if (!valor) return undefined;
    let v = valor.trim();
    v = v.replace(/[^\d.,+-]/g, '');
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
  
  function extrairPorRotulo(texto: string, rotulos: RegExp[]): number | undefined {
    for (const rotulo of rotulos) {
      const match = texto.match(rotulo);
      if (match?.[1]) {
        const numero = parseNumeroSeguro(match[1]);
        if (numero !== undefined) return numero;
      }
    }
    return undefined;
  }
  
  function listarCamposFaltantes(dados: Partial<DadosNormalizadosFP>): string[] {
    const faltantes: string[] = [];
    if (dados.potenciaAtivaKw === undefined) faltantes.push('potenciaAtivaKw');
    if (dados.fpAtual === undefined) faltantes.push('fpAtual');
    if (dados.tensaoV === undefined) faltantes.push('tensaoV');
    return faltantes;
  }
  
  function montarMensagem(status: 'completo' | 'parcial', faltantes: string[]): string {
    if (status === 'completo') {
      return 'Extração concluída com sucesso. Todos os campos principais foram identificados.';
    }
    return `Extração parcial realizada. Campos faltantes: ${faltantes.join(', ')}.`;
  }
  
  export function extrairDadosFaturaDoTexto(textoBruto: string): ResultadoExtracaoParcial {
    const texto = normalizarTexto(textoBruto);
  
    const potenciaAtivaKw = extrairPorRotulo(texto, [
      /potência ativa(?: total)?\s*[:=]?\s*([\d.,+-]+)/i,
      /demanda ativa\s*[:=]?\s*([\d.,+-]+)/i,
      /kwh\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const fpAtual = extrairPorRotulo(texto, [
      /fator de potência(?: atual)?\s*[:=]?\s*([\d.,+-]+)/i,
      /fp\s*[:=]?\s*([\d.,+-]+)/i,
      /cos\s*fi\s*[:=]?\s*([\d.,+-]+)/i,
      /cosphi\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const tensaoV = extrairPorRotulo(texto, [
      /tensão(?: nominal)?\s*[:=]?\s*([\d.,+-]+)\s*v?/i,
      /tensao(?: nominal)?\s*[:=]?\s*([\d.,+-]+)\s*v?/i,
      /voltagem\s*[:=]?\s*([\d.,+-]+)\s*v?/i,
    ]);
  
    const energiaAtivaKwh = extrairPorRotulo(texto, [
      /energia ativa\s*[:=]?\s*([\d.,+-]+)/i,
      /consumo ativo\s*[:=]?\s*([\d.,+-]+)/i,
      /kwh\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const energiaReativaKvarh = extrairPorRotulo(texto, [
      /energia reativa\s*[:=]?\s*([\d.,+-]+)/i,
      /consumo reativo\s*[:=]?\s*([\d.,+-]+)/i,
      /kvarh\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const demandaKw = extrairPorRotulo(texto, [
      /demanda(?: máxima| max| contratada)?\s*[:=]?\s*([\d.,+-]+)/i,
      /demanda\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const demandaMinKw = extrairPorRotulo(texto, [
      /demanda mínima\s*[:=]?\s*([\d.,+-]+)/i,
      /demanda min(?:ima)?\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const demandaMaxKw = extrairPorRotulo(texto, [
      /demanda máxima\s*[:=]?\s*([\d.,+-]+)/i,
      /demanda max(?:ima)?\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const variacaoCargaPct = extrairPorRotulo(texto, [
      /variação de carga\s*[:=]?\s*([\d.,+-]+)\s*%?/i,
      /variacao de carga\s*[:=]?\s*([\d.,+-]+)\s*%?/i,
      /flutuação de carga\s*[:=]?\s*([\d.,+-]+)\s*%?/i,
    ]);
  
    const fpAlvo = extrairPorRotulo(texto, [
      /fp alvo\s*[:=]?\s*([\d.,+-]+)/i,
      /fator de potência alvo\s*[:=]?\s*([\d.,+-]+)/i,
    ]);
  
    const dadosParciais: Partial<DadosNormalizadosFP> = {
      potenciaAtivaKw,
      fpAtual,
      tensaoV,
      fpAlvo,
      energiaAtivaKwh,
      energiaReativaKvarh,
      demandaKw,
      demandaMinKw,
      demandaMaxKw,
      variacaoCargaPct,
      observacoes: textoBruto.trim() || undefined,
      origemDados: 'fatura',
    };
  
    const camposFaltantes = listarCamposFaltantes(dadosParciais);
    const status = camposFaltantes.length === 0 ? 'completo' : 'parcial';
  
    return {
      status,
      origemDados: 'fatura' as OrigemDados,
      camposFaltantes,
      mensagem: montarMensagem(status, camposFaltantes),
      dadosParciais,
    };
  }