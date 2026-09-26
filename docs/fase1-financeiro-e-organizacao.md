# Fase 1 — Financeiro de verdade + reorganização do app

> Como usar: salve este arquivo em `docs/fase1-financeiro-e-organizacao.md` no repositório e diga ao Claude Code:
> **"Leia docs/fase1-financeiro-e-organizacao.md e siga as instruções."**

---

## Regras de trabalho (leia antes de tudo)

1. **Antes de programar**, leia o código atual e me apresente um PLANO resumido (tabelas novas, telas novas, telas alteradas, ordem das etapas). Espere minha aprovação.
2. Trabalhe **em etapas** (A, B, C…). Ao fim de cada etapa: rode o app/testes, faça commit com mensagem clara e me explique em linguagem simples o que mudou.
3. **Não perca dados existentes.** Toda mudança de banco deve ser feita por migração do Drizzle (SQLite local) e também atualizada no `supabase/schema.sql` (seguindo o padrão atual: `if not exists`, `clinic_id`, RLS "clinic manages its …").
4. Toda tabela nova usa o padrão `tenantColumns` (clinic_id, created_at, updated_at, sync_status, deleted_at) e entra no motor de sincronização (`electron/main/sync/engine.ts`).
5. O app continua funcionando **sem internet** (offline-first). Nada pode depender da nuvem para funcionar.
6. **Dinheiro:** hoje os valores são `real` (número com vírgula), o que pode gerar erros de centavos. Avalie e me proponha se vale migrar para centavos inteiros agora. Não faça sem eu aprovar.
7. Crie testes automáticos para as **fórmulas dos indicadores** (seção C) com exemplos numéricos.
8. No fim, atualize o `ESTADO_DO_PROJETO.md`.

---

## Etapa A — Reorganizar o menu e as telas

Problema atual: o menu tem 9 itens soltos, misturando o que se usa todo dia (Agenda) com cadastros que se mexe pouco (Salas, Tipos de procedimento). Os pedidos de agendamento online ficam escondidos em Configurações. A rota do Financeiro se chama `/vendas`.

Novo menu (nesta ordem):

| Item | Conteúdo |
|---|---|
| **Início** | Painel do dia (ver Etapa E) |
| **Agenda** | Agenda atual + aba/aviso de **Pedidos online** (mover de Configurações para cá) |
| **Pacientes** | Lista com busca + **Ficha do paciente** (Etapa D) |
| **Financeiro** | Sub-abas: Visão geral · Recebimentos · Despesas · Relatórios (Etapas B e C) |
| **Estoque** | Como está hoje |
| **Cadastros** | Sub-abas: Profissionais · Salas · Procedimentos |
| **Configurações** | Autoagendamento (liga/desliga e procedimentos online), horários de funcionamento, taxas de cartão, funcionários |

- Renomear a rota `/vendas` para `/financeiro` (manter redirecionamento da antiga).
- Manter o visual atual (estilo "vidro", tema claro/escuro, menu que vira só ícones em tela estreita).

---

## Etapa B — Estrutura do financeiro (dados)

### B1. Cobrança ligada ao atendimento
- Ao **finalizar um atendimento** na agenda (depois da baixa de estoque), abrir a tela de cobrança **já preenchida**: paciente, procedimento, preço padrão, profissional. Gravar `appointmentId` e `professionalId` na venda (hoje ficam sempre vazios).
- Botões: **"Receber agora"** e **"Cobrar depois"** (fica pendente).
- Permitir **desconto** (valor ou %).
- A cobrança avulsa (sem atendimento) continua possível, mas vira um **botão "Nova cobrança" que abre um modal** — sair da tela de análise, que hoje mistura gráfico com formulário.

