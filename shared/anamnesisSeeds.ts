// Os 4 modelos prontos criados junto com a clínica (editáveis depois em
// Configurações › Modelos de anamnese). Nada aqui é fixo: são só o ponto de
// partida — se o dentista apagar ou mudar, o programa não recria sozinho.
import type { AnamnesisQuestion, AnamnesisTemplateInput } from './anamnesis'

const q = (question: AnamnesisQuestion): AnamnesisQuestion => question

const DOENCAS: AnamnesisQuestion = q({
  id: 'doencas',
  text: 'Possui alguma destas condições?',
  type: 'multipla_escolha',
  required: false,
  options: ['Diabetes', 'Hipertensão', 'Cardiopatia', 'Problema de coagulação', 'Asma', 'Epilepsia', 'Hepatite ou HIV', 'Problema de tireoide'],
  generatesAlert: true,
  alertOptions: ['Diabetes', 'Hipertensão', 'Cardiopatia', 'Problema de coagulação'],
  alertSeverity: 'atencao'
})

const ALERGIAS: AnamnesisQuestion = q({
  id: 'alergias',
  text: 'Tem alguma alergia (medicamento, látex, anestésico)?',
  type: 'sim_nao',
  required: true,
  generatesAlert: true,
  askDetailsIfYes: true,
  alertLabel: 'Alergia',
  alertSeverity: 'grave'
})

const ANTICOAGULANTE: AnamnesisQuestion = q({
  id: 'anticoagulante',
  text: 'Usa algum anticoagulante?',
  type: 'sim_nao',
  required: true,
  generatesAlert: true,
  alertLabel: 'Uso de anticoagulante',
  alertSeverity: 'grave'
})

const REACAO_ANESTESIA: AnamnesisQuestion = q({
  id: 'reacao_anestesia',
  text: 'Já teve alguma reação a anestesia?',
  type: 'sim_nao',
  required: true,
  generatesAlert: true,
  askDetailsIfYes: true,
  alertLabel: 'Reação prévia à anestesia',
  alertSeverity: 'grave'
})

const MEDICAMENTOS: AnamnesisQuestion = q({
  id: 'medicamentos',
  text: 'Quais medicamentos usa atualmente? (deixe em branco se nenhum)',
  type: 'texto',
  required: false
})

const OBSERVACOES: AnamnesisQuestion = q({ id: 'observacoes', text: 'Observações', type: 'texto', required: false })

export const DEFAULT_ANAMNESIS_TEMPLATES: AnamnesisTemplateInput[] = [
  {
    name: 'Padrão',
    questions: [
      q({ id: 'motivo', text: 'Motivo da consulta', type: 'texto', required: true }),
      DOENCAS,
      MEDICAMENTOS,
      ALERGIAS,
      ANTICOAGULANTE,
      q({
        id: 'gestante',
        text: 'Está gestante ou amamentando?',
        type: 'multipla_escolha',
        required: false,
        options: ['Gestante', 'Amamentando', 'Não'],
        generatesAlert: true,
        alertOptions: ['Gestante', 'Amamentando'],
        alertSeverity: 'grave'
      }),
      q({ id: 'cirurgias', text: 'Já passou por cirurgias ou internações?', type: 'texto', required: false }),
      REACAO_ANESTESIA,
      q({
        id: 'habitos',
        text: 'Hábitos',
        type: 'multipla_escolha',
        required: false,
        options: ['Fuma', 'Bebe', 'Bruxismo (range os dentes)']
      }),
      q({ id: 'ultima_visita', text: 'Quando foi ao dentista pela última vez?', type: 'texto', required: false }),
      q({ id: 'sangramento', text: 'Tem sangramento na gengiva ao escovar?', type: 'sim_nao', required: false }),
      q({ id: 'higiene', text: 'Como é sua rotina de escovação e fio dental?', type: 'texto', required: false }),
      OBSERVACOES
    ]
  },
  {
    name: 'Infantil',
    questions: [
      q({ id: 'motivo', text: 'Motivo da consulta', type: 'texto', required: true }),
      q({ id: 'responsavel', text: 'Nome do responsável', type: 'texto', required: true }),
      DOENCAS,
      MEDICAMENTOS,
      ALERGIAS,
      q({
        id: 'habitos_infantis',
        text: 'Hábitos da criança',
        type: 'multipla_escolha',
        required: false,
        options: ['Usa chupeta', 'Usa mamadeira', 'Chupa o dedo', 'Respira pela boca']
      }),
      q({ id: 'comportamento', text: 'Como a criança costuma reagir a consultas odontológicas?', type: 'texto', required: false }),
      q({ id: 'higiene_infantil', text: 'Como é a higiene bucal da criança (quem escova, quantas vezes ao dia)?', type: 'texto', required: false }),
      OBSERVACOES
    ]
  },
  {
    name: 'Ortodontia',
    questions: [
      q({ id: 'motivo', text: 'Motivo da consulta', type: 'texto', required: true }),
      q({
        id: 'habitos_orto',
        text: 'Hábitos',
        type: 'multipla_escolha',
        required: false,
        options: ['Roer unha', 'Chupar dedo', 'Respiração bucal', 'Bruxismo (range os dentes)']
      }),
      q({ id: 'tratamento_anterior', text: 'Já fez tratamento ortodôntico antes?', type: 'texto', required: false }),
      DOENCAS,
      ALERGIAS,
      OBSERVACOES
    ]
  },
  {
    name: 'Cirurgia/Implante',
    questions: [
      q({ id: 'motivo', text: 'Motivo da consulta', type: 'texto', required: true }),
      DOENCAS,
      MEDICAMENTOS,
      ANTICOAGULANTE,
      ALERGIAS,
      REACAO_ANESTESIA,
      q({
        id: 'fumante',
        text: 'É fumante?',
        type: 'sim_nao',
        required: true,
        generatesAlert: true,
        alertLabel: 'Fumante (atenção na cicatrização)',
        alertSeverity: 'atencao'
      }),
      q({ id: 'cirurgias_previas', text: 'Já passou por cirurgias anteriores? Quais?', type: 'texto', required: false }),
      OBSERVACOES
    ]
  }
]
