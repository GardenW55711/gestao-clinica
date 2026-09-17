import { _electron as electron } from 'playwright-core'
import { writeFileSync } from 'fs'

const APP_DIR = 'C:\\Users\\Eder\\Desktop\\Projetos\\Negócios\\Programa de agendamentos'
const electronBin = APP_DIR + '\\node_modules\\electron\\dist\\electron.exe'

const app = await electron.launch({ executablePath: electronBin, args: [APP_DIR], timeout: 30000 })
app.process().stderr?.on('data', (d) => process.stdout.write('[main stderr] ' + d))
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1500)

await page.getByLabel('Nome da clínica').fill('Clínica Booking E2E')
await page.getByLabel('Seu nome (responsável)').fill('Eder Owner')
await page.getByLabel('Seu e-mail').fill('bookinge2e@example.com')
await page.getByLabel('Senha mestra (mín. 8 caracteres)').fill('senha-teste-123')
await page.getByLabel('Confirmar senha mestra').fill('senha-teste-123')
await page.getByLabel(/Seu PIN pessoal/).fill('1234')
await page.getByRole('button', { name: 'Criar clínica' }).click()
await page.waitForTimeout(1500)
await page.getByLabel('PIN').fill('1234')
await page.getByRole('button', { name: 'Continuar' }).click()
await page.waitForTimeout(1500)

await page.getByRole('link', { name: 'Profissionais' }).click()
await page.waitForTimeout(400)
await page.getByLabel('Nome').fill('Dra. Booking')
await page.getByRole('button', { name: 'Adicionar' }).click()
await page.waitForTimeout(500)

await page.getByRole('link', { name: 'Tipos de procedimento' }).click()
await page.waitForTimeout(400)
await page.getByLabel('Nome').fill('Avaliação')
await page.getByLabel('Duração (min)').fill('30')
await page.getByLabel('Preço padrão (R$)').fill('100')
await page.getByRole('button', { name: 'Adicionar' }).click()
await page.waitForTimeout(500)

await page.getByRole('link', { name: 'Configurações' }).click()
await page.waitForTimeout(600)
await page.locator('.switch-row input[type="checkbox"]').click()
await page.waitForTimeout(500)
await page.locator('.data-table input[type="checkbox"]').first().click()
await page.waitForTimeout(500)

const settingsText = await page.locator('.settings-card').innerText()
const match = settingsText.match(/clinic=([a-f0-9-]+)/)
const clinicId = match ? match[1] : null
console.log('CLINIC_ID:', clinicId)

// forca sync agora
await page.getByRole('link', { name: 'Início' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Sincronizar/ }).click()
await page
  .waitForFunction(() => !document.querySelector('main.content')?.innerText.includes('Sincronizando...'), { timeout: 15000 })
  .catch(() => console.log('(timeout sync)'))
console.log('--- resultado sync ---')
console.log(await page.locator('main.content').innerText())

if (clinicId) {
  writeFileSync(
    'C:\\Users\\Eder\\AppData\\Local\\Temp\\claude\\C--Users-Eder-Desktop-Projetos-Neg-cios-Programa-de-agendamentos\\cd0aff90-ef77-47a3-92ab-1e9cfc7a51a4\\scratchpad\\clinic-id.txt',
    clinicId
  )
}

await app.close()
console.log('OK: setup fase 6 concluido')
