---
name: outreach-automation
description: >
  Agents 4, 5 e 6 do pipeline W3 Sites Agency. Roteiro de VSL de 90s (Agent 4),
  sequência multi-canal WhatsApp+Email com follow-ups (Agent 5), e estrutura
  Calendly + script da call de 15min (Agent 6). Lê pipeline-state.json. Output
  em default_working_dir/outreach/. Acionar para: "criar VSL", "sequência de
  prospecção", "cold outreach", "script de WhatsApp", "integrar Calendly",
  "follow-up automatizado", "abordagem para vender sites".
---

# Outreach Automation — Agents 4, 5 e 6

Skill consolidada para a fase de conversão do pipeline. Roteiros e sequências
prontos para envio. Detecta qual agent invocou via `context.agent_id`.

## Input comum (todos os agents)

Ler `default_working_dir/pipeline-state.json`. Validar:

- `agent3_completed: true` → Agent 3 (Builder) terminou
- `top_lead`, `perda_mensal`, `site_url` presentes

Se faltar dado obrigatório → abortar e reportar.

---

## Agent 4 — VSL Writer (Roteiro de Vídeo 90s)

### Output

`default_working_dir/outreach/[slug]-vsl-script.md`

### Estrutura obrigatória

```markdown
# Roteiro VSL — [Empresa] (90 segundos)

## Setup técnico

- Formato: vertical 9:16 (Reels/Shorts) ou horizontal 16:9 (LinkedIn/email)
- Locação: home office bem iluminado, plano peito
- B-roll sugerido: screenshot do site demo + Google Maps mostrando concorrentes

---

## [0:00 – 0:10] GANCHO

> Oi [Nome] da [Empresa], é o [Seu Nome] aqui.
>
> Reservei 90 segundos pra te mostrar uma coisa que pode mudar o jogo
> da [Empresa] em [cidade].

**Tom:** direto, olhando na câmera, sem fundo musical alto.

## [0:10 – 0:30] DOR

> Pesquisei "[nicho] [cidade]" no Google agora. Sabe quantos clientes
> tão procurando isso? Centenas por mês. E sabe quem aparece pra eles?
>
> [Concorrente 1], [Concorrente 2], [Concorrente 3] — todos com site.
>
> A [Empresa] não aparece. Vocês têm [rating] estrelas, [reviews]
> avaliações, são melhores que os concorrentes — mas tão invisíveis.

**B-roll:** mostrar busca real no Google enquanto fala.

## [0:30 – 0:60] WOW

> Olha o que eu fiz: montei o site de vocês.
>
> [Mostrar tela do site na demo URL]
>
> Texto, fotos, contato, mapa, depoimentos. Tudo personalizado pra
> [Empresa]. Cliquei um botão e tá no ar. Pode ver agora: [URL].

**B-roll:** screen recording do site, scroll suave de cima a baixo.

## [0:60 – 0:80] PROVA SOCIAL

> Fiz isso pra uma [nicho similar] em [outra cidade] mês passado.
> Em 30 dias: 47 ligações novas, R$ 12 mil em receita extra. Mesma
> ideia: site + Google Maps + WhatsApp conectados.

**Adaptar prova social ao nicho** (não inventar números — usar case real ou
remover essa seção se não tiver case).

## [0:80 – 0:90] CTA

> 15 minutos comigo, sem compromisso, te mostro como ativar isso pra
> [Empresa]. Link aqui [Calendly]. Te espero.

**Tom:** sorrir no final. Não pedir, oferecer.

---

## Variações de gancho (A/B test)

### V1 (curiosidade)

> [Nome], reservei 90s pra te contar uma coisa que pode valer R$ [perda_mensal] por mês pra [Empresa].

### V2 (provocação)

> [Nome], sua concorrência tá te roubando cliente todo dia. Em 90s eu provo.

### V3 (humildade)

> [Nome], não te conheço, mas pesquisei a [Empresa] e fiz uma coisa pra você ver. 90s.

---

## Checklist gravação

- [ ] Mencionar nome da empresa no primeiro segundo
- [ ] Mostrar tela do site real (não mockup estático)
- [ ] Falar o valor R$ X/mês em algum momento
- [ ] CTA curto e único (não dois CTAs)
- [ ] Vídeo < 95 segundos
```