### B2. Status e parcelas
- Status da cobrança: `pendente`, `parcial`, `paga`, `cancelada` (hoje sempre grava "paga").
- Nova tabela **`installments`** (parcelas): sale_id, número da parcela, valor, data de vencimento, data de pagamento, forma de pagamento, taxa cobrada (cartão).
- Cobrança à vista = 1 parcela. Parcelado = N parcelas com vencimentos mensais sugeridos (editáveis).
- Formas de pagamento: dinheiro, pix, cartão de débito, cartão de crédito, boleto, outro (separar débito/crédito porque as taxas são diferentes).

### B3. Despesas (hoje não existe — sem isso não dá para calcular lucro)
- Nova tabela **`expenses`**: descrição, categoria, tipo (`fixa` ou `variavel`), valor, vencimento, data de pagamento, recorrente mensal (sim/não).
- Categorias sugeridas: aluguel, salários, pró-labore, contas (luz/água/internet), laboratório de prótese, materiais (compras), marketing, impostos, manutenção, outros.
- Despesa recorrente gera automaticamente a do mês seguinte.
- Ao registrar **entrada no estoque**, oferecer "Lançar como despesa?" usando custo unitário × quantidade.

### B4. Configurações que os indicadores precisam
- **Comissão por profissional** (% sobre o valor recebido) — campo novo em Profissionais.
- **Taxas de cartão** (% débito, % crédito à vista, % crédito parcelado) — em Configurações.
- **Horário de trabalho por profissional**: dias da semana, início, fim e intervalo — nova tabela `professional_working_hours`.
- **Bloqueios de agenda** (férias, feriado, almoço, curso) — nova tabela `schedule_blocks`: profissional (ou todos), início, fim, motivo. A agenda deve mostrar os bloqueios e **impedir agendar** neles (inclusive no autoagendamento online).

---

## Etapa C — Indicadores (tela Financeiro > Visão geral e Relatórios)

Regra de ouro: **cada número vem com uma frase simples explicando o que significa** e um ícone (i) com a fórmula. Mostrar comparação com o período anterior (seta ↑ ↓ e %). Usar cores de semáforo (verde/amarelo/vermelho) quando houver meta.

Separar sempre dois conceitos (explicar na tela):
- **Produzido** = valor dos atendimentos realizados no período (mesmo que o paciente ainda não tenha pago).
- **Recebido** = dinheiro que de fato entrou no período (pela data de pagamento das parcelas).

### Cartões da Visão geral (em ordem)

| Indicador | Fórmula | Frase para o usuário | Meta/semáforo |
|---|---|---|---|
| **Recebido** | soma das parcelas pagas no período (valor líquido, já descontada taxa de cartão) | "Dinheiro que entrou no caixa." | — |
| **Despesas** | soma das despesas pagas no período | "Tudo que saiu do caixa." | — |
| **Lucro** | Recebido − Despesas | "O que sobrou de verdade." | vermelho se negativo |
| **Margem de lucro** | Lucro ÷ Recebido × 100 | "De cada R$ 100 que entram, quanto sobra." | verde ≥ 35%, amarelo 20–35%, vermelho < 20% |
| **A receber** | parcelas pendentes com vencimento futuro | "O que ainda vai entrar." | — |
| **Em atraso (inadimplência)** | parcelas vencidas e não pagas ÷ total de parcelas que venciam no período × 100 | "Quanto está atrasado." | verde < 5%, amarelo 5–10%, vermelho > 10% |
| **Ponto de equilíbrio** | Custos fixos do mês ÷ Margem de contribuição %, onde Margem de contribuição % = (Recebido − Custos variáveis) ÷ Recebido | "Quanto a clínica precisa faturar no mês para não ter prejuízo." Mostrar barra de progresso: "Faltam R$ X" ou "Meta batida — tudo acima disso é lucro". | — |

> Atenção: a fórmula correta do ponto de equilíbrio é **custos fixos ÷ margem de contribuição (%)**. Não use fórmulas que dividem custo fixo por custo variável.
> Custos variáveis = despesas do tipo `variavel` + taxas de cartão + comissões + custo dos materiais consumidos no período.

