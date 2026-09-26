import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Routes, Route } from 'react-router-dom'
import { SetupClinic } from './pages/SetupClinic'
import { ClinicLogin } from './pages/ClinicLogin'
import { StaffPicker } from './pages/StaffPicker'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { Agenda } from './pages/Agenda'
import { AgendaCalendar } from './pages/AgendaCalendar'
import { OnlineRequests } from './pages/OnlineRequests'
import { Patients } from './pages/Patients'
import { PatientFile } from './pages/patients/PatientFile'
import { PatientData } from './pages/patients/PatientData'
import { PatientAppointments } from './pages/patients/PatientAppointments'
import { PatientFinance } from './pages/patients/PatientFinance'
import { Professionals } from './pages/Professionals'
import { Rooms } from './pages/Rooms'
import { ProcedureTypes } from './pages/ProcedureTypes'
import { Estoque } from './pages/Estoque'
import { FinanceiroLayout } from './pages/financeiro/FinanceiroLayout'
import { FinanceiroOverview } from './pages/financeiro/FinanceiroOverview'
import { FinanceiroRecebimentos } from './pages/financeiro/FinanceiroRecebimentos'
import { FinanceiroDespesas } from './pages/financeiro/FinanceiroDespesas'
import { FinanceiroRelatorios } from './pages/financeiro/FinanceiroRelatorios'
import { CadastrosLayout } from './pages/cadastros/CadastrosLayout'
import { ThemeToggle } from './components/ThemeToggle'
import { ConfiguracoesLayout } from './pages/configuracoes/ConfiguracoesLayout'
import { Autoagendamento } from './pages/configuracoes/Autoagendamento'
import { Horarios } from './pages/configuracoes/Horarios'
import { Bloqueios } from './pages/configuracoes/Bloqueios'
import { Taxas } from './pages/configuracoes/Taxas'
import { Funcionarios } from './pages/configuracoes/Funcionarios'
import { ClinicContext } from './context/ClinicContext'
import type { ClinicLoginResult, StaffSummary } from '@shared/types'

type Stage =
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'login' }
  | { name: 'pick-staff'; clinic: ClinicLoginResult }
  | { name: 'home'; clinic: ClinicLoginResult; staff: StaffSummary }

function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ name: 'loading' })

  useEffect(() => {
    window.api.clinicExists().then((exists) => {
      setStage(exists ? { name: 'login' } : { name: 'setup' })
    })
  }, [])

  if (stage.name === 'loading') {
    return (
      <div className="centered-page">
        <ThemeToggle floating />
        <div className="spinner" aria-label="Carregando" />
      </div>
    )
  }

  if (stage.name === 'setup') {
    return (
      <>
        <ThemeToggle floating />
        <SetupClinic onDone={(clinic) => setStage({ name: 'pick-staff', clinic })} />
      </>
    )
  }

  if (stage.name === 'login') {
    return (
      <>
        <ThemeToggle floating />
        <ClinicLogin onDone={(clinic) => setStage({ name: 'pick-staff', clinic })} />
      </>
    )
  }

  if (stage.name === 'pick-staff') {
    return (
      <>
        <ThemeToggle floating />
      <StaffPicker
        clinicName={stage.clinic.clinicName}
        staff={stage.clinic.staff}
        onDone={(staff) => setStage({ name: 'home', clinic: stage.clinic, staff })}
      />
      </>
    )
  }

  return (
    <ClinicContext.Provider value={{ clinicName: stage.clinic.clinicName, staff: stage.staff }}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/agenda" element={<Agenda />}>
              <Route index element={<AgendaCalendar />} />
              <Route path="pedidos" element={<OnlineRequests />} />
            </Route>
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientFile />}>
              <Route index element={<PatientData />} />
              <Route path="atendimentos" element={<PatientAppointments />} />
              <Route path="financeiro" element={<PatientFinance />} />
            </Route>
            <Route path="/cadastros" element={<CadastrosLayout />}>
              <Route index element={<Navigate to="profissionais" replace />} />
              <Route path="profissionais" element={<Professionals />} />
              <Route path="salas" element={<Rooms />} />
              <Route path="procedimentos" element={<ProcedureTypes />} />
            </Route>
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/financeiro" element={<FinanceiroLayout />}>
              <Route index element={<FinanceiroOverview />} />
              <Route path="recebimentos" element={<FinanceiroRecebimentos />} />
              <Route path="despesas" element={<FinanceiroDespesas />} />
              <Route path="relatorios" element={<FinanceiroRelatorios />} />
            </Route>
            {/* Endereços antigos continuam funcionando */}
            <Route path="/vendas" element={<Navigate to="/financeiro" replace />} />
            <Route path="/professionals" element={<Navigate to="/cadastros/profissionais" replace />} />
            <Route path="/rooms" element={<Navigate to="/cadastros/salas" replace />} />
            <Route path="/procedure-types" element={<Navigate to="/cadastros/procedimentos" replace />} />
            <Route path="/configuracoes" element={<ConfiguracoesLayout />}>
              <Route index element={<Autoagendamento />} />
              <Route path="horarios" element={<Horarios />} />
              <Route path="bloqueios" element={<Bloqueios />} />
              <Route path="taxas" element={<Taxas />} />
              <Route path="funcionarios" element={<Funcionarios />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </ClinicContext.Provider>
  )
}

export default App