### Update pipeline-state.json

```json
{ "agent4_completed": true, "vsl_script_file": "default_working_dir/outreach/[slug]-vsl-script.md" }
```

---

## Agent 5 — Outreach Specialist (Sequência WhatsApp + Email)

### Output

`default_working_dir/outreach/[slug]-sequence.md`

### Conteúdo

```markdown
# Sequência de Outreach — [Empresa]

## CANAL 1: WhatsApp

### Mensagem 1 — Primeiro contato (D+0)

> Oi [Nome]! Tudo bem?
>
> Sou [Seu Nome], trabalho com presença digital pra negócios locais
> aqui em [cidade]. Vi a [Empresa] no Google — [rating] estrelas,
> [reviews] avaliações. Top demais!
>
> Fiz um diagnóstico rápido sobre presença digital de vocês.
> Posso te mandar? São 2 minutos de leitura.

**Quando enviar:** horário comercial local, evitar segunda 9h e sexta 18h.

### Mensagem 2 — Envio do material (após resposta)

> Beleza! Olha só:
>
> 📊 Diagnóstico: [URL_DIAGNOSTICO_HTML]
> 🌐 Site demonstração: [URL_SITE]
> 🎥 Vídeo de 90s explicando: [URL_VSL]
>
> Dá uma olhada com calma. Não é venda, é só pra você ver o tamanho
> da oportunidade que tá deixando passar.

### Follow-up 1 — D+2 (48h)

> [Nome], conseguiu olhar o material que mandei? Aquela conta de
> R$ [perda_mensal]/mês ali em cima 😅
>
> Tô tranquilo, sem pressão. Só queria saber se faz sentido pra você
> uma conversa de 15min sem compromisso.

### Follow-up 2 — D+5

> Oi [Nome], última mensagem pra não te incomodar.
>
> Se hoje não é o momento, sem problema — fica meu contato salvo.
> Se mudar de ideia, me chama.
>
> Sucesso aí com a [Empresa]! 🙏

---

## CANAL 2: Email (paralelo)

### Subject line — 4 variações para A/B

A. Site demonstração pronto para a [Empresa]
B. [Nome], perdi 2h montando isso pra você
C. Quanto custa não ter site? Calculei pra [Empresa].
D. Vi seu perfil no Google — tenho algo pra mostrar

**Recomendação:** começar com B (curiosidade pessoal converte mais
em cold email).

### Corpo do email
```

[Nome],

Pesquisei [nicho] em [cidade] hoje e a [Empresa] me chamou atenção:
[rating] estrelas, [reviews] avaliações. Vocês são bons.

Mas reparei que vocês não aparecem nas primeiras buscas — seus
concorrentes com site (anexo a lista) capturam esse tráfego.

Calculei o tamanho disso: aproximadamente R$ [perda_mensal]/mês.

Não é só conversa — montei um diagnóstico completo + um site
demonstração já no ar pra você ver. Sem cadastro, sem pegadinha:

→ Diagnóstico: [URL]
→ Site demo: [URL]

Se quiser conversar 15min sem compromisso, link aqui: [CALENDLY]

Abraço,
[Seu Nome]

P.S.: Se não for pra você, sem problema. Mas dá uma olhada no
diagnóstico — vale só pelo número.

```

### Follow-up email D+3

```

[Nome],

Sei que email some na caixa, então mando rápido:

→ Diagnóstico que fiz pra [Empresa]: [URL]
→ O número é R$ [perda_mensal]/mês.

Vale 5 minutos. Se não fizer sentido, deleta sem culpa.

[Seu Nome]

````

---

## Métricas a acompanhar

| Métrica | Meta |
|---|---|
| Taxa de resposta WhatsApp M1 | >25% |
| Taxa de resposta email | >5% |
| Conversão para call agendada | >10% dos respondentes |
| No-show da call | <30% |

## Update pipeline-state.json

```json
{ "agent5_completed": true, "sequence_file": "default_working_dir/outreach/[slug]-sequence.md" }
````

---

## Agent 6 — Calendly Manager

### Output

`default_working_dir/outreach/[slug]-calendly.md`

### Conteúdo

```markdown
# Calendly Setup — Call com [Empresa]

