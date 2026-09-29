import { Icon, type IconName } from '../../components/Icons'

/** Placeholder das abas da ficha que ainda serão construídas nas próximas etapas da Fase 2. */
export function ComingSoon({ icon, title, etapa }: { icon: IconName; title: string; etapa: string }): JSX.Element {
  return (
    <div className="empty-state card">
      <Icon name={icon} size={34} />
      <strong>{title}</strong>
      <span>Esta aba chega na {etapa} do prontuário clínico (Fase 2).</span>
    </div>
  )
}
