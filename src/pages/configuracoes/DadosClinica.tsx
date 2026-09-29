import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'

/** Redimensiona/recomprime a imagem no navegador (sem depender de biblioteca nativa) e devolve um data URL PNG/JPEG. */
function resizeImageToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    reader.onload = () => {
      img.onerror = () => reject(new Error('Arquivo de imagem inválido'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Não foi possível processar a imagem'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function DadosClinica(): JSX.Element {
  const { toast } = useFeedback()
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([window.api.clinicSettings.get(), window.api.clinicSettings.getLogoDataUrl()]).then(([settings, logoResult]) => {
      if (settings.ok && settings.data) {
        setAddress(settings.data.address ?? '')
        setPhone(settings.data.phone ?? '')
      }
      if (logoResult.ok) setLogo(logoResult.data ?? null)
      setLoaded(true)
    })
  }, [])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await window.api.clinicSettings.setProfile({ address, phone })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    toast.success('Dados da clínica salvos')
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Envie uma imagem PNG ou JPG')
      return
    }
    setError(null)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 400)
      const result = await window.api.clinicSettings.setLogo(dataUrl)
      if (!result.ok) return setError(result.error ?? 'Não foi possível salvar a logo')
      setLogo(dataUrl)
      toast.success('Logo atualizada')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function removeLogo(): Promise<void> {
    const result = await window.api.clinicSettings.setLogo(null)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível remover')
    setLogo(null)
  }

  if (!loaded) return <div className="skeleton block" />

  return (
    <div>
      <h2 className="section-title">Dados da clínica</h2>
      <p className="subtitle">Aparecem no cabeçalho dos documentos em PDF (anamnese, orçamento, receitas, atestados).</p>

      <form className="card settings-card" onSubmit={handleSubmit}>
        <div className="clinic-logo-row">
          <span className="clinic-logo-preview">
            {logo ? <img src={logo} alt="Logo da clínica" /> : <Icon name="folder" size={28} />}
          </span>
          <div>
            <label className="soft-btn file-btn">
              {logo ? 'Trocar logo' : 'Escolher logo (opcional)'}
              <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} hidden />
            </label>
            {logo && (
              <button type="button" className="link-button" onClick={removeLogo}>
                Remover
              </button>
            )}
          </div>
        </div>

        <label>
          Endereço
          <input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" placeholder="Rua, número, bairro, cidade - UF" />
        </label>
        <label>
          Telefone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" placeholder="(00) 0000-0000" />
        </label>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
