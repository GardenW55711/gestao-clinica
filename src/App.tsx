import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { SetupClinic } from './pages/SetupClinic'
import { ClinicLogin } from './pages/ClinicLogin'
import { StaffPicker } from './pages/StaffPicker'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { Patients } from './pages/Patients'
import { Professionals } from './pages/Professionals'
import { Rooms } from './pages/Rooms'
import { ProcedureTypes } from './pages/ProcedureTypes'
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
        <p>Carregando...</p>
      </div>
    )
  }

  if (stage.name === 'setup') {
    return <SetupClinic onDone={(clinic) => setStage({ name: 'pick-staff', clinic })} />
  }

  if (stage.name === 'login') {
    return <ClinicLogin onDone={(clinic) => setStage({ name: 'pick-staff', clinic })} />
  }

  if (stage.name === 'pick-staff') {
    return (
      <StaffPicker
        clinicName={stage.clinic.clinicName}
        staff={stage.clinic.staff}
        onDone={(staff) => setStage({ name: 'home', clinic: stage.clinic, staff })}
      />
    )
  }

  return (
    <ClinicContext.Provider value={{ clinicName: stage.clinic.clinicName, staff: stage.staff }}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/professionals" element={<Professionals />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/procedure-types" element={<ProcedureTypes />} />
          </Route>
        </Routes>
      </HashRouter>
    </ClinicContext.Provider>
  )
}

export default App
