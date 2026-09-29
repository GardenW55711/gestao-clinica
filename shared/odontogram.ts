// Catálogo do odontograma: só dados (código, rótulo, cor da legenda), sem
// desenho nenhum aqui — o desenho dos dentes (Etapa C) é independente disso,
// para podermos trocar a forma de exibir sem mexer no banco nem nas regras.
import type { ProcedureScope } from './types'

export const PROCEDURE_SCOPE_LABELS: Record<ProcedureScope, string> = {
  nenhum: 'Nenhuma (não usa o odontograma)',
  dente: 'Um dente inteiro',
  face: 'Uma ou mais faces do dente',
  arcada: 'Uma arcada (superior ou inferior)',
  boca: 'A boca toda'
}

// Legenda de cor padrão usada no Brasil (Etapa C2 do documento da Fase 2).
export type OdontogramColor = 'verde' | 'vermelho' | 'azul' | 'preto'

export const ODONTOGRAM_COLOR_LABELS: Record<OdontogramColor, string> = {
  verde: 'Sem necessidade de intervenção / satisfatório',
  vermelho: 'Precisa de tratamento (planejado)',
  azul: 'Tratamento realizado',
  preto: 'Dente ausente / incluso'
}

export interface OdontogramConditionDef {
  code: string
  label: string
  color: OdontogramColor
}

// Catálogo de condições que um procedimento pode marcar automaticamente ao ser
// concluído. A aparência exata de cada símbolo é decidida no desenho (Etapa C).
export const ODONTOGRAM_CONDITIONS: OdontogramConditionDef[] = [
  { code: 'carie', label: 'Cárie', color: 'vermelho' },
  { code: 'restauracao_satisfatoria', label: 'Restauração satisfatória', color: 'azul' },
  { code: 'restauracao_insatisfatoria', label: 'Restauração insatisfatória', color: 'vermelho' },
  { code: 'restauracao_provisoria', label: 'Restauração provisória', color: 'azul' },
  { code: 'canal', label: 'Canal (tratamento endodôntico)', color: 'azul' },
  { code: 'extracao_indicada', label: 'Extração indicada', color: 'vermelho' },
  { code: 'ausente', label: 'Dente ausente', color: 'preto' },
  { code: 'incluso', label: 'Dente incluso', color: 'preto' },
  { code: 'implante', label: 'Implante', color: 'azul' },
  { code: 'coroa', label: 'Coroa', color: 'azul' },
  { code: 'protese_fixa', label: 'Prótese fixa / ponte', color: 'azul' },
  { code: 'selante', label: 'Selante', color: 'azul' },
  { code: 'fratura', label: 'Fratura', color: 'vermelho' },
  { code: 'desgaste', label: 'Desgaste', color: 'vermelho' },
  { code: 'mobilidade_1', label: 'Mobilidade grau 1', color: 'vermelho' },
  { code: 'mobilidade_2', label: 'Mobilidade grau 2', color: 'vermelho' },
  { code: 'mobilidade_3', label: 'Mobilidade grau 3', color: 'vermelho' },
  { code: 'doenca_periodontal', label: 'Doença periodontal', color: 'vermelho' },
  { code: 'deciduo_presente', label: 'Dente decíduo presente', color: 'verde' },
  { code: 'observacao', label: 'Observação livre', color: 'verde' }
]

export const odontogramConditionMap = new Map(ODONTOGRAM_CONDITIONS.map((c) => [c.code, c]))

export function odontogramConditionLabel(code: string | null): string | null {
  if (!code) return null
  return odontogramConditionMap.get(code)?.label ?? code
}
