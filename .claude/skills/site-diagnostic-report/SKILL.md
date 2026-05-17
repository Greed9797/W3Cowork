---
name: site-diagnostic-report
description: >
  Agent 2 do pipeline W3 Sites Agency. Gera diagnóstico personalizado para empresa
  SEM SITE: calcula perda financeira mensal, identifica 3 concorrentes com site,
  produz HTML de impacto + script de abordagem WhatsApp. Lê pipeline-state.json
  do Agent 1. Output em default_working_dir/diagnostics/. Acionar para:
  "gerar diagnóstico", "criar relatório de oportunidade", "calcular perda mensal",
  "análise de presença digital", "relatório de impacto financeiro".
---

# Site Diagnostic Report — Agent 2 (Diagnosticador)

Transforma um lead bruto (Agent 1) em material de vendas pronto para abordagem.

## Input

Ler `default_working_dir/pipeline-state.json` e extrair `top_lead`. Se
`agent1_completed !== true` → abortar e reportar erro.

## Cálculo de perda mensal (R$)

Tabela de ticket médio por nicho (referência BR):

```javascript
const TICKETS = {
  padaria: 35,
  restaurante: 85,
  pizzaria: 70,
  hamburgueria: 60,
  cafeteria: 45,
  salao: 150,
  barbearia: 80,
  clinica: 350,
  dentista: 400,
  fisioterapia: 200,
  estetica: 250,
  advogado: 800,
  contabilidade: 600,
  arquiteto: 1500,
  oficina: 450,
  petshop: 120,
  academia: 150,
  escola: 350,
  default: 120,
};
```

Fórmula:

```
ticket_medio        = TICKETS[nicho] ?? TICKETS.default
buscas_perdidas_mes = (reviews / 12) * 10        # proxy: 10x reviews/mês como volume mensal
clientes_perdidos   = round(buscas_perdidas * 0.03)  # 3% conversão
perda_mensal        = clientes_perdidos * ticket_medio
perda_anual         = perda_mensal * 12
```

## Output obrigatório

### Arquivo 1 — HTML de impacto

`default_working_dir/diagnostics/[slug]-diagnostico.html`

Slug = lowercase(nome), remover acentos/pontuação, espaços → `-`.

Estrutura mínima (renderizar com inline CSS, mobile-first):

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diagnóstico Digital — [Empresa]</title>
  </head>
  <body
    style="font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 16px; color: #111;"
  >
    <!-- HERO -->
    <h1 style="font-size: 32px; margin: 0 0 8px;">Diagnóstico Digital</h1>
    <p style="color: #666; font-size: 18px; margin: 0 0 32px;">
      Para: <strong>[Nome da Empresa]</strong>
    </p>

    <!-- SEÇÃO 1: Situação Atual -->
    <section style="background: #f6f6f6; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
      <h2 style="margin-top: 0;">📍 Sua Situação Hoje</h2>
      <p>Nota no Google: <strong>[rating] ⭐</strong> ([reviews] avaliações)</p>
      <p>Categoria: <strong>[nicho]</strong></p>
      <p>Cidade: <strong>[cidade]</strong></p>
      <p style="color: #c00;"><strong>❌ Sem site profissional</strong></p>
    </section>

    <!-- SEÇÃO 2: Perda (NÚMERO GRANDE) -->
    <section
      style="background: #fff4e6; border-left: 4px solid #ff6b00; padding: 24px; border-radius: 8px; margin-bottom: 24px;"
    >
      <h2 style="margin-top: 0; color: #c75300;">💸 Quanto Você Está Perdendo</h2>
      <p style="font-size: 56px; font-weight: 900; color: #c75300; margin: 16px 0; line-height: 1;">
        R$ [perda_mensal_formatado]
      </p>
      <p style="font-size: 18px; color: #666; margin: 0;">por mês</p>
      <p style="color: #444; margin-top: 16px;">
        Estimamos ~<strong>[clientes_perdidos] clientes/mês</strong> indo para concorrentes que
        aparecem no Google com site profissional.
      </p>
      <p style="font-size: 14px; color: #888; margin-top: 16px;">
        Em 12 meses: <strong>R$ [perda_anual_formatado]</strong>
      </p>
    </section>

    <!-- SEÇÃO 3: Concorrentes -->
    <section style="margin-bottom: 24px;">
      <h2>🏆 Concorrentes Que Já Capturam Esse Tráfego</h2>
      <p style="color: #666;">
        Pesquisamos [nicho] em [cidade]. Estes 3 têm site e aparecem antes de você:
      </p>
      <ol>
        <li><strong>[concorrente_1]</strong> — [url_1]</li>
        <li><strong>[concorrente_2]</strong> — [url_2]</li>
        <li><strong>[concorrente_3]</strong> — [url_3]</li>
      </ol>
    </section>

    <!-- SEÇÃO 4: CTA -->
    <section
      style="background: #0066ff; color: #fff; padding: 32px; border-radius: 12px; text-align: center;"
    >
      <h2 style="color: #fff; margin-top: 0;">🚀 Próximo Passo</h2>
      <p style="font-size: 18px; margin: 16px 0;">
        Quero te mostrar como recuperar essa receita. 15 minutos, sem compromisso.
      </p>
      <a
        href="[CALENDLY_URL_PLACEHOLDER]"
        style="display: inline-block; background: #fff; color: #0066ff; padding: 16px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 18px;"
      >
        Agendar Conversa Gratuita →
      </a>
    </section>

    <footer style="text-align: center; color: #999; margin-top: 32px; font-size: 14px;">
      Diagnóstico gerado em [data] · W3 Sites Agency
    </footer>
  </body>
