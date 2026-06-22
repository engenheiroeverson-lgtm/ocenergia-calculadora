#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seu_script_aneel.py — Descobridor de ESQUEMA + extrator de GRAFIAS da base de
tarifas da ANEEL (Dados Abertos / CKAN).

Objetivo
--------
Travar a grafia EXATA dos valores de filtro usados pelo app (distribuidora,
subgrupo, modalidade, posto, base tarifária e componente), para alimentar os
dropdowns/filtros sem chutar a grafia (ex.: "Fora ponta" vs "Fora de Ponta",
nome real da distribuidora de MT, etc.).

Filosofia (honestidade > suposição)
-----------------------------------
- NÃO assume nomes de coluna. Primeiro consulta `datastore_search` (limit=1)
  para ler os CAMPOS REAIS do recurso e imprime esse esquema.
- Só então extrai DISTINCT das colunas de grafia que REALMENTE existirem,
  resolvendo entre nomes candidatos (a base "Componentes Tarifárias" usa
  SigNomeAgente/DscSubGrupoTarifario/DscPostoTarifario; outras visões podem
  usar nomes diferentes).
- Avisa de forma explícita se o recurso NÃO tiver as colunas que o app espera
  (ex.: VlrTE/VlrTUSD não existem na base de Componentes Tarifárias, que é
  formato longo via DscComponenteTarifario/VlrComponenteTarifario).

Uso
---
    python seu_script_aneel.py
    ANEEL_RESOURCE_ID=<outro-id> python seu_script_aneel.py   # sobrescreve o recurso

Saída: imprime no log e grava `grafias-aneel.json` no diretório atual.
"""
import json
import os
import sys
import time
import requests

ACTION_BASE = "https://dadosabertos.aneel.gov.br/api/3/action"

# Recurso padrão = o que está no app hoje. PODE estar desatualizado ou ter
# esquema diferente; por isso o script descobre os campos em runtime.
# (Confirmado por leitura do CSV: o recurso de "Componentes Tarifárias" 2026 é
#  e8717aa8-2521-453f-bf16-fbb9a16eea39 — use ANEEL_RESOURCE_ID para apontar.)
RESOURCE_ID = os.environ.get(
    "ANEEL_RESOURCE_ID", "fcf2906c-7c32-4b9b-a637-054e7a5234f4"
)

TIMEOUT = 60

# Colunas de grafia: chave lógica -> lista de NOMES CANDIDATOS (o 1º que existir
# no esquema real é usado). Cobrimos as variações conhecidas entre as visões.
COLUNAS_CANDIDATAS = {
    "distribuidoras": ["SigNomeAgente", "SigAgente", "NomAgente"],
    "subgrupos":      ["DscSubGrupoTarifario", "DscSubGrupo", "DscSubgrupo"],
    "modalidades":    ["DscModalidadeTarifaria"],
    "postos":         ["DscPostoTarifario", "NomPostoTarifario"],
    "base_tarifaria": ["DscBaseTarifaria"],
    "componentes":    ["DscComponenteTarifario"],
}

# Colunas que o app ATUAL espera mas que podem não existir neste recurso.
COLUNAS_ESPERADAS_PELO_APP = ["VlrTE", "VlrTUSD"]


def _post_action(action: str, payload: dict) -> dict:
    """Chama uma action do CKAN via POST JSON. Levanta RuntimeError com a
    mensagem da API se success=false."""
    url = f"{ACTION_BASE}/{action}"
    r = requests.post(url, json=payload, timeout=TIMEOUT)
    try:
        data = r.json()
    except ValueError:
        raise RuntimeError(f"Resposta não-JSON (HTTP {r.status_code}) de {action}")
    if not data.get("success"):
        raise RuntimeError(json.dumps(data.get("error", {}), ensure_ascii=False))
    return data["result"]


def descobrir_campos(resource_id: str) -> list[str]:
    """Lê os campos reais do recurso via datastore_search (limit=1)."""
    result = _post_action("datastore_search", {"resource_id": resource_id, "limit": 1})
    campos = [f["id"] for f in result.get("fields", []) if f.get("id") != "_id"]
    return campos


def distinct_coluna(resource_id: str, coluna: str) -> list[str]:
    """DISTINCT de uma coluna via datastore_search_sql."""
    sql = (
        f'SELECT DISTINCT "{coluna}" AS v FROM "{resource_id}" '
        f'WHERE "{coluna}" IS NOT NULL ORDER BY "{coluna}"'
    )
    result = _post_action("datastore_search_sql", {"sql": sql})
    vals = []
    for rec in result.get("records", []):
        v = rec.get("v")
        if v is None:
            continue
        v = str(v).strip()
        if v:
            vals.append(v)
    # dedup preservando ordem
    seen, out = set(), []
    for v in vals:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def main() -> int:
    print("=" * 70)
    print(f"ANEEL — sincronização de grafias  |  recurso: {RESOURCE_ID}")
    print("=" * 70)

    # 1) Descobrir o esquema real (passo de honestidade — nada é assumido).
    try:
        campos = descobrir_campos(RESOURCE_ID)
    except Exception as e:
        print(f"[FATAL] Não foi possível ler o esquema do recurso: {e}", file=sys.stderr)
        print("        Verifique o RESOURCE_ID e se o datastore está ativo.", file=sys.stderr)
        return 1

    print(f"\n[ESQUEMA] {len(campos)} colunas encontradas:")
    for c in campos:
        print(f"  - {c}")

    # 1b) Avisar sobre colunas que o app espera e que podem não existir.
    faltando_app = [c for c in COLUNAS_ESPERADAS_PELO_APP if c not in campos]
    if faltando_app:
        print(
            "\n[ALERTA] O app espera estas colunas que NÃO existem neste recurso: "
            + ", ".join(faltando_app)
        )
        if "DscComponenteTarifario" in campos:
            print(
                "         Este recurso é FORMATO LONGO: use DscComponenteTarifario "
                "('TE','TUSD',...) + VlrComponenteTarifario, filtrando "
                "DscBaseTarifaria='Tarifa de Aplicação'."
            )

    # 2) Resolver e extrair grafias só das colunas que existem.
    resultado = {
        "_fonte": ACTION_BASE,
        "_recurso": RESOURCE_ID,
        "_gerado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "_campos_do_recurso": campos,
        "_colunas_resolvidas": {},
    }
    erros = {}

    for chave, candidatas in COLUNAS_CANDIDATAS.items():
        coluna = next((c for c in candidatas if c in campos), None)
        if coluna is None:
            print(f"\n[SKIP] {chave}: nenhuma coluna candidata existe "
                  f"({', '.join(candidatas)})")
            continue
        resultado["_colunas_resolvidas"][chave] = coluna
        try:
            vals = distinct_coluna(RESOURCE_ID, coluna)
            resultado[chave] = vals
            print(f"\n[OK] {chave}  ->  coluna \"{coluna}\"  ({len(vals)} valores)")
            for v in vals[:40]:
                print(f"     - {v}")
            if len(vals) > 40:
                print(f"     ... (+{len(vals) - 40})")
        except Exception as e:
            erros[chave] = str(e)
            print(f"\n[ERRO] {chave} (coluna {coluna}): {e}", file=sys.stderr)

    if erros:
        resultado["_erros"] = erros

    with open("grafias-aneel.json", "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print("\nArquivo gravado: grafias-aneel.json")

    # Falha o job só se NADA de grafia saiu (sinaliza vermelho no Actions).
    extraiu_algo = any(k in resultado for k in COLUNAS_CANDIDATAS)
    return 0 if extraiu_algo else 1


if __name__ == "__main__":
    sys.exit(main())
