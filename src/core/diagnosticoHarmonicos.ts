// src/core/diagnosticoHarmonicos.ts
//
// Diagnóstico anti-harmônicos para correção de fator de potência.
// Função pura, sem dependências — fácil de testar e reusar.
//
// Regra de engenharia: cargas não-lineares (inversores de frequência / drives,
// ex. linha WEG CFW) injetam correntes harmônicas. Capacitores instalados nesse
// ambiente SEM reator de dessintonia podem formar circuito ressonante com a
// indutância da rede, amplificar harmônicos, sobreaquecer e falhar.

export interface DiagnosticoHarmonicos {
  alerta: boolean;
  recomendacao: string | null;
}

export function diagnosticarHarmonicos(temInversores: boolean): DiagnosticoHarmonicos {
  if (!temInversores) {
    return { alerta: false, recomendacao: null };
  }

  return {
    alerta: true,
    recomendacao:
      'Planta com cargas não-lineares (inversores de frequência / drives). É ' +
      'OBRIGATÓRIO instalar reatores de dessintonia (indutâncias anti-harmônicas) em ' +
      'série com os capacitores — tipicamente fator de dessintonia p = 7% (sintonia ' +
      '~189 Hz, protege contra ressonância no 5º harmônico). Sem o reator, o banco pode ' +
      'entrar em ressonância com a indutância da rede, amplificar correntes harmônicas, ' +
      'sobreaquecer e falhar. O fator ideal (5,67% / 7% / 14%) depende do espectro real ' +
      'medido com analisador de qualidade de energia antes do projeto.',
  };
}