### Relatórios (sub-aba)

| Indicador | Fórmula | Frase |
|---|---|---|
| **Ticket médio** | Produzido ÷ nº de atendimentos concluídos | "Quanto cada atendimento rende, em média." |
| **Taxa de ocupação da agenda** | horas agendadas (concluídos + confirmados + agendados, sem cancelados) ÷ horas disponíveis (horário de trabalho − bloqueios) × 100 — por profissional e geral | "Quanto do tempo disponível está sendo usado." Verde 75–85% ou mais; amarelo 60–75%; vermelho < 60% |
| **Taxa de faltas** | atendimentos com status `no_show` ÷ total de agendamentos (sem cancelados) × 100 | "Pacientes que marcaram e não vieram." Verde < 10% |
| **Custo da hora ociosa** | horas vagas × (custos fixos do mês ÷ horas disponíveis no mês) | "Quanto custou a cadeira parada." |
| **Produção por profissional** | Produzido agrupado por profissional + nº de atendimentos + comissão calculada | "Quanto cada dentista produziu e quanto recebe de comissão." |
| **Margem por procedimento** | Preço cobrado − custo dos materiais (custo unitário × quantidade da "receita" do procedimento) − taxa de cartão média − comissão | "Quanto cada tipo de procedimento realmente deixa de lucro." Ordenar do maior para o menor. Destacar procedimentos com margem baixa. |
| **Despesas por categoria** | soma por categoria | gráfico de barras |
| **Fluxo de caixa** | por dia/mês: entradas, saídas e saldo acumulado | gráfico de linhas |

Filtros de período: manter os atuais (Hoje, 7 dias, Mês, Personalizado).

---

## Etapa D — Ficha do paciente

Hoje Pacientes é só uma tabela de cadastro (o campo "observações" existe no banco mas não aparece no formulário).

- Busca por **nome, CPF ou telefone**.
- Ao clicar no paciente, abrir a **Ficha** (`/patients/:id`) com abas:
  - **Dados** — cadastro (incluir observações).
  - **Atendimentos** — histórico (data, procedimento, profissional, status). Mostrar contador de faltas.
  - **Financeiro** — cobranças e parcelas do paciente, destacando o que está em atraso.
- No formulário de **novo agendamento**, permitir buscar o paciente digitando e **cadastrar rapidamente** (nome + telefone) sem sair da agenda.

(Prontuário clínico, anamnese e odontograma ficam para a Fase 3 — **não fazer agora**.)

---

## Etapa E — Início (painel do dia)

Cartões:
- Agendamentos de hoje (e quantos ainda **não foram confirmados**).
- A receber hoje + **parcelas em atraso**.
- Estoque: itens baixos ou vencendo (já existe).
- Pedidos online pendentes (link para a Agenda, não mais para Configurações).
- Recebido no mês × ponto de equilíbrio (barra de progresso) — **só para dono/admin**.

---

## Etapa F — Permissões por cargo

Os cargos existem (`owner`, `admin`, `professional`, `receptionist`), mas confira se estão sendo respeitados. Aplicar a regra **no processo principal (IPC)**, não só escondendo botões na tela:

| Área | Dono/Admin | Profissional | Recepção |
|---|---|---|---|
| Agenda | tudo | vê todos, edita os seus | tudo |
| Pacientes | tudo | tudo | tudo |
| Financeiro — cobranças e recebimentos | tudo | só os seus atendimentos | registrar e receber |
| Financeiro — despesas, lucro, relatórios | tudo | só a própria produção/comissão | não vê |
| Estoque | tudo | dar baixa | tudo |
| Cadastros e Configurações | tudo | não | não |

---

## Fora do escopo desta fase (não fazer agora)
Prontuário/anamnese/odontograma, envio automático de WhatsApp, emissão de nota fiscal, convênios (TISS), sincronização em mão dupla/vários computadores.
