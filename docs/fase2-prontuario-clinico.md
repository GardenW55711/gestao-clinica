# Fase 2 — Prontuário clínico (anamnese, odontograma anatômico, plano de tratamento, evolução, imagens e documentos)

> Como usar: salve em `docs/fase2-prontuario-clinico.md` e diga ao Claude Code:
> **"Leia docs/fase2-prontuario-clinico.md e siga as instruções."**

---

## Regras de trabalho (as mesmas da Fase 1, mais algumas)

1. **Antes de programar**, leia o código atual e o `ESTADO_DO_PROJETO.md` e me apresente um PLANO (tabelas novas, telas novas/alteradas, ordem das etapas). Espere minha aprovação.
2. Trabalhe **em etapas**; ao fim de cada uma: `npm test`, `npm run typecheck`, commit com mensagem clara e explicação em linguagem simples do que mudou.
3. Migrações Drizzle + `supabase/schema.sql` atualizado (padrão `if not exists`, `clinic_id`, RLS). Tabelas novas com `tenantColumns` e no motor de sincronização.
4. Offline-first: tudo funciona sem internet.
5. Dinheiro sempre em **centavos inteiros** (padrão já adotado na Fase 1).
6. Permissões conferidas **no processo principal** (`electron/main/ipc/util.ts`), não só na tela.
7. Ao final: atualizar `ESTADO_DO_PROJETO.md` e subir a versão para **0.9.0**.

### Regras legais que definem o desenho (NÃO negociáveis)
O prontuário odontológico é documento legal (Código de Ética do CFO e Resolução CFO-91/2009). Por isso:

- **Registros clínicos são imutáveis.** Anamnese, evolução, marcações do odontograma e documentos emitidos **não podem ser editados nem apagados** depois de salvos. Correção = novo registro do tipo **"adendo"** ligado ao original (o original continua visível, com aviso "corrigido por adendo em DD/MM").
- **Tudo registra quem fez e quando** (profissional/funcionário logado + data e hora). Usar o `audit_log` existente também para **cada abertura** de prontuário (LGPD: dado de saúde é sensível).
- **Nada de exclusão física** de dados clínicos, nem na nuvem. Se precisar ocultar, é `deleted_at` + motivo, e só o dono pode.
- **Sem assinatura digital ICP-Brasil (fica para depois), o papel ainda é necessário.** Então anamnese, plano/orçamento e termos precisam de um botão **"Imprimir para assinatura"** (PDF) e um campo **"Assinado em papel em DD/MM"**. Deixe o código preparado para, no futuro, assinar o PDF digitalmente.
- Imagens e arquivos clínicos: guardados sem prazo de expiração (guarda mínima legal de 10 anos; recomendação é guardar indefinidamente).

---

## Etapa A — Base

- **Profissionais:** novos campos `cro_number` e `cro_uf` (obrigatórios para emitir receita/atestado).
- **Clínica:** endereço, telefone e logo (opcional) para o cabeçalho dos documentos em PDF.
- **Tipos de procedimento:** novo campo `scope` = `face` | `dente` | `arcada` | `boca` | `nenhum` (define o que o dentista precisa selecionar no odontograma) e `odontogram_condition` (qual marcação o dente recebe quando esse procedimento é realizado, ex.: restauração, canal, extração, implante, coroa).
- **Ficha do paciente** ganha as abas, nesta ordem: **Resumo · Anamnese · Odontograma · Plano de tratamento · Evolução · Imagens · Documentos · Atendimentos · Financeiro**.
- **Faixa de alertas no topo da ficha** (e em qualquer tela que mostre o paciente, inclusive a agenda ao passar o mouse): alergias, anticoagulante, gestante, diabetes, hipertensão, cardiopatia etc. Vermelho e sempre visível. Tabela `patient_alerts` (texto, gravidade, origem: `anamnese` ou `manual`, ativo).

---

## Etapa B — Anamnese

- Tabela `anamnesis_templates`: nome + perguntas (JSON): texto, tipo de resposta (`sim_nao`, `texto`, `multipla_escolha`), obrigatória, **"gera alerta"** (sim/não + rótulo do alerta), "pedir detalhes se sim".
- Criar 4 modelos prontos e editáveis: **Padrão, Infantil, Ortodontia, Cirurgia/Implante**. Perguntas mínimas do padrão: motivo da consulta; doenças (diabetes, hipertensão, cardiopatia, problemas de coagulação, asma, epilepsia, hepatite/HIV, tireoide); medicamentos em uso (com campo livre); **alergias** (medicamentos, látex, anestésico); anticoagulantes; gestante/amamentando; cirurgias e internações; reação anterior a anestesia; fuma/bebe; bruxismo; última ida ao dentista; sangramento gengival; escovação e fio dental; observações.
- Tabela `anamnesis_records`: paciente, **cópia do modelo no momento do preenchimento** (se o modelo mudar depois, o registro antigo não muda), respostas, quem preencheu, data, assinado em papel (data).
- Nova anamnese = novo registro; a anterior fica no histórico. Mostrar aviso "Anamnese com mais de 12 meses — atualizar".
- Respostas marcadas como alerta **atualizam automaticamente** os `patient_alerts`.
- Botão "Imprimir para assinatura" (PDF com cabeçalho da clínica).
- Gerenciar modelos em **Configurações › Modelos de anamnese**.

