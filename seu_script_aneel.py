#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seu_script_aneel.py — Extrator de GRAFIAS da base de Tarifas de aplicação da
ANEEL (Dados Abertos / CKAN), para alimentar os dropdowns do app sem chutar a
grafia (ex.: "Fora ponta", sigla real da distribuidora de MT = "EMT", etc.).

VALIDADO EM PRODUÇÃO (22/06/2026):
  - Recurso: fcf2906c-7c32-4b9b-a637-054e7a5234f4 ("Tarifas de aplicação").
  - datastore_search_sql está FORA -> NÃO usar SELECT DISTINCT.
  - O parâmetro `q` (full-text) não responde nesse datastore -> NÃO usar.
  - datastore_search FUNCIONA -> varremos a tabela paginando por offset,
    projetando só as colunas de grafia (fields) para deixar leve, e
    acumulamos os valores DISTINTOS em memória.

Filosofia (honestidade > suposição):
  - Não assume nomes de coluna: lê os CAMPOS REAIS do recurso (1 página) e
    resolve cada filtro lógico para o primeiro nome candidato que existir.
  - Avisa explicitamente se alguma coluna esperada não existir no recurso.

Uso:
    python seu_script_aneel.py
    ANEEL_RESOURCE_ID=<outro-id> python seu_script_aneel.py   # troca o recurso
    GRAFIAS_OUTPUT=public/grafias-aneel.json python seu_script_aneel.py

Saída: grava o JSON no caminho de GRAFIAS_OUTPUT (padrão: public/grafias-aneel.json).
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

SEARCH_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search"

RESOURCE_ID = os.environ.get("ANEEL_RESOURCE_ID", "fcf2906c-7c32-4b9b-a637-054e7a5234f4")
OUTPUT = os.environ.get("GRAFIAS_OUTPUT", "public/grafias-aneel.json")
PAGE_SIZE = int(os.environ.get("ANEEL_PAGE_SIZE", "10000"))
TIMEOUT = int(os.environ.get("ANEEL_TIMEOUT", "60"))
MAX_RETRIES = int(os.environ.get("ANEEL_MAX_RETRIES", "3"))

# Filtro lógico -> nomes de coluna CANDIDATOS (o 1º que existir é usado).
# A grafia confirmada do recurso fcf2906c vem primeiro; mantemos alternativas
# para o script sobreviver a uma eventual troca de recurso.
COLUNAS_CANDIDATAS = {
    "distribuidoras": ["SigAgente", "SigNomeAgente", "NomAgente"],
    "subgrupos":      ["DscSubGrupo", "DscSubGrupoTarifario", "DscSubgrupo"],
    "modalidades":    ["DscModalidadeTarifaria"],
    "postos":         ["NomPostoTarifario", "DscPostoTarifario"],
    "detalhes":       ["DscDetalhe"],
}


def chamar(params):
    """GET no datastore_search com retries e backoff. Levanta em caso de falha."""
    ultimo_erro = None
    for tentativa in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(
                SEARCH_URL,
                params=params,
                timeout=TIMEOUT,
                headers={"User-Agent": "ocenergia-grafias/1.0"},
            )
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                raise RuntimeError("CKAN respondeu success=false")
            return data["result"]
        except Exception as e:  # noqa: BLE001 (queremos capturar tudo p/ retry)
            ultimo_erro = e
            espera = 2 ** tentativa
            print(f"  ! tentativa {tentativa}/{MAX_RETRIES} falhou ({e}); "
                  f"aguardando {espera}s", file=sys.stderr)
            time.sleep(espera)
    raise RuntimeError(f"Falha após {MAX_RETRIES} tentativas: {ultimo_erro}")


def descobrir_campos():
    """Lê 1 página para obter os nomes REAIS das colunas do recurso."""
    result = chamar({"resource_id": RESOURCE_ID, "limit": 1})
    campos = [f["id"] for f in result.get("fields", [])]
    print(f"Campos reais do recurso ({len(campos)}): {campos}")
    return campos


def resolver_colunas(campos_reais):
    """Mapeia cada filtro lógico para a 1ª coluna candidata existente."""
    resolvido = {}
    for chave, candidatos in COLUNAS_CANDIDATAS.items():
        achou = next((c for c in candidatos if c in campos_reais), None)
        if achou:
            resolvido[chave] = achou
        else:
            print(f"  ! AVISO: nenhuma coluna candidata p/ '{chave}' "
                  f"({candidatos}) existe no recurso — será ignorada.",
                  file=sys.stderr)
    if not resolvido:
        raise RuntimeError("Nenhuma coluna de grafia foi encontrada no recurso.")
    print(f"Colunas resolvidas: {resolvido}")
    return resolvido


def varrer_distintos(colunas):
    """Pagina a tabela inteira acumulando valores distintos por coluna."""
    fields = sorted(set(colunas.values()))
    distintos = {chave: set() for chave in colunas}
    offset = 0
    total = None
    lidos = 0

    while True:
        result = chamar({
            "resource_id": RESOURCE_ID,
            "limit": PAGE_SIZE,
            "offset": offset,
            "fields": ",".join(fields),
        })
        if total is None:
            total = result.get("total")
            print(f"Total informado pela ANEEL: {total}")

        recs = result.get("records", [])
        if not recs:
            break

        for r in recs:
            for chave, coluna in colunas.items():
                v = r.get(coluna)
                if v is not None and str(v).strip():
                    distintos[chave].add(str(v).strip())

        lidos += len(recs)
        # Avança pelo número REAL de registros recebidos (robusto a um eventual
        # teto de página menor que o solicitado pelo servidor).
        offset += len(recs)
        print(f"  offset {offset:>8} | acumulado {lidos}")

        if total is not None and offset >= total:
            break
        if offset > 5_000_000:  # trava de segurança
            print("  ! limite de segurança atingido — interrompendo varredura.",
                  file=sys.stderr)
            break

    return distintos, lidos, total


def main():
    print(f"Recurso: {RESOURCE_ID}")
    print(f"Página: {PAGE_SIZE} | timeout: {TIMEOUT}s | saída: {OUTPUT}")

    campos = descobrir_campos()
    colunas = resolver_colunas(campos)
    distintos, lidos, total = varrer_distintos(colunas)

    saida = {
        "geradoEm": datetime.now(timezone.utc).isoformat(),
        "resourceId": RESOURCE_ID,
        "registrosLidos": lidos,
        "totalInformadoAneel": total,
        "colunasUsadas": colunas,
    }
    for chave in colunas:
        valores = sorted(distintos[chave])
        saida[chave] = valores
        print(f"{chave}: {len(valores)} distintos")

    destino_dir = os.path.dirname(OUTPUT)
    if destino_dir:
        os.makedirs(destino_dir, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

    print(f"OK -> {OUTPUT}")


if __name__ == "__main__":
    main()
