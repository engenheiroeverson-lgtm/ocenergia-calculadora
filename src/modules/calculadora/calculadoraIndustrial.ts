import type {
  BancoCapacitor,
  DadosNormalizadosFP,
  EtapaBanco,
  ResultadoCalculadoraIndustrial,
} from '../../types/types';
import { diagnosticarHarmonicos } from '../../core/diagnosticoHarmonicos';

type OpcoesCalculo = {
  fpAlvo?: number;
  margemSegurancaPct?: number;
};

function classificarNivelTensao(tensaoV: number): string {
  if (tensaoV <= 1000) return 'baixa tensão';
  if (tensaoV <= 36200) return 'média tensão'; // 36,2 kV = teto da ABNT NBR 14039
  return 'alta tensão';
}

function sugerirLigacao(tensaoV: number): string {
  if (tensaoV <= 440) return 'Triângulo (delta)';
  return 'Estrela (Y)';
}

// Norma técnica aplicável conforme o nível de tensão.
// BT (<=1000 V): ABNT NBR 5410 / IEC 60831 (capacitores <=1 kV).
// MT (<=36,2 kV): ABNT NBR 14039 / IEC 60871 (capacitores >1 kV).
function definirNorma(tensaoV: number): string {
  if (tensaoV <= 1000) return 'ABNT NBR 5410 (BT) / IEC 60831';
  if (tensaoV <= 36200) return 'ABNT NBR 14039 (MT) / IEC 60871';
  return 'Alta tensão (>36,2 kV): consultar norma específica';
}

// Classes de tensão de trabalho usuais para capacitores de BT (mercado/WEG).
const CLASSES_TENSAO_BT = [240, 250, 380, 400, 440, 480, 525, 600, 690];

// O capacitor deve ser de classe ACIMA da tensão nominal: ele eleva a tensão local,
// sofre tolerâncias e (com reator de dessintonia) recebe a sobretensão do reator em série.
// Regra conservadora: menor classe >= 1,1 x nominal; com inversores (reator), sobe uma classe.
// É SUGESTÃO — a classe definitiva é a do catálogo WEG do produto escolhido.
function sugerirTensaoTrabalhoCapacitor(tensaoV: number, temInversores: boolean): string {
  if (tensaoV > 1000) {
    return 'Definir por unidade/arranjo do banco (projeto MT) — consultar catálogo WEG';
  }

  const alvo = tensaoV * 1.1;
  let idx = CLASSES_TENSAO_BT.findIndex((c) => c >= alvo);

  if (idx === -1) {
    const maior = CLASSES_TENSAO_BT[CLASSES_TENSAO_BT.length - 1];
    return `acima de ${maior} V — consultar catálogo WEG`;
  }

  // Reator de dessintonia eleva a tensão sobre o capacitor: uma classe acima.
  if (temInversores && idx < CLASSES_TENSAO_BT.length - 1) idx += 1;

  const classe = CLASSES_TENSAO_BT[idx];
  return `${classe} V (classe sugerida${
    temInversores ? ', com reator de dessintonia' : ''
  } — confirmar no catálogo WEG)`;
}

function calcularQc(potenciaAtivaKw: number, fpAtual: number, fpAlvo: number): number {
  if (fpAtual >= fpAlvo) return 0;

  const tanAtual = Math.sqrt(1 - fpAtual ** 2) / fpAtual;
  const tanAlvo = Math.sqrt(1 - fpAlvo ** 2) / fpAlvo;

  return potenciaAtivaKw * (tanAtual - tanAlvo);
}

function aplicarMargem(qcKvar: number, margemPct: number): number {
  return qcKvar * (1 + margemPct / 100);
}

function classificarTipoBanco(qcKvar: number, variacaoCargaPct?: number): string {
  if (qcKvar <= 0) return 'Nenhum banco necessário';

  if (variacaoCargaPct !== undefined && variacaoCargaPct > 15) {
    return 'Banco automático por etapas';
  }

  if (qcKvar <= 30) return 'Banco fixo';

  return 'Banco automático por etapas';
}