---

## Etapa C — Odontograma anatômico

### C1. Desenho (faça primeiro e PARE para eu aprovar)
- Criar **desenhos próprios em SVG** (não copiar de outros softwares nem de imagens da internet) para cada tipo de dente: incisivo central, incisivo lateral, canino, 1º e 2º pré-molar, 1º, 2º e 3º molar — superiores e inferiores, espelhados para os lados direito/esquerdo — e versões dos **dentes decíduos**.
- Cada dente mostra: **vista vestibular** (coroa + raiz) e **vista oclusal/incisal** com as **5 faces clicáveis**: Mesial (M), Distal (D), Oclusal/Incisal (O/I), Vestibular (V), Lingual/Palatina (L/P). Também área clicável da **raiz** (para canal) e da **região cervical** (para doença periodontal).
- Numeração **FDI**: permanentes 11–18, 21–28, 31–38, 41–48; decíduos 51–55, 61–65, 71–75, 81–85. Número visível em cada dente.
- Seletor de dentição: **Permanente · Decídua · Mista**.
- Crie uma **página de pré-visualização** (pode ser um HTML separado ou uma rota de desenvolvimento) com a arcada completa para eu ver o desenho. **Pare e espere minha aprovação antes da C2.**
- Importante: os dados do odontograma devem ser **independentes do desenho** (guardar dente + faces + condição), para podermos oferecer também uma visão geométrica no futuro sem mudar o banco.

### C2. Marcações
- Legenda fixa visível na tela, padrão mais usado no Brasil:
  - **Verde** = sem necessidade de intervenção / satisfatório
  - **Vermelho** = precisa de tratamento (planejado)
  - **Azul** = tratamento realizado
  - **Preto** = dente ausente (preenchido) / incluso (contorno)
- Catálogo de condições (constante no código, com cor e símbolo de cada uma): cárie; restauração (satisfatória, insatisfatória, provisória); canal (traço na raiz); extração indicada (X vermelho); ausente (preto); incluso (contorno preto); implante; coroa; prótese fixa/ponte; selante; fratura; desgaste; mobilidade (grau 1, 2, 3); doença periodontal (traço cervical); dente decíduo presente; observação livre.
- Tabela `odontogram_entries`: paciente, dente (FDI), faces (lista), condição, status (`existente` | `planejado` | `realizado`), profissional, data/hora, observação, `treatment_plan_item_id` (opcional), `superseded_by` (quando uma marcação nova substitui a anterior — **nunca apagar**).
- Clicar num dente abre um painel lateral com o **histórico daquele dente** (linha do tempo).
- Filtro de visão: **Situação atual** · **Plano de tratamento** · **Histórico em uma data**.

---

## Etapa D — Plano de tratamento e orçamento

- Tabelas `treatment_plans` (paciente, profissional, status: `rascunho` → `apresentado` → `aprovado` | `recusado` → `concluido`, validade do orçamento, observações) e `treatment_plan_items` (procedimento, dente, faces, preço em centavos, desconto, status: `planejado` | `agendado` | `realizado` | `cancelado`, `appointment_id`).
- **Montar pelo odontograma:** selecionar dente/faces → escolher procedimento (filtrado pelo `scope`) → o item entra no plano e a marcação aparece em **vermelho**. Também dá para adicionar itens sem dente (ex.: limpeza, clareamento).
- Permitir **mais de uma opção de plano** para o mesmo paciente (ex.: "Opção A — restaurações" e "Opção B — coroas").
- **Imprimir orçamento** (PDF) com itens, total, desconto, formas de pagamento e campo de assinatura.
- **Aprovar plano** → gera a cobrança usando o que já existe da Fase 1 (itens + parcelas). Não duplicar lógica de financeiro.
- Botão **"Agendar"** em cada item → abre o novo agendamento já com paciente, procedimento e duração.
- Item realizado → marcação vira **azul** automaticamente.

---

## Etapa E — Evolução clínica

