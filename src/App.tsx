import { useEffect, useState } from 'react'

function App(): JSX.Element {
  const [status, setStatus] = useState('checando...')

  useEffect(() => {
    window.api
      .ping()
      .then((resposta) => setStatus(`ok (${resposta})`))
      .catch(() => setStatus('falhou'))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Gestão de Clínica</h1>
      <p>Fundação do projeto (Fase 1) — conexão com o processo principal: {status}</p>
    </main>
  )
}

export default App