function gerarEtapasPadrao(): number[] {
  return [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
}

function avaliarCombinacao(
  etapas: EtapaBanco[],
  qcKvar: number,
): {
  etapas: EtapaBanco[];
  totalKvar: number;
  diferenca: number;
  excessoPct: number;
  quantidadeTotal: number;
} {
  const totalKvar = etapas.reduce((acc, etapa) => acc + etapa.kvar * etapa.quantidade, 0);
  const diferenca = Math.abs(totalKvar - qcKvar);
  const excessoPct = qcKvar > 0 ? ((totalKvar - qcKvar) / qcKvar) * 100 : 0;
  const quantidadeTotal = etapas.reduce((acc, etapa) => acc + etapa.quantidade, 0);

  return { etapas, totalKvar, diferenca, excessoPct, quantidadeTotal };
}

function compararCandidatos(
  atual: ReturnType<typeof avaliarCombinacao> | null,
  novo: ReturnType<typeof avaliarCombinacao>,
): ReturnType<typeof avaliarCombinacao> {
  if (!atual) return novo;

  if (novo.diferenca < atual.diferenca) return novo;
  if (novo.diferenca > atual.diferenca) return atual;

  const excessoAtualAbs = Math.abs(atual.excessoPct);
  const excessoNovoAbs = Math.abs(novo.excessoPct);

  if (excessoNovoAbs < excessoAtualAbs) return novo;
  if (excessoNovoAbs > excessoAtualAbs) return atual;

  if (novo.totalKvar < atual.totalKvar) return novo;
  if (novo.totalKvar > atual.totalKvar) return atual;

  if (novo.quantidadeTotal < atual.quantidadeTotal) return novo;

  return atual;
}

function montarEtapas(qcKvar: number): EtapaBanco[] {
  if (qcKvar <= 0) return [];

  const padroesKvar = gerarEtapasPadrao();
  let melhor: ReturnType<typeof avaliarCombinacao> | null = null;

  for (const padrao of padroesKvar) {
    for (let quantidade = 1; quantidade <= 12; quantidade++) {
      const candidato = avaliarCombinacao([{ kvar: padrao, quantidade }], qcKvar);

      if (candidato.excessoPct > 20) continue;

      melhor = compararCandidatos(melhor, candidato);
    }
  }

  for (let i = 0; i < padroesKvar.length; i++) {
    for (let j = i; j < padroesKvar.length; j++) {
      const padrao1 = padroesKvar[i];
      const padrao2 = padroesKvar[j];

      for (let q1 = 1; q1 <= 8; q1++) {
        for (let q2 = 1; q2 <= 8; q2++) {
          const etapas: EtapaBanco[] =
            padrao1 === padrao2
              ? [{ kvar: padrao1, quantidade: q1 + q2 }]
              : [
                  { kvar: padrao1, quantidade: q1 },
                  { kvar: padrao2, quantidade: q2 },
                ];

          const candidato = avaliarCombinacao(etapas, qcKvar);

          if (candidato.excessoPct > 15) continue;
          if (candidato.excessoPct < -15) continue;

          melhor = compararCandidatos(melhor, candidato);
        }
      }
    }
  }

  if (!melhor) {
    const padrao = padroesKvar.reduce((anterior, atual) =>
      Math.abs(atual - qcKvar) < Math.abs(anterior - qcKvar) ? atual : anterior,
    );

    const quantidade = Math.max(1, Math.ceil(qcKvar / padrao));
    return [{ kvar: padrao, quantidade }];
  }

  return melhor.etapas;
}

function montarBanco(
  qcKvar: number,
  tipoBanco: string,
  variacaoCargaPct?: number,
): BancoCapacitor {
  if (qcKvar <= 0) {
    return {
      estrategia: 'Nenhuma ação necessária',
      etapas: [],
      totalKvarInstalado: 0,
    };
  }

  const etapas = montarEtapas(qcKvar);
  const totalKvarInstalado = etapas.reduce(
    (acc, etapa) => acc + etapa.kvar * etapa.quantidade,
    0,
  );

  let alerta: string | undefined;

  if (totalKvarInstalado > qcKvar * 1.15) {
    alerta =
      'O total instalado ficou acima de 15% do Qc calculado. Verifique se existe opção de etapas menores.';
  }

  if (variacaoCargaPct !== undefined && variacaoCargaPct > 30) {
    alerta =
      'Variação de carga elevada (>30%). Considere banco automático com controlador de FP dedicado.';
  }

  return {
    estrategia: tipoBanco,
    etapas,
    totalKvarInstalado,
    alerta,
  };
}

function gerarObservacoesTecnicas(
  dados: DadosNormalizadosFP,
  qcKvar: number,
  fpAlvo: number,
): string[] {
  const obs: string[] = [];

  if (dados.fpAtual < 0.92) {
    obs.push(
      'FP abaixo de 0,92: sujeito a multas na fatura de energia conforme ANEEL.',
    );
  }

  if (dados.fpAtual >= fpAlvo) {
    obs.push('FP atual já atende ao alvo. Nenhuma correção necessária no momento.');
  }

  if (dados.variacaoCargaPct !== undefined && dados.variacaoCargaPct > 15) {
    obs.push(
      'Variação de carga significativa: banco automático é mais indicado do que banco fixo.',
    );
  }

  if (dados.energiaAtivaKwh !== undefined && dados.energiaReativaKvarh !== undefined) {
    const fpCalculado =
      dados.energiaAtivaKwh /
      Math.sqrt(dados.energiaAtivaKwh ** 2 + dados.energiaReativaKvarh ** 2);

    obs.push(`FP estimado pela fatura (kWh/kVArh): ${fpCalculado.toFixed(3)}`);
  }

  if (dados.demandaMaxKw !== undefined && dados.demandaMinKw !== undefined) {
    const variacao =
      ((dados.demandaMaxKw - dados.demandaMinKw) / dados.demandaMaxKw) * 100;

    obs.push(`Variação de demanda estimada: ${variacao.toFixed(1)}%`);
  }

  if (qcKvar > 0 && qcKvar < 5) {
    obs.push(
      'Qc calculado menor que 5 kVAr: verifique se a correção é economicamente viável.',
    );
  }

  if (dados.tensaoV > 1000) {
    obs.push(
      'Instalação em média/alta tensão: exige capacitores e proteções específicas para esse nível.',
    );
  }

  return obs;
}

export function calcularBancoCapacitorIndustrial(
  dados: DadosNormalizadosFP,
  opcoes: OpcoesCalculo = {},
): ResultadoCalculadoraIndustrial {
  const fpAlvo = opcoes.fpAlvo ?? dados.fpAlvo ?? 0.95;
  const margemPct = opcoes.margemSegurancaPct ?? 5;
  const temInversores = dados.temInversores ?? false;

  const qcKvar = calcularQc(dados.potenciaAtivaKw, dados.fpAtual, fpAlvo);
  const qcComMargemKvar = aplicarMargem(qcKvar, margemPct);

  const nivelTensao = classificarNivelTensao(dados.tensaoV);
  const tipoLigacaoSugerida = sugerirLigacao(dados.tensaoV);
  const normaAplicavel = definirNorma(dados.tensaoV);
  const tensaoTrabalhoCapacitor = sugerirTensaoTrabalhoCapacitor(
    dados.tensaoV,
    temInversores,
  );

  const tipoBancoRecomendado = classificarTipoBanco(
    qcComMargemKvar,
    dados.variacaoCargaPct,
  );

  const banco = montarBanco(
    qcComMargemKvar,
    tipoBancoRecomendado,
    dados.variacaoCargaPct,
  );

  const precisaCorrecao = dados.fpAtual < fpAlvo;

  const mensagem = precisaCorrecao
    ? `Correção necessária: instalar ${qcComMargemKvar.toFixed(2)} kVAr para atingir FP ${fpAlvo}.`
    : `FP atual (${dados.fpAtual}) já atende ao alvo (${fpAlvo}). Nenhuma ação necessária.`;

  // Diagnóstico anti-harmônicos: empurra a recomendação para as observações
  // (renderizadas em lista pelo ResultadoTecnico) e também expõe os campos
  // estruturados para o card de alerta destacado.
  const harmonicos = diagnosticarHarmonicos(temInversores);
  const observacoesTecnicas = gerarObservacoesTecnicas(dados, qcKvar, fpAlvo);
  if (harmonicos.alerta && harmonicos.recomendacao) {
    observacoesTecnicas.push(harmonicos.recomendacao);
  }

  return {
    potenciaAtivaKw: dados.potenciaAtivaKw,
    fpAtual: dados.fpAtual,
    fpAlvo,
    tensaoV: dados.tensaoV,
    nivelTensao,
    qcKvar,
    qcComMargemKvar,
    tipoBancoRecomendado,
    tipoLigacaoSugerida,
    tensaoTrabalhoCapacitor,
    normaAplicavel,
    banco,
    precisaCorrecao,
    mensagem,
    observacoesTecnicas,
    alertaHarmonicos: harmonicos.alerta,
    recomendacaoHarmonicos: harmonicos.recomendacao,
  };
}
