import type {
    DadosNormalizadosFP,
    OrigemDados,
    ResultadoExtracaoParcial,
  } from '../../types/types';
  
  type RegistroRelatorioMassa = {
    indice: number;
    dadosParciais: Partial<DadosNormalizadosFP>;
    camposFaltantes: string[];
    status: 'completo' | 'parcial';
    score: number;
  };
  
  export type ResultadoExtracaoRelatorioMassa = ResultadoExtracaoParcial & {
    totalRegistros: number;
    registros: RegistroRelatorioMassa[];
    resumo: string;
  };
  
  function normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .replace(/\r/g, '\n')
      .replace(/[^\p{L}\p{N}\s,.;:/()%+\-|]/gu, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
  
  function parseNumeroSeguro(valor: string): number | undefined {
    if (!valor) return undefined;
    let v = valor.trim().replace(/[^\d.,+-]/g, '');
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
  
  function montarMensagem(
    status: 'completo' | 'parcial',
    faltantes: string[],
    totalRegistros: number,
  ): string {
    if (status === 'completo') {
      return `Extração concluída. ${totalRegistros} registro(s) identificado(s).`;
    }
    return `Extração parcial em ${totalRegistros} registro(s). Campos faltantes: ${faltantes.join(', ')}.`;
  }
  
  function detectarDelimitador(linha: string): string {
    const candidatos = [';', '\t', '|', ','];
    let melhor = ';';
    let maiorContagem = -1;
    for (const candidato of candidatos) {
      const contagem = linha.split(candidato).length - 1;
      if (contagem > maiorContagem) {
        maiorContagem = contagem;
        melhor = candidato;
      }
    }
    return melhor;
  }
  
  function quebrarLinhaCsv(linha: string, delimitador: string): string[] {
    return linha.split(delimitador).map((parte) => parte.trim().replace(/^"|"$/g, ''));
  }
  
  function normalizarCabecalho(cabecalho: string): string {
    return cabecalho
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  function mapearIndiceCabecalho(cabecalhos: string[]): Record<string, number> {
    const mapa: Record<string, number> = {};
    cabecalhos.forEach((cabecalho, index) => {
      const n = normalizarCabecalho(cabecalho);
      if (n.includes('potencia ativa') || n.includes('demanda ativa') || n === 'kw') {
        mapa.potenciaAtivaKw = index;
      } else if (n === 'fp' || n.includes('fator de potencia') || n.includes('cos fi')) {
        mapa.fpAtual = index;
      } else if (n.includes('tensao') || n.includes('voltagem') || n === 'v') {
        mapa.tensaoV = index;
      } else if (n.includes('fp alvo')) {
        mapa.fpAlvo = index;
      } else if (n.includes('energia ativa') || n === 'kwh') {
        mapa.energiaAtivaKwh = index;
      } else if (n.includes('energia reativa') || n === 'kvarh') {
        mapa.energiaReativaKvarh = index;
      } else if (n.includes('demanda minima') || n.includes('demanda min')) {
        mapa.demandaMinKw = index;
      } else if (n.includes('demanda maxima') || n.includes('demanda max')) {
        mapa.demandaMaxKw = index;
      } else if (n.includes('demanda')) {
        mapa.demandaKw = index;
      } else if (n.includes('variacao')) {
        mapa.variacaoCargaPct = index;
      }
    });
    return mapa;
  }
  
  function extrairDadosPorTexto(texto: string): Partial<DadosNormalizadosFP> {
    return {
      potenciaAtivaKw: extrairPorRotulo(texto, [
        /potência ativa(?: total)?\s*[:=]?\s*([\d.,+-]+)/i,
        /demanda ativa\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      fpAtual: extrairPorRotulo(texto, [
        /fator de potência(?: atual)?\s*[:=]?\s*([\d.,+-]+)/i,
        /\bfp\b\s*[:=]?\s*([\d.,+-]+)/i,
        /cos\s*fi\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      tensaoV: extrairPorRotulo(texto, [
        /tensão(?: nominal)?\s*[:=]?\s*([\d.,+-]+)\s*v?/i,
        /tensao(?: nominal)?\s*[:=]?\s*([\d.,+-]+)\s*v?/i,
      ]),
      energiaAtivaKwh: extrairPorRotulo(texto, [
        /energia ativa\s*[:=]?\s*([\d.,+-]+)/i,
        /\bkwh\b\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      energiaReativaKvarh: extrairPorRotulo(texto, [
        /energia reativa\s*[:=]?\s*([\d.,+-]+)/i,
        /\bkvarh\b\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      demandaKw: extrairPorRotulo(texto, [
        /demanda(?: contratada| máxima| max)?\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      demandaMinKw: extrairPorRotulo(texto, [
        /demanda mínima\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      demandaMaxKw: extrairPorRotulo(texto, [
        /demanda máxima\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
      variacaoCargaPct: extrairPorRotulo(texto, [
        /variação de carga\s*[:=]?\s*([\d.,+-]+)\s*%?/i,
        /variacao de carga\s*[:=]?\s*([\d.,+-]+)\s*%?/i,
      ]),
      fpAlvo: extrairPorRotulo(texto, [
        /fp alvo\s*[:=]?\s*([\d.,+-]+)/i,
      ]),
    };
  }
  
  function pontuarRegistro(dados: Partial<DadosNormalizadosFP>): number {
    let score = 0;
    if (dados.potenciaAtivaKw !== undefined) score += 3;
    if (dados.fpAtual !== undefined) score += 3;
    if (dados.tensaoV !== undefined) score += 3;
    if (dados.fpAlvo !== undefined) score += 1;
    if (dados.energiaAtivaKwh !== undefined) score += 1;
    if (dados.energiaReativaKvarh !== undefined) score += 1;
    if (dados.demandaKw !== undefined) score += 1;
    if (dados.demandaMinKw !== undefined) score += 1;
    if (dados.demandaMaxKw !== undefined) score += 1;
    if (dados.variacaoCargaPct !== undefined) score += 1;
    return score;
  }
  
  function registrarLinha(
    indice: number,
    dados: Partial<DadosNormalizadosFP>,
  ): RegistroRelatorioMassa {
    const camposFaltantes = listarCamposFaltantes(dados);
    const status = camposFaltantes.length === 0 ? 'completo' : 'parcial';
    return {
      indice,
      dadosParciais: dados,
      camposFaltantes,
      status,
      score: pontuarRegistro(dados),
    };
  }
  
  function extrairRegistrosDeTabela(textoNormalizado: string): RegistroRelatorioMassa[] {
    const lines = textoNormalizado.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
  
    const delimitador = detectarDelimitador(lines[0]);
    const cabecalhoPossivel = quebrarLinhaCsv(lines[0], delimitador);
    const existeCabecalho = cabecalhoPossivel.some((item) => {
      const n = normalizarCabecalho(item);
      return n.includes('potencia') || n.includes('fator') || n.includes('fp') ||
        n.includes('tensao') || n.includes('demanda') || n.includes('kwh') || n.includes('kvarh');
    });
  
    const registros: RegistroRelatorioMassa[] = [];
  
    if (existeCabecalho && lines.length > 1) {
      const mapaCabecalho = mapearIndiceCabecalho(cabecalhoPossivel);
      for (let i = 1; i < lines.length; i++) {
        const linha = lines[i];
        if (!linha || linha.length < 2) continue;
        const partes = quebrarLinhaCsv(linha, delimitador);
        const pegar = (campo: string): number | undefined => {
          const index = mapaCabecalho[campo];
          if (index === undefined) return undefined;
          return parseNumeroSeguro(partes[index] ?? '');
        };
        const dados: Partial<DadosNormalizadosFP> = {
          potenciaAtivaKw: pegar('potenciaAtivaKw'),
          fpAtual: pegar('fpAtual'),
          tensaoV: pegar('tensaoV'),
          fpAlvo: pegar('fpAlvo'),
          energiaAtivaKwh: pegar('energiaAtivaKwh'),
          energiaReativaKvarh: pegar('energiaReativaKvarh'),
          demandaKw: pegar('demandaKw'),
          demandaMinKw: pegar('demandaMinKw'),
          demandaMaxKw: pegar('demandaMaxKw'),
          variacaoCargaPct: pegar('variacaoCargaPct'),
        };
        registros.push(registrarLinha(i, dados));
      }
      return registros;
    }
  
    for (let i = 0; i < lines.length; i++) {
      const linha = lines[i];
      if (!linha || linha.length < 2) continue;
      const dados = extrairDadosPorTexto(linha);
      registros.push(registrarLinha(i + 1, dados));
    }
  
    return registros;
  }
  
  function elegirMelhorRegistro(registros: RegistroRelatorioMassa[]): RegistroRelatorioMassa | undefined {
    return registros.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.camposFaltantes.length - b.camposFaltantes.length;
    })[0];
  }
  
  export function extrairDadosRelatorioMassaDoTexto(
    textoBruto: string,
  ): ResultadoExtracaoRelatorioMassa {
    const textoNormalizado = normalizarTexto(textoBruto);
  
    if (!textoNormalizado) {
      return {
        status: 'parcial',
        origemDados: 'relatorio_massa' as OrigemDados,
        camposFaltantes: ['potenciaAtivaKw', 'fpAtual', 'tensaoV'],
        mensagem: 'Texto vazio. Nenhum registro identificado.',
        dadosParciais: { origemDados: 'relatorio_massa' },
        totalRegistros: 0,
        registros: [],
        resumo: 'Nenhum dado processável encontrado.',
      };
    }
  
    const registros = extrairRegistrosDeTabela(textoNormalizado);
    const dadosGlobais = extrairDadosPorTexto(textoNormalizado);
    const registroGlobal = registrarLinha(0, dadosGlobais);
    const melhorRegistro = elegirMelhorRegistro([registroGlobal, ...registros]) ?? registroGlobal;
  
    const camposFaltantes = melhorRegistro.camposFaltantes;
    const status = camposFaltantes.length === 0 ? 'completo' : 'parcial';
    const totalRegistros = registros.length > 0 ? registros.length : 1;
  
    return {
      status,
      origemDados: 'relatorio_massa' as OrigemDados,
      camposFaltantes,
      mensagem: montarMensagem(status, camposFaltantes, totalRegistros),
      dadosParciais: {
        ...melhorRegistro.dadosParciais,
        origemDados: 'relatorio_massa',
        observacoes: textoBruto.trim() || undefined,
      },
      totalRegistros,
      registros: registros.length > 0 ? registros : [registroGlobal],
      resumo: status === 'completo'
        ? 'Registro completo encontrado.'
        : 'Extração parcial. Complementação manual necessária.',
    };
  }