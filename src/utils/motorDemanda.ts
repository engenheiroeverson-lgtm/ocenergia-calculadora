// src/utils/motorDemanda.ts
// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO II — Gestão de Demanda (Grupo A) + dimensionamento de BESS (linha WEG C&I)
// TypeScript puro, sem dependências externas.
//
// O motor: (1) reconstrói a fatura atual de demanda+energia dos 12 meses,
// (2) diagnostica ultrapassagem, (3) dimensiona o BESS para peak shaving na ponta
// + arbitragem (deslocar energia da ponta para fora-ponta), (4) recomenda a
// topologia (crítico vs. econômico) e o hardware WEG, e (5) simula a fatura
// otimizada, economia e payback.
//
// ✅ PARÂMETROS REGULATÓRIOS VERIFICADOS NA FONTE PRIMÁRIA (REN nº 1.000/2021).
//    Art. 301 (Seção VII — Da Ultrapassagem), redação consolidada c/ REN 1.059/2023:
//      C_ULTRAPASSAGEM(p) = [ DAM(p) − DAC(p) ] × 2 × VRDULT(p)
//    Gatilhos de tolerância (caput): 1% injeção/exportador/importador · 5% consumo
//    do consumidor · 10% outra distribuidora. Aqui tratamos CONSUMO → 5%.
//    Os 5% são GATILHO (liga/desliga a cobrança), não franquia dedutível: a base
//    do excedente é (DAM − DAC), sobre a contratada CHEIA. Multiplicador = 2×.
//    Validado contra o PDF oficial da ANEEL em 2026-06-24.
// ─────────────────────────────────────────────────────────────────────────────

export type Modalidade = 'Azul' | 'Verde';

// ── Parâmetros regulatórios (art. 301, REN 1.000/2021) ───────────────────────
export const PARAMETROS_REGULATORIOS = {
  // Tolerância (gatilho) sobre a demanda contratada de CONSUMO antes de incidir
  // ultrapassagem. REN 1.000/2021, art. 301, II → 5%. (Injeção/geração = 1%.)
  toleranciaUltrapassagem: 0.05, // ✅ art. 301, II (consumo)
  // Multiplicador da fórmula do art. 301, §1º: [DAM − DAC] × 2 × VRDULT.
  multiplicadorUltrapassagem: 2, // ✅ art. 301, §1º
};

// ── Parâmetros físicos/operacionais do BESS (ajustáveis) ─────────────────────
export const PARAMETROS_BESS = {
  eficienciaCiclo: 0.88, // 87–89% (round-trip) — material WEG; usado na arbitragem
  horasPonta: 3, // janela de ponta (ex.: 18h–21h)
  diasUteisMes: 21, // estimativa para energia diária a partir do consumo mensal
  profundidadeDescarga: 0.9, // DoD considerada para dimensionar energia útil
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
  referencia: string; // "01/2025"
  consumoPontaKwh: number;
  consumoForaPontaKwh: number;
  // Em AZUL: ponta e fora-ponta separados.
  // Em VERDE: use os campos "ForaPonta" como a demanda ÚNICA; os de ponta = 0.
  demandaMedidaPontaKw: number;
  demandaMedidaForaPontaKw: number;
  demandaContratadaPontaKw: number;
  demandaContratadaForaPontaKw: number;
}

export interface Tarifas {
  // R$/kW (TUSD demanda)
  tusdDemandaPonta: number;
  tusdDemandaForaPonta: number;
  // R$/kWh (TE + TUSD energia) — podem vir pré-preenchidas do seletor ANEEL do Módulo III
  tePonta: number;
  tusdEnergiaPonta: number;
  teForaPonta: number;
  tusdEnergiaForaPonta: number;
}

