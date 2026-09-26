# Estado do projeto — Gestão de Clínica

_Atualizado na entrega da Fase 1 (versão 0.8.0)._

Programa de gestão para clínicas: agenda, pacientes, estoque e financeiro. App de computador (Windows) que funciona **sem internet** e sincroniza com a nuvem quando há conexão.

## Como o sistema é montado (em linguagem simples)

| Peça | O que é | Onde fica |
|---|---|---|
| Programa instalado | Electron + React. A tela nunca acessa o banco direto; ela pede ao "processo principal" (IPC) | `src/` (telas), `electron/main/` (regras e banco), `electron/preload/` (ponte) |
| Banco local | SQLite **criptografado** (chave vem da senha mestra). Migrações automáticas ao entrar, com backup antes | `electron/main/db/`, pasta `drizzle/` |
| Nuvem | Supabase (Postgres + login + regras de segurança por clínica). É a "fonte da verdade" | `supabase/schema.sql` (rodar inteiro no SQL Editor a cada versão) |
| Sincronização | Sobe o que está `pending` para a nuvem a cada minuto e ao usar o botão. **Só envia** (exceto pedidos online e a recuperação da clínica) | `electron/main/sync/` |
| Página de autoagendamento | Site público que grava pedidos direto no Supabase | `web-booking/` (Vercel) |
| Atualização automática | Instalador publicado nos Releases do GitHub; o app baixa sozinho | `npm run release:win` |

Regras que valem para todo dado da clínica: `clinic_id` em toda linha, `id` UUID, exclusão "suave" (`deleted_at`), `sync_status`.

## Fase 1 (esta entrega): financeiro de verdade + reorganização

### Dinheiro em centavos
Todos os valores são **centavos inteiros** (`*_cents`). Existe `shared/money.ts` para converter e formatar. A migração `0004` converteu os dados antigos (×100). Na nuvem, as colunas antigas em reais ficam intocadas e o app usa as novas `*_cents`.

### Menu e telas
Início · Agenda (Calendário + Pedidos online) · Pacientes (lista + Ficha) · Financeiro (Visão geral, Recebimentos, Despesas, Relatórios) · Estoque · Cadastros (Profissionais, Salas, Procedimentos) · Configurações (Autoagendamento, Horários, Bloqueios, Taxas de cartão, Funcionários). Rotas antigas (`/vendas`, `/professionals`, …) redirecionam.

### Financeiro
- **Cobrança** (`sales`) ligada ao atendimento; ao finalizar na agenda abre preenchida, com "Receber agora" / "Cobrar depois" e desconto (R$ ou %).
- **Parcelas** (`installments`): à vista = 1 parcela; parcelado = N com vencimentos mensais editáveis. A **taxa do cartão** é gravada no momento do recebimento (mudar a taxa depois não altera o passado).
- Status da cobrança é derivado das parcelas: `pendente`, `parcial`, `paga` (+ `cancelada`, manual).
- **Despesas** (`expenses`): fixas/variáveis, recorrentes (o mês seguinte é criado sozinho; mês apagado de propósito não é recriado). Entrada de estoque oferece "Lançar como despesa".
- Comissão por profissional (`professionals.commission_percent`), taxas de cartão (`clinics.card_fee_*`), horário de trabalho (`professional_working_hours`), bloqueios (`schedule_blocks`) — valem na agenda e no autoagendamento.

### Indicadores (fórmulas em `shared/indicators.ts`, com testes em `shared/*.test.ts`)
- **Produzido** = atendimentos realizados no período (cobrança do atendimento ou preço padrão). **Recebido** = parcelas pagas no período, líquido da taxa de cartão.
- Lucro = Recebido − Despesas pagas. Margem = Lucro ÷ Recebido. Semáforo: verde ≥ 35%, amarelo 20–35%, vermelho < 20%.
- A receber = parcelas pendentes com vencimento de hoje em diante. Inadimplência = parcelas vencidas e não pagas ÷ parcelas que venciam no período (verde < 5%, amarelo 5–10%, vermelho > 10%).
- **Ponto de equilíbrio** = custos fixos do mês ÷ margem de contribuição %, onde margem de contribuição = (recebido bruto − custos variáveis) ÷ recebido bruto. Sempre calculado para o **mês em que o período termina**.
- Ticket médio, ocupação (verde ≥ 75%, amarelo 60–75%, vermelho < 60%), faltas (verde < 10%, amarelo 10–15%, vermelho > 15%), custo da hora ociosa, produção e comissão por profissional, margem por procedimento (“margem baixa” < 30%), despesas por categoria, fluxo de caixa.