</html>
```

### Arquivo 2 — Script de abordagem

`default_working_dir/diagnostics/[slug]-script.md`

```markdown
# Script WhatsApp — [Empresa]

## Mensagem inicial (após cumprimentar)

Oi [Nome]! Pesquisei [nicho] em [cidade] hoje e notei que a [Empresa] tem
[rating] estrelas com [reviews] avaliações no Google — top!

Mas reparei uma coisa: os concorrentes de vocês que têm site aparecem antes
nas buscas. Montei um diagnóstico rápido mostrando o impacto disso —
estimei algo em torno de R$ [perda_mensal_formatado]/mês em clientes
que estão indo pra eles.

Posso te enviar?

## Se responder "sim, manda"

[link do diagnóstico HTML hospedado]

Dá uma olhada e me fala o que achou. Não é venda — é só pra você ver
o tamanho da oportunidade.

## Follow-up 24h depois

E aí [Nome], conseguiu ver o material? Tem alguma dúvida?

## Follow-up 48h (se sem resposta)

[Nome], última: posso te garantir 15 minutos sem compromisso pra mostrar
exatamente como capturar esses R$ [perda_mensal_formatado]/mês. Topa?

[link Calendly]
```

### Arquivo 3 — Atualizar pipeline-state.json

```json
{
  "agent2_completed": true,
  "perda_mensal": 4200,
  "perda_anual": 50400,
  "clientes_perdidos_mes": 12,
  "ticket_medio": 350,
  "diagnostico_file": "default_working_dir/diagnostics/padaria-exemplo-diagnostico.html",
  "script_file": "default_working_dir/diagnostics/padaria-exemplo-script.md",
  "concorrentes": [
    { "nome": "...", "url": "..." },
    { "nome": "...", "url": "..." },
    { "nome": "...", "url": "..." }
  ]
}
```

## Regras

- Formato BR: `R$ 4.200,00` (ponto milhar, vírgula decimal).
- Se `reviews < 5` → marcar perda como "estimativa baixa confiança" no rodapé.
- NUNCA inventar concorrentes — usar `web_search` real (`"[nicho] [cidade]" site`).
- Se não achar 3 concorrentes com site → preencher os que achou + nota explicativa.
- CTA aponta para `[CALENDLY_URL_PLACEHOLDER]` (Agent 6 preenche depois).

## Handoff para Agent 3 (Builder)

Agent 3 lerá `pipeline-state.json` e usará: `top_lead` + `perda_mensal` para
construir o site demonstração com diagnóstico embutido.
