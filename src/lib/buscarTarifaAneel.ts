// src/lib/buscarTarifaAneel.ts
// Helper de cliente para consumir a função serverless /api/aneel-tarifas.

export interface TarifaAneel {
  agente: string;
  subgrupo: string;
  modalidade: string;
  posto: string;
  detalhe?: string;
  unidade?: string;
  vlrTe: number | null;   // líquida (sem tributos) — passe ao calcularTarifaPorDentro
  vlrTusd: number | null; // líquida (sem tributos)
  inicioVigencia: string;
}

export async function buscarTarifasAneel(params: {
  agente?: string;
  subgrupo?: string;     // ex.: "A4"
  modalidade?: string;   // ex.: "Verde" (confirmar grafia com listarValoresAneel)
  posto?: string;        // ex.: "Ponta" / "Fora ponta" (confirmar grafia)
}): Promise<TarifaAneel[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const resp = await fetch(`/api/aneel-tarifas?${qs.toString()}`);
  if (!resp.ok) throw new Error(`Falha ao buscar tarifa ANEEL (HTTP ${resp.status})`);
  const data = await resp.json();
  return (data.tarifas ?? []) as TarifaAneel[];
}

// Descoberta: rode UMA vez para capturar a grafia real e travar os filtros.
export async function listarValoresAneel(
  tipo: 'agentes' | 'subgrupos' | 'modalidades' | 'postos',
): Promise<string[]> {
  const resp = await fetch(`/api/aneel-tarifas?listar=${tipo}`);
  if (!resp.ok) throw new Error(`Falha ao listar ${tipo} (HTTP ${resp.status})`);
  const data = await resp.json();
  return (data.valores ?? []) as string[];
}
