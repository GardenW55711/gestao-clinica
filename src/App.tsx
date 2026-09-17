import { useEffect, useState } from 'react'
import { SetupClinic } from './pages/SetupClinic'
import { ClinicLogin } from './pages/ClinicLogin'
import { StaffPicker } from './pages/StaffPicker'
import { Home } from './pages/Home'
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

  return <Home clinicName={stage.clinic.clinicName} staff={stage.staff} />
}

export default App
