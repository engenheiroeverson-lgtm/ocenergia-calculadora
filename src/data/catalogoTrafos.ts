export interface ConfigPasso {
  potenciaKvar: number;
  quantidade: number;
}

export interface ProjektPadraoTrafo {
  id: string;
  potenciaTrafoKva: number;
  tensaoVca: number;
  potenciaTotalKvar: number;
  passos: ConfigPasso[];
  disjuntorGeral: string;
  controlador: string;
  caixaComando: string;
  precisaTrafoComando: boolean;
  precisaVentilacaoAtiva: boolean;
}

export const CATALOGO_TRAFOS: ProjektPadraoTrafo[] = [
  // ── FAMÍLIA 15 KVA ─────────────────────────────────────────────────────────
  {
    id: "trafo_15_220v",
    potenciaTrafoKva: 15,
    tensaoVca: 220,
    potenciaTotalKvar: 9.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 2 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 63A",
    controlador: "12 Saídas",
    caixaComando: "600X500X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: false
  },
  {
    id: "trafo_15_380v",
    potenciaTrafoKva: 15,
    tensaoVca: 380,
    potenciaTotalKvar: 9.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 2 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 40A",
    controlador: "12 Saídas",
    caixaComando: "600X500X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: false
  },
  {
    id: "trafo_15_440v",
    potenciaTrafoKva: 15,
    tensaoVca: 440,
    potenciaTotalKvar: 9.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 2 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 32A",
    controlador: "12 Saídas",
    caixaComando: "600X500X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: false
  },

  // ── FAMÍLIA 30 KVA ─────────────────────────────────────────────────────────
  {
    id: "trafo_30_220v",
    potenciaTrafoKva: 30,
    tensaoVca: 220,
    potenciaTotalKvar: 21,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 100A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_30_380v",
    potenciaTrafoKva: 30,
    tensaoVca: 380,
    potenciaTotalKvar: 17,
    passos: [
      { potenciaKvar: 1.0, quantidade: 2 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 50A",
    controlador: "12 Saídas",
    caixaComando: "600X500X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: false
  },
  {
    id: "trafo_30_440v",
    potenciaTrafoKva: 30,
    tensaoVca: 440,
    potenciaTotalKvar: 21,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 50A",
    controlador: "12 Saídas",
    caixaComando: "600X500X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: false
  },

  // ── FAMÍLIA 45 KVA ─────────────────────────────────────────────────────────
  {
    id: "trafo_45_220v",
    potenciaTrafoKva: 45,
    tensaoVca: 220,
    potenciaTotalKvar: 27.5,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 2 }
    ],
    disjuntorGeral: "Trifásico 125A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_45_380v",
    potenciaTrafoKva: 45,
    tensaoVca: 380,
    potenciaTotalKvar: 28.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 2 }
    ],
    disjuntorGeral: "Trifásico 80A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_45_440v",
    potenciaTrafoKva: 45,
    tensaoVca: 440,
    potenciaTotalKvar: 28.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 2 }
    ],
    disjuntorGeral: "Trifásico 63A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 75 KVA ─────────────────────────────────────────────────────────
  {
    id: "trafo_75_220v",
    potenciaTrafoKva: 75,
    tensaoVca: 220,
    potenciaTotalKvar: 48.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 2 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 200A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_75_380v",
    potenciaTrafoKva: 75,
    tensaoVca: 380,
    potenciaTotalKvar: 46,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 12.5, quantidade: 1 },
      { potenciaKvar: 17.5, quantidade: 1 }
    ],
    disjuntorGeral: "Trifásico 125A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_75_440v",
    potenciaTrafoKva: 75,
    tensaoVca: 440,
    potenciaTotalKvar: 48.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 2 }
    ],
    disjuntorGeral: "Trifásico 100A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 112,5 KVA ──────────────────────────────────────────────────────
  {
    id: "trafo_112_5_220v",
    potenciaTrafoKva: 112.5,
    tensaoVca: 220,
    potenciaTotalKvar: 67.5,
    passos: [
      { potenciaKvar: 2.5, quantidade: 2 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 2 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 300A",
    controlador: "12 Saídas",
    caixaComando: "1200X800X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_112_5_380v",
    potenciaTrafoKva: 112.5,
    tensaoVca: 380,
    potenciaTotalKvar: 68.5,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 2 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 1 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 160A",
    controlador: "12 Saídas",
    caixaComando: "1000X800X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_112_5_440v",
    potenciaTrafoKva: 112.5,
    tensaoVca: 440,
    potenciaTotalKvar: 67.5,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 2 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 1 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 150A",
    controlador: "12 Saídas",
    caixaComando: "800X600X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 150 KVA ────────────────────────────────────────────────────────
  {
    id: "trafo_150_220v",
    potenciaTrafoKva: 150,
    tensaoVca: 220,
    potenciaTotalKvar: 90,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 4 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 350A",
    controlador: "12 Saídas",
    caixaComando: "1200X800X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_150_380v",
    potenciaTrafoKva: 150,
    tensaoVca: 380,
    potenciaTotalKvar: 91,
    passos: [
      { potenciaKvar: 1.0, quantidade: 1 },
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 2 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 200A",
    controlador: "12 Saídas",
    caixaComando: "1000X800X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_150_440v",
    potenciaTrafoKva: 150,
    tensaoVca: 440,
    potenciaTotalKvar: 90,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 2 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 200A",
    controlador: "12 Saídas",
    caixaComando: "1000X800X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 225 KVA ────────────────────────────────────────────────────────
  {
    id: "trafo_225_220v",
    potenciaTrafoKva: 225,
    tensaoVca: 220,
    potenciaTotalKvar: 135,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 7 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 450A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_225_380v",
    potenciaTrafoKva: 225,
    tensaoVca: 380,
    potenciaTotalKvar: 107.5,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 2 },
      { potenciaKvar: 17.5, quantidade: 3 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 300A",
    controlador: "12 Saídas",
    caixaComando: "1000X800X250MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_225_440v",
    potenciaTrafoKva: 225,
    tensaoVca: 440,
    potenciaTotalKvar: 90,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 2 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 250A",
    controlador: "12 Saídas",
    caixaComando: "1000X800X250MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 300 KVA ────────────────────────────────────────────────────────
  {
    id: "trafo_300_220v",
    potenciaTrafoKva: 300,
    tensaoVca: 220,
    potenciaTotalKvar: 180,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 3 },
      { potenciaKvar: 15.0, quantidade: 9 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 650A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_300_380v",
    potenciaTrafoKva: 300,
    tensaoVca: 380,
    potenciaTotalKvar: 180,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 7 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 350A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_300_440v",
    potenciaTrafoKva: 300,
    tensaoVca: 440,
    potenciaTotalKvar: 180,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 7 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 350A",
    controlador: "12 Saídas (Via Trafo de Comando)",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 500 KVA ────────────────────────────────────────────────────────
  {
    id: "trafo_500_220v",
    potenciaTrafoKva: 500,
    tensaoVca: 220,
    potenciaTotalKvar: 300,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 3 },
      { potenciaKvar: 15.0, quantidade: 17 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1200A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_500_380v",
    potenciaTrafoKva: 500,
    tensaoVca: 380,
    potenciaTotalKvar: 300,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 3 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 12 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 650A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_500_440v",
    potenciaTrafoKva: 500,
    tensaoVca: 440,
    potenciaTotalKvar: 310,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 3 },
      { potenciaKvar: 20.0, quantidade: 12 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 650A",
    controlador: "12 Saídas (Via Trafo de Comando)",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 750 KVA ────────────────────────────────────────────────────────
  {
    id: "trafo_750_220v",
    potenciaTrafoKva: 750,
    tensaoVca: 220,
    potenciaTotalKvar: 450,
    passos: [
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 28 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1600A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_750_380v",
    potenciaTrafoKva: 750,
    tensaoVca: 380,
    potenciaTotalKvar: 530,
    passos: [
      { potenciaKvar: 2.5, quantidade: 1 },
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 24 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1000A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_750_440v",
    potenciaTrafoKva: 750,
    tensaoVca: 440,
    potenciaTotalKvar: 450,
    passos: [
      { potenciaKvar: 5.0, quantidade: 2 },
      { potenciaKvar: 10.0, quantidade: 2 },
      { potenciaKvar: 20.0, quantidade: 21 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 800A",
    controlador: "12 Saídas (Via Trafo de Comando)",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 1000 KVA ───────────────────────────────────────────────────────
  {
    id: "trafo_1000_380v",
    potenciaTrafoKva: 1000,
    tensaoVca: 380,
    potenciaTotalKvar: 600,
    passos: [
      { potenciaKvar: 5.0, quantidade: 1 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 4 },
      { potenciaKvar: 12.5, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 26 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1400A",
    controlador: "12 Saídas",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: false,
    precisaVentilacaoAtiva: true
  },
  {
    id: "trafo_1000_440v",
    potenciaTrafoKva: 1000,
    tensaoVca: 440,
    potenciaTotalKvar: 567.5,
    passos: [
      { potenciaKvar: 5.0, quantidade: 3 },
      { potenciaKvar: 7.5, quantidade: 1 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 1 },
      { potenciaKvar: 20.0, quantidade: 26 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1200A",
    controlador: "12 Saídas (Via Trafo de Comando)",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  },

  // ── FAMÍLIA 1500 KVA ───────────────────────────────────────────────────────
  {
    id: "trafo_1500_440v",
    potenciaTrafoKva: 1500,
    tensaoVca: 440,
    potenciaTotalKvar: 950,
    passos: [
      { potenciaKvar: 5.0, quantidade: 4 },
      { potenciaKvar: 10.0, quantidade: 1 },
      { potenciaKvar: 15.0, quantidade: 8 },
      { potenciaKvar: 20.0, quantidade: 40 }
    ],
    disjuntorGeral: "Caixa Moldada Tripolar 1600A",
    controlador: "12 Saídas (Via Trafo de Comando)",
    caixaComando: "1900X800X600MM",
    precisaTrafoComando: true,
    precisaVentilacaoAtiva: true
  }
];
