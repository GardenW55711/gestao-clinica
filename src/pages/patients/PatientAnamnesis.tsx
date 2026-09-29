import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AnamnesisRecord } from '@shared/anamnesis'
import { FillAnamnesisModal } from '../../components/anamnesis/FillAnamnesisModal'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { useClinic } from '../../context/ClinicContext'
import type { PatientFileContext } from './PatientFile'

const TYPE_ANSWER = (record: AnamnesisRecord, question: AnamnesisRecord['questions'][number]): string | null => {
  const a = record.answers.find((x) => x.questionId === question.id)
  if (!a) return null
  const base = question.type === 'sim_nao' ? (a.value === 'sim' ? 'Sim' : 'Não') : Array.isArray(a.value) ? a.value.join(', ') : a.value
  if (!base) return null
  return a.details?.trim() ? `${base} — ${a.details.trim()}` : base
}

function RecordCard({ record, onSigned }: { record: AnamnesisRecord; onSigned: () => void }): JSX.Element {
  const { toast } = useFeedback()
  const [signing, setSigning] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [printing, setPrinting] = useState(false)

  async function markSigned(): Promise<void> {
    const result = await window.api.anamnesisRecords.markSignedOnPaper(record.id, date)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível salvar')
    setSigning(false)
    onSigned()
  }

  async function print(): Promise<void> {
    setPrinting(true)
    const result = await window.api.anamnesisRecords.print(record.id)
    setPrinting(false)
    if (!result.ok) {
      if (result.error !== 'Cancelado') toast.error(result.error ?? 'Não foi possível gerar o PDF')
      return
    }
    toast.success('PDF salvo')
  }

  return (
    <div className="card anamnesis-record">
      <div className="page-head">
        <div>
          <strong>{record.templateName}</strong>
          <p className="subtitle tight">
            Preenchida em {new Date(record.filledAt).toLocaleDateString('pt-BR')} por {record.filledByName}
            {record.overdue && <span className="tag warn"> vencida (+12 meses)</span>}
          </p>
        </div>
        <div className="row-actions-inner">
          <button type="button" className="soft-btn" onClick={print} disabled={printing}>
            {printing ? 'Gerando...' : 'Imprimir para assinatura'}
          </button>
        </div>
      </div>

      {record.redacted ? (
        <p className="subtitle">Você não tem acesso clínico liberado para ver o conteúdo desta anamnese.</p>
      ) : (
        <ul className="anamnesis-answers">
          {record.questions.map((q) => {
            const text = TYPE_ANSWER(record, q)
            if (!text) return null
            return (
              <li key={q.id}>
                <span className="muted">{q.text}</span>
                <strong>{text}</strong>
              </li>
            )
          })}
        </ul>
      )}

      <p className="subtitle tight">
        Assinatura em papel:{' '}
        {record.signedOnPaperAt ? (
          new Date(record.signedOnPaperAt).toLocaleDateString('pt-BR')
        ) : signing ? (
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />{' '}
            <button type="button" className="link-button" onClick={markSigned}>
              Confirmar
            </button>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => setSigning(true)}>
            marcar como assinada
          </button>
        )}
      </p>
    </div>
  )
}

export function PatientAnamnesis(): JSX.Element {
  const { patient, reload: reloadPatientFile } = useOutletContext<PatientFileContext>()
  const { toast } = useFeedback()
  const { staff } = useClinic()
  const [records, setRecords] = useState<AnamnesisRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filling, setFilling] = useState(false)

  const load = useCallback((): void => {
    window.api.anamnesisRecords.listByPatient(patient.id).then((r) => {
      if (r.ok && r.data) setRecords(r.data)
      setLoaded(true)
    })
  }, [patient.id])

  useEffect(() => {
    load()
  }, [load])

  const latest = records[0]

  return (
    <div>
      <div className="page-head">
        <p className="subtitle">
          {records.length === 0
            ? 'Nenhuma anamnese preenchida ainda.'
            : latest?.overdue
              ? 'A última anamnese tem mais de 12 meses — considere atualizar.'
              : 'Histórico de anamneses deste paciente (a mais recente primeiro).'}
        </p>
        <button type="button" className="with-icon" onClick={() => setFilling(true)}>
          <Icon name="plus" size={18} />
          Preencher nova anamnese
        </button>
      </div>

      {loaded && records.length === 0 && (
        <div className="empty-state card">
          <Icon name="document" size={34} />
          <strong>Nenhuma anamnese registrada</strong>
          <span>{staff.clinicalAccess ? 'Use "Preencher nova anamnese" para começar.' : 'Peça para um profissional preencher.'}</span>
        </div>
      )}

      <div className="anamnesis-list">
        {records.map((r) => (
          <RecordCard key={r.id} record={r} onSigned={load} />
        ))}
      </div>

      {filling && (
        <FillAnamnesisModal
          patientId={patient.id}
          onClose={() => setFilling(false)}
          onSaved={() => {
            setFilling(false)
            toast.success('Anamnese salva')
            load()
            reloadPatientFile()
          }}
        />
      )}
    </div>
  )
}