## Tipo de evento

**Nome:** Consultoria Gratuita 15min — Análise Digital
**Duração:** 15 minutos
**Buffer:** 5min antes, 10min depois
**Disponibilidade:** seg-sex 9h-12h e 14h-18h (horário local cidade)
**Antecedência mínima:** 24h
**Antecedência máxima:** 14 dias

## Perguntas de qualificação no agendamento

1. **Seu nome completo?** (texto, obrigatório)
2. **Nome da empresa e cidade?** (texto, obrigatório)
3. **Como você conheceu a gente?** (single choice)
   - WhatsApp
   - Email
   - Indicação
   - Outro
4. **Qual seu maior objetivo com presença digital?** (single choice)
   - Atrair mais clientes
   - Profissionalizar a marca
   - Acompanhar concorrentes
   - Ainda não sei
5. **Budget mensal disponível para marketing digital?** (single choice, opcional)
   - Até R$ 500
   - R$ 500 – R$ 2.000
   - R$ 2.000 – R$ 5.000
   - Acima de R$ 5.000
   - Prefiro não dizer

## Mensagem de confirmação automática
```

Olá [Nome]!

Sua call está confirmada para [data e hora]. Aqui está o que
preparei pra você antes da conversa:

→ Site demonstração da [Empresa]: [URL_SITE]
→ Diagnóstico financeiro: [URL_DIAGNOSTICO]
→ Link Google Meet/Zoom: [URL_CALL]

Dá uma olhada nos 2 primeiros antes da call — vai render muito mais
o nosso tempo juntos.

Se precisar remarcar, é só clicar aqui: [URL_REAGENDAR]

Até [data]!

[Seu Nome]

```

## Lembrete 24h antes

```

Oi [Nome]! Lembrete da nossa conversa amanhã às [hora].

Já viu o site demo? [URL_SITE]

Te encontro lá! [URL_CALL]

```

## Lembrete 1h antes

```

[Nome], call em 1h! [URL_CALL]

````

---

## Script da call (15min)

### [0:00 – 0:02] Quebra-gelo
- Cumprimentar pelo nome
- Confirmar que olhou o site demo: "Conseguiu dar uma olhada no site que fiz?"

### [0:02 – 0:05] Validação
- "O que você achou?" (deixar falar — anotar objeções)
- "Faz sentido pra realidade da [Empresa]?"

### [0:05 – 0:10] Apresentação da proposta
- Preço: R$ [valor] setup + R$ [mensal]/mês manutenção
- O que inclui: site + domínio + hospedagem + ajustes + Google Maps otimizado + relatório mensal
- Diferencial: entrega em 7 dias, garantia 30 dias

### [0:10 – 0:13] Tratamento de objeções comuns

| Objeção | Resposta |
|---|---|
| "Tá caro" | Comparar com perda mensal estimada (R$ [perda_mensal]). ROI em [X] dias. |
| "Vou pensar" | "Pensar no quê especificamente? Posso esclarecer agora." |
| "Já tenho Instagram" | "Site é seu ativo. Instagram é alugado — algoritmo decide quem te vê." |
| "Tá ruim de grana" | "Entendo. Posso te enviar 3 dicas grátis pra começar e quando quiser, fica aqui." |

### [0:13 – 0:15] Fechamento
- **Se sim:** "Beleza! Te mando o contrato e link de pagamento em 1h. Começamos hoje mesmo."
- **Se "vou pensar":** "Sem problema. Te mando um resumo do que conversamos por WhatsApp. Posso te ligar daqui 3 dias?"
- **Se não:** "Tranquilo. Posso te enviar conteúdo gratuito de marketing pra [nicho]? Caso queira no futuro."

---

## Integração técnica (futuro)

Se houver `CALENDLY_TOKEN` no env:
- Webhook para receber novos agendamentos
- Postar nas Mensagens 1/2 do Agent 5 o link `[CALENDLY]` real (não placeholder)
- Atualizar `pipeline-state.json` com `calendly_url` real

## Update pipeline-state.json

```json
{
  "agent6_completed": true,
  "calendly_file": "default_working_dir/outreach/[slug]-calendly.md",
  "calendly_url": "[URL real ou placeholder]"
}
````