export interface EntradaModuloII {
  modalidade: Modalidade;
  cargaCritica: boolean; // "processos que não podem parar por 1 segundo?"
  meses: MesDemanda[]; // idealmente 12
  tarifas: Tarifas;
  capexBessReais?: number; // sem isto, o payback não é calculado (não inventamos preço)
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
  demandaPonta: CustoDemandaPosto | null; // null em Verde
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

// ── Núcleo: custo de demanda de um posto ─────────────────────────────────────
// MODELO (art. 301, REN 1.000/2021): se DAM ≤ (1 + tolerância)·DAC, não há
// ultrapassagem e fatura-se o maior entre medida e contratada. Se DAM exceder o
// gatilho, o excedente faturado é (DAM − DAC) — contratada CHEIA, NÃO descontando
// a tolerância — à tarifa de demanda × multiplicador (2×). A parcela "normal"
// volta a ser a contratada (DAC).
function calcularCustoDemanda(
  demandaMedidaKw: number,
  demandaContratadaKw: number,
  tusdDemanda: number,
  reg: typeof PARAMETROS_REGULATORIOS,
): CustoDemandaPosto {
  const limite = demandaContratadaKw * (1 + reg.toleranciaUltrapassagem);
  let demandaFaturavelKw: number;
  let demandaUltrapassagemKw = 0;

  if (demandaMedidaKw > limite) {
    demandaFaturavelKw = demandaContratadaKw;
    demandaUltrapassagemKw = demandaMedidaKw - demandaContratadaKw;
  } else {
    demandaFaturavelKw = Math.max(demandaMedidaKw, demandaContratadaKw);
  }

  const custoNormal = demandaFaturavelKw * tusdDemanda;
  const custoUltrapassagem = demandaUltrapassagemKw * tusdDemanda * reg.multiplicadorUltrapassagem;
  return {
    demandaFaturavelKw,
    demandaUltrapassagemKw,
    custoNormal,
    custoUltrapassagem,
    total: custoNormal + custoUltrapassagem,
  };
}

function calcularCustoEnergia(mes: MesDemanda, t: Tarifas): number {
  return (
    mes.consumoPontaKwh * (t.tePonta + t.tusdEnergiaPonta) +
    mes.consumoForaPontaKwh * (t.teForaPonta + t.tusdEnergiaForaPonta)
  );
}

function calcularFaturaMensal(
  mes: MesDemanda,
  modalidade: Modalidade,
  t: Tarifas,
  reg: typeof PARAMETROS_REGULATORIOS,
): FaturaMensal {
  const custoEnergia = calcularCustoEnergia(mes, t);

  let demandaPonta: CustoDemandaPosto | null = null;
  let demandaForaPonta: CustoDemandaPosto;

  if (modalidade === 'Azul') {
    demandaPonta = calcularCustoDemanda(
      mes.demandaMedidaPontaKw, mes.demandaContratadaPontaKw, t.tusdDemandaPonta, reg,
    );
    demandaForaPonta = calcularCustoDemanda(
      mes.demandaMedidaForaPontaKw, mes.demandaContratadaForaPontaKw, t.tusdDemandaForaPonta, reg,
    );
  } else {
    // VERDE: demanda única faturada pela tarifa de fora-ponta.
    demandaForaPonta = calcularCustoDemanda(
      mes.demandaMedidaForaPontaKw, mes.demandaContratadaForaPontaKw, t.tusdDemandaForaPonta, reg,
    );
  }

  const totalDemanda = (demandaPonta?.total ?? 0) + demandaForaPonta.total;
  const houveUltrapassagem =
    (demandaPonta?.demandaUltrapassagemKw ?? 0) > 0 || demandaForaPonta.demandaUltrapassagemKw > 0;

  return {
    referencia: mes.referencia,
    custoEnergia,
    demandaPonta,
    demandaForaPonta,
    totalDemanda,
    totalMes: custoEnergia + totalDemanda,
    houveUltrapassagem,
  };
}

// ── Dimensionamento do BESS ──────────────────────────────────────────────────
function dimensionarBess(
  meses: MesDemanda[],
  bess: typeof PARAMETROS_BESS,
): DimensionamentoBess {
  // Potência: cobrir o maior pico de demanda na ponta (zera a ponta na rede).
  const picoPontaKw = Math.max(...meses.map((m) => m.demandaMedidaPontaKw || 0), 0);

  // Energia diária a entregar na ponta: maior consumo de ponta mensal / dias úteis.
  const energiaUtilDiariaKwh = Math.max(
    ...meses.map((m) => (m.consumoPontaKwh || 0) / bess.diasUteisMes),
    0,
  );

  // A energia precisa: (a) sustentar a potência pela janela de ponta, e
  // (b) cobrir o consumo diário de ponta. Pegamos o maior e ajustamos por DoD.
  const energiaPorJanela = picoPontaKw * bess.horasPonta;
  const energiaNecessaria = Math.max(energiaUtilDiariaKwh, energiaPorJanela);
  const energiaKwh = energiaNecessaria / bess.profundidadeDescarga;

  return {
    potenciaKw: Math.ceil(picoPontaKw),
    energiaKwh: Math.ceil(energiaKwh),
    energiaUtilDiariaKwh: Math.ceil(energiaUtilDiariaKwh),
  };
}

// ── Topologia (inteligência WEG) ─────────────────────────────────────────────
function recomendarTopologia(cargaCritica: boolean): RecomendacaoTopologia {
  if (cargaCritica) {
    return {
      tipo: 'Dupla Conversão Unidirecional',
      conexao: 'Em série com a rede (rede condicionada)',
      tempoAtuacao: '0 ms (atuação instantânea, sem transferência)',
      enfase:
        'Proteção de processo contínuo: evita perda de matéria-prima por qualquer interrupção (referência: case WEG Ibiúna/SP).',
    };
  }
  return {
    tipo: 'Bidirecional Clássico (AC Coupling)',
    conexao: 'Em paralelo com a rede',
    tempoAtuacao: 'Comutação via chave estática STS (< 10–20 ms)',
    enfase:
      'Máxima flexibilidade e retorno financeiro: peak shaving, arbitragem e integração com solar/gerador.',
  };
}

// ── Seleção de hardware ──────────────────────────────────────────────────────
function selecionarHardware(potenciaKw: number, energiaKwh: number): RecomendacaoHardware {
  const candidatos = CATALOGO_WEG_CI
    .filter((m) => m.potenciaKw >= potenciaKw && m.energiaKwh >= energiaKwh)
    .sort((a, b) => a.potenciaKw - b.potenciaKw || a.energiaKwh - b.energiaKwh);

  if (candidatos.length > 0) {
    const m = candidatos[0];
    return {
      tipo: 'unidade-unica',
      modeloBase: m,
      quantidade: 1,
      descricao: `${m.modelo} (${m.potenciaKw} kW / ${m.energiaKwh} kWh) — All-in-One WEG atende em unidade única.`,
    };
  }

  // Acima da faixa C&I de unidade única → utility-scale (faixas do material WEG).
  if (potenciaKw > 1000 || energiaKwh > 1000) {
    return {
      tipo: 'utility',
      descricao:
        `Demanda de grande porte (${potenciaKw} kW / ${energiaKwh} kWh): indicar solução utility — ` +
        'Container de Baterias (3 a 5 MWh) e/ou Skid MT (1 a 3,5 MW).',
    };
  }

  // Porte intermediário → múltiplas unidades C&I em paralelo (estimativa).
  const maior = CATALOGO_WEG_CI.reduce((a, b) =>
    a.potenciaKw * a.energiaKwh >= b.potenciaKw * b.energiaKwh ? a : b,
  );
  const n = Math.max(
    Math.ceil(potenciaKw / maior.potenciaKw),
    Math.ceil(energiaKwh / maior.energiaKwh),
  );
  return {
    tipo: 'multiplas-unidades',
    modeloBase: maior,
    quantidade: n,
    descricao:
      `${n}× ${maior.modelo} em paralelo (${n * maior.potenciaKw} kW / ${n * maior.energiaKwh} kWh) ` +
      'para atender potência e energia requeridas.',
  };
}

// ── Fatura otimizada com BESS ────────────────────────────────────────────────
// Estratégia: zera ultrapassagem; reduz a DC de ponta para ~0 (BESS cobre a ponta)
// e mantém a DC de fora-ponta no pico medido; desloca o consumo de ponta para
// fora-ponta acrescido da perda de ciclo (1/η).
function simularFaturaOtimizada(
  meses: MesDemanda[],
  modalidade: Modalidade,
  t: Tarifas,
  reg: typeof PARAMETROS_REGULATORIOS,
  bess: typeof PARAMETROS_BESS,
): { faturaAnual: number; dcOtimaPonta: number; dcOtimaForaPonta: number } {
  const dcOtimaPonta = 0; // ponta coberta pelo BESS
  const dcOtimaForaPonta = Math.ceil(
    Math.max(...meses.map((m) => m.demandaMedidaForaPontaKw || 0), 0),
  );

  let faturaAnual = 0;
  for (const m of meses) {
    // Energia: ponta migra para fora-ponta com perda de ciclo.
    const consumoPontaMigrado = m.consumoPontaKwh / bess.eficienciaCiclo;
    const mesOtimizado: MesDemanda = {
      ...m,
      consumoPontaKwh: 0,
      consumoForaPontaKwh: m.consumoForaPontaKwh + consumoPontaMigrado,
      demandaMedidaPontaKw: 0,
      demandaContratadaPontaKw: dcOtimaPonta,
      // a demanda medida de fora-ponta permanece; contratada ajustada ao pico
      demandaContratadaForaPontaKw: dcOtimaForaPonta,
    };
    faturaAnual += calcularFaturaMensal(mesOtimizado, modalidade, t, reg).totalMes;
  }
  return { faturaAnual, dcOtimaPonta, dcOtimaForaPonta };
}

function fluxoCaixa10Anos(
  economiaAnual: number,
  capex: number | null,
): { ano: number; fluxoAcumulado: number }[] {
  const base = capex ?? 0;
  const fluxo = [{ ano: 0, fluxoAcumulado: -base }];
  let acc = -base;
  for (let ano = 1; ano <= 10; ano++) {
    acc += economiaAnual;
    fluxo.push({ ano, fluxoAcumulado: Math.round(acc) });
  }
  return fluxo;
}

// ── Orquestrador ──────────────────────────────────────────────────────────────
export function simularModuloII(entrada: EntradaModuloII): ResultadoModuloII {
  const reg = entrada.parametrosRegulatorios ?? PARAMETROS_REGULATORIOS;
  const bess = entrada.parametrosBess ?? PARAMETROS_BESS;
  const avisos: string[] = [];

  if (entrada.meses.length < 12) {
    avisos.push(`Apenas ${entrada.meses.length} meses informados; o ideal são 12 para captar sazonalidade.`);
  }

  // 1) Fatura atual mês a mês
  const faturasAtuais = entrada.meses.map((m) =>
    calcularFaturaMensal(m, entrada.modalidade, entrada.tarifas, reg),
  );
  const mesesComUltrapassagem = faturasAtuais.filter((f) => f.houveUltrapassagem).map((f) => f.referencia);
  const faturaAtualAnual = faturasAtuais.reduce((s, f) => s + f.totalMes, 0);

  // 2) Dimensionamento BESS
  const dimensionamento = dimensionarBess(entrada.meses, bess);

  // 3) Topologia e hardware
  const topologia = recomendarTopologia(entrada.cargaCritica);
  const hardware = selecionarHardware(dimensionamento.potenciaKw, dimensionamento.energiaKwh);

  // 4) Fatura otimizada
  const otimizada = simularFaturaOtimizada(entrada.meses, entrada.modalidade, entrada.tarifas, reg, bess);
  const economiaAnual = faturaAtualAnual - otimizada.faturaAnual;
  const reducaoPercentual = faturaAtualAnual > 0 ? (economiaAnual / faturaAtualAnual) * 100 : 0;

  // 5) Financeiro
  const capex = entrada.capexBessReais ?? null;
  if (capex == null) {
    avisos.push('CAPEX do BESS não informado — payback não calculado. Informe o investimento (R$) para o ROI.');
  }
  const paybackAnos = capex != null && economiaAnual > 0 ? capex / economiaAnual : null;

  avisos.push(
    'Ultrapassagem conforme REN 1.000/2021, art. 301: gatilho 5% (consumo) e multiplicador 2× sobre (DAM − DAC). ' +
    'O VRDULT oficial é a tarifa de demanda do subgrupo; este motor usa a TUSD de demanda informada como aproximação do VRDULT.',
  );

  return {
    faturasAtuais,
    ultrapassagemDetectada: mesesComUltrapassagem.length > 0,
    mesesComUltrapassagem,
    dimensionamento,
    demandaContratadaOtimaPonta: otimizada.dcOtimaPonta,
    demandaContratadaOtimaForaPonta: otimizada.dcOtimaForaPonta,
    topologia,
    hardware,
    financeiro: {
      faturaAtualAnual,
      faturaOtimizadaAnual: otimizada.faturaAnual,
      economiaAnual,
      reducaoPercentual,
      capexBessReais: capex,
      paybackAnos,
      fluxoCaixa10Anos: fluxoCaixa10Anos(economiaAnual, capex),
    },
    avisos,
  };
}