- Tabela `clinical_notes`: paciente, atendimento (opcional), profissional, texto, data/hora, tipo (`evolucao` | `adendo`), `parent_id` (para adendos).
- **Imutável** (ver regras legais). Mostrar em linha do tempo, mais recente no topo.
- Ao finalizar procedimento, **sugerir** um texto (ex.: "Restauração em resina, dente 36, faces O e D") que o dentista **revisa e confirma** — não salvar sozinho.
- Textos rápidos favoritos por profissional (ex.: "Paciente orientado sobre higiene").

---

## Etapa F — Modo atendimento (o coração desta fase)

- Na agenda, no agendamento do dia: botão **"Iniciar atendimento"** → abre a tela `/atendimento/:appointmentId` (tela cheia).
- Layout:
  - **Topo:** nome, idade, foto (se houver) e **faixa de alertas**.
  - **Centro:** odontograma anatômico.
  - **Lateral (abas):** Evolução do dia · Plano de tratamento · Anamnese (somente leitura + botão atualizar) · Imagens · Documentos.
  - **Rodapé:** botão **"Finalizar atendimento"** → marca itens do plano realizados → modal de baixa de estoque (já existe) → cobrança (já existe) → evolução para confirmar.
- Se o paciente não tem anamnese ou está vencida, mostrar aviso logo ao abrir.
- O dentista não deve precisar sair desta tela para nada no atendimento normal.

---

## Etapa G — Fotos e raio-x

- Tabela `patient_files`: paciente, tipo (`foto_intraoral`, `foto_extraoral`, `raio_x_periapical`, `panoramica`, `tomografia`, `documento_digitalizado`, `outro`), dente(s) opcional, data do exame, descrição, caminho local, hash (para detectar arquivo corrompido), tamanho, quem enviou.
- Aceitar JPG, PNG e PDF (DICOM fica fora por enquanto). **Arrastar e soltar** na ficha e no modo atendimento.
- Guardar os arquivos na pasta de dados do app (organizada por paciente), **gerar miniatura** e comprimir fotos grandes mantendo boa qualidade (raio-x **sem** perda de qualidade).
- **Nuvem:** enviar em segundo plano para um bucket **privado** do Supabase Storage, caminho por `clinic_id/patient_id/`, com política RLS; nunca público. Se estiver sem internet, fica na fila.
- Visualizador com zoom, brilho/contraste (para raio-x) e **comparar antes e depois** lado a lado.
- Ligar imagem a um dente: aparece no histórico daquele dente no odontograma.

---

## Etapa H — Documentos (receitas, atestados e termos)

- Modelos: **Receita simples**, **Atestado odontológico** (com CID opcional e período), **Declaração de comparecimento**, **Termo de consentimento** (modelos editáveis por procedimento: extração, implante, clareamento, tratamento de canal, anestesia).
- Preencher automaticamente: dados da clínica, paciente (nome, CPF, idade), profissional (nome, CRO/UF), data.
- Receita: medicamentos com nome, dosagem, posologia e quantidade; **lista de favoritos por profissional**.
- Gerar **PDF** para imprimir e assinar. Cada documento emitido é salvo em `issued_documents` com **cópia exata do conteúdo** (imutável), e aparece na aba Documentos.
- Receita de **controle especial** fica fora desta fase (tem regras próprias) — mostrar só a receita simples.

---

## Etapa I — Permissões, auditoria e testes

| Área clínica | Dono | Admin | Profissional | Recepção |
|---|---|---|---|---|
| Ver alertas do paciente | sim | sim | sim | sim |
| Preencher anamnese (digitar a ficha em papel) | sim | sim | sim | sim |
| Ver anamnese completa | sim | não* | sim | não |
| Odontograma, plano, evolução | sim | não* | sim (evolução só em seu nome) | não |
| Orçamento (valores) e imprimir | sim | sim | sim | sim |
| Imagens clínicas | sim | não* | sim | só anexar |
| Emitir receita/atestado | não | não | sim (exige CRO) | não |
| Ocultar registro (com motivo) | sim | não | não | não |

\* O dono pode liberar acesso clínico para um admin em Configurações › Funcionários.

- Registrar no `audit_log`: abertura de prontuário, criação de cada registro clínico, impressão de documentos.
- Testes automáticos: imutabilidade (tentar editar/apagar registro clínico deve falhar), adendos, plano aprovado gera cobrança correta, permissões por cargo.
- Conferir que as views públicas do autoagendamento **não expõem** nenhuma tabela clínica.

---

## Fora do escopo desta fase
Assinatura digital ICP-Brasil, anamnese enviada por link/WhatsApp, lembretes automáticos, lista de retornos e orçamentos parados, fichas de especialidade (ortodontia, periograma, harmonização), controle de próteses/laboratório, DICOM, receita de controle especial, recursos de IA.