### Decisões que tomei (revisar se discordar)
1. **Materiais não contam em dobro**: a compra de material (categoria `materiais`) entra em *Despesas*, mas **não** nos custos variáveis do ponto de equilíbrio — ali entra só o consumo real do estoque (saídas × custo unitário).
2. **Comissão** = % sobre o valor **bruto recebido** (antes da taxa do cartão). Ela entra nos custos variáveis do equilíbrio, mas **não** subtrai do Lucro (que é Recebido − Despesas) a menos que a comissão seja lançada como despesa.
3. Sem horário de trabalho cadastrado, a ocupação assume seg–sex 8h–18h, e **não há restrição** na agenda. Com horário cadastrado, a agenda (e o autoagendamento aprovado) recusa fora dele.
4. Cobranças antigas com forma "cartão" viraram **cartão de crédito à vista**. Cada cobrança antiga virou 1 parcela (paga na data da cobrança, ou pendente).
5. "Recebido no mês" no Início e o equilíbrio usam o recebido **bruto** do mês; o card "Recebido" da visão geral usa o **líquido**.
6. Período "Este mês" vai do dia 1º **até hoje** (não até o fim do mês).

### Permissões (conferidas no processo principal, `electron/main/ipc/util.ts`)
| Área | Dono/Admin | Profissional | Recepção |
|---|---|---|---|
| Agenda | tudo | vê todos, altera só os seus | tudo (aprova pedidos online) |
| Pacientes | tudo | tudo | tudo |
| Cobranças e recebimentos | tudo (+ cancelar, desfazer recebimento) | só os seus atendimentos | registra e recebe |
| Despesas, lucro, relatórios | tudo | só a própria produção/comissão | não vê |
| Estoque | tudo | só dá baixa | tudo |
| Cadastros e Configurações | tudo | não | não |
Só o **dono** cria administradores. O usuário do tipo Profissional precisa estar **ligado a um profissional da agenda** (Configurações › Funcionários).

## Como testar e publicar
- `npm test` — testes das fórmulas (dinheiro, parcelas/taxas, indicadores).
- `npm run typecheck` — confere os tipos.
- Testes de tela com o app real: rodar o app com uma pasta de dados **separada** (`--user-data-dir`) para nunca tocar nos dados de uso.
- Publicar: aumentar `version` no `package.json` (sem BOM) → commit → `npm run release:win` (com `GH_TOKEN` e `CSC_IDENTITY_AUTO_DISCOVERY=false`). Cada versão fica nos Releases do GitHub (dá para voltar).
- Sempre que a versão mexer no banco da nuvem: rodar o `supabase/schema.sql` inteiro de novo (é seguro repetir).

## Limitações conhecidas
- Sincronização é **só de envio**: um segundo computador não vê os dados do primeiro em tempo real.
- Dados novos só chegam na nuvem depois de rodar o `schema.sql` atualizado (até lá ficam salvos no computador, marcados como pendentes).
- Sem prontuário, anamnese, odontograma, WhatsApp/SMS, nota fiscal ou convênios (ficam para as próximas fases).

## Próximas fases (fora do escopo desta entrega)
Prontuário/anamnese/odontograma (Fase 3), lembretes por WhatsApp, emissão de nota fiscal, convênios (TISS), sincronização nos dois sentidos com vários computadores.

## Histórico de versões (Releases no GitHub)
0.4.0 avisos e interface · 0.5.0 agenda em calendário, gráficos e produtos por procedimento · 0.6.0 dinheiro em centavos + menu novo · 0.7.0 cobrança/parcelas/despesas/configurações · 0.8.0 indicadores, ficha do paciente, painel inicial e permissões.
