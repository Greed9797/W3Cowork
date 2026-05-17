---
name: design-constraint-enforcer
description: >
  O SEGREDO do sistema — garante que QUALQUER edição da IA em um site obedeça o DESIGN.md existente.
  Previne que ajustes quebrem o layout. Valida antes de executar. Corrige sem perder consistência.
  Acionar SEMPRE que o usuário quiser: editar/ajustar/mudar qualquer componente de um site,
  "muda esse botão", "ajusta o header", "troca a cor", "adiciona uma seção", "refatora o CSS",
  ou qualquer modificação em código frontend onde existe um DESIGN.md ativo.
  TAMBÉM acionar para: criar o DESIGN.md de um projeto do zero, converter identidade visual em DESIGN.md,
  ou atualizar o DESIGN.md após mudança de branding.
  Output: edição validada + DESIGN.md atualizado se necessário + relatório de conformidade.
---

# Design Constraint Enforcer

O sistema que resolve o problema central: a IA é probabilística e pode quebrar o layout inteiro ao ajustar um botão. Este skill força conformidade determinística antes de qualquer edição.

## Princípio Central

```
ANTES de qualquer edição de UI:
1. Ler DESIGN.md do projeto
2. Mapear quais tokens/regras a edição vai tocar
3. Gerar a edição dentro dos constraints
4. Validar o resultado contra DESIGN.md
5. Só então aplicar
```

## Fase 1 — Criar ou Atualizar DESIGN.md

Se não existe um DESIGN.md no projeto, criar agora. Usar este template:

````markdown
# DESIGN.md — [Nome do Projeto]

_Gerado em: [data] | Versão: 1.0_

## Visual Identity Lock

> REGRA: Nenhuma edição de UI pode contradizer este documento.
> Se houver conflito, o DESIGN.md prevalece. Pergunte ao usuário antes de desviar.

## 1. Paleta de Cores

| Token                  | Hex    | Uso                                    |
| ---------------------- | ------ | -------------------------------------- |
| --color-primary        | #[HEX] | CTAs, botões principais, destaques     |
| --color-secondary      | #[HEX] | Elementos de suporte, hover states     |
| --color-background     | #[HEX] | Background da página                   |
| --color-surface        | #[HEX] | Cards, modais, painéis                 |
| --color-text-primary   | #[HEX] | Títulos, texto principal               |
| --color-text-secondary | #[HEX] | Subtítulos, texto auxiliar             |
| --color-border         | #[HEX] | Bordas, dividers                       |
| --color-accent         | #[HEX] | Alertas, badges, destaques secundários |

## 2. Tipografia

| Papel         | Família | Peso   | Tamanho  | Line-height |
| ------------- | ------- | ------ | -------- | ----------- |
| Heading 1     | [fonte] | [peso] | [px/rem] | [ratio]     |
| Heading 2     | [fonte] | [peso] | [px/rem] | [ratio]     |
| Body          | [fonte] | [peso] | [px/rem] | [ratio]     |
| Small/Caption | [fonte] | [peso] | [px/rem] | [ratio]     |
| Code/Mono     | [fonte] | [peso] | [px/rem] | [ratio]     |

## 3. Espaçamento e Grid

- Grid: [cols] colunas, gap de [px]
- Container max-width: [px]
- Padding horizontal base: [px]
- Escala de espaçamento: [4|8|12|16|24|32|48|64]px

## 4. Componentes

### Botão Primário

```css
background: var(--color-primary);
color: #fff;
border-radius: [px];
padding: [py] [px];
font-weight: [peso];
hover: background lighten/darken [%];
```
````

### Botão Secundário

```css
background: transparent;
border: 1px solid var(--color-primary);
color: var(--color-primary);
```

### Card

```css
background: var(--color-surface);
border-radius: [px];
padding: [px];
border: 1px solid var(--color-border);
```

### Input

```css
border: 1px solid var(--color-border);
border-radius: [px];
padding: [py] [px];
focus-border: var(--color-primary);
```

## 5. Motion

- Transições: [ms] ease-[tipo]
- Hover scale: [ratio]
- Scroll animations: [sim/não] — [biblioteca]

## 6. Regras de Consistência (DO / DON'T)

### ✅ SEMPRE

- Usar tokens CSS (`var(--color-primary)`) em vez de hex direto
- Manter o grid de [cols] colunas
- Usar apenas as fontes listadas na seção 2
- Border-radius consistente por tipo de elemento

### ❌ NUNCA

- Adicionar novas cores fora da paleta sem aprovação
- Misturar famílias de fonte
- Quebrar o grid com posicionamento absoluto sem justificativa
- Usar opacity < 0.5 em texto (acessibilidade)

## 7. Referências Visuais

- Estilo base: [nome do estilo — ex. "Minimal SaaS", "Editorial Dark", "Premium Light"]
- Inspirações: [URLs ou nomes de sites]
- Tom visual: [adjetivos — ex. "sóbrio, técnico, confiável"]

```

## Fase 2 — Validação Antes de Editar

Para CADA request de edição, rodar este checklist mental:

```

VALIDATION CHECKLIST
□ A cor usada está na paleta do DESIGN.md?
□ A fonte e peso estão na tipografia definida?
□ O border-radius respeita o padrão do componente?
□ O espaçamento segue a escala definida?
□ O novo componente segue o padrão de tokens CSS?
□ A edição quebra alguma regra da seção DO/DON'T?
□ A animação/transição respeita as durações definidas?

````

Se QUALQUER resposta for "não" → parar, reportar conflito, propor correção antes de editar.

## Fase 3 — Edição com Constraints

Ao gerar código editado, sempre:

```html
<!-- ANTES de editar, comentar o estado original -->
<!-- DESIGN.md tokens sendo usados: --color-primary, --font-heading -->

<!-- EDIÇÃO: Botão CTA atualizado -->
<button class="btn-primary" style="
  background: var(--color-primary);    /* DESIGN.md: cor primária */
  font-family: var(--font-heading);    /* DESIGN.md: fonte de heading */
  border-radius: var(--radius-md);     /* DESIGN.md: radius padrão de botão */
  padding: var(--space-3) var(--space-6);  /* DESIGN.md: escala de espaçamento */
">
  Começar agora
</button>
````

## Fase 4 — Relatório de Conformidade

Após cada edição, gerar:

```markdown
## Relatório de Conformidade — [componente editado]

Data: [data]

### Tokens utilizados

- ✅ background: var(--color-primary) — conforme DESIGN.md
- ✅ font: var(--font-heading) — conforme DESIGN.md
- ✅ border-radius: 8px — conforme padrão de botão

### Desvios detectados

- ⚠️ Nenhum desvio nesta edição

### Risco de regressão

- Baixo — edição isolada em componente atômico
```

## Integração com awesome-design-md

Se o projeto usa um DESIGN.md do repositório awesome-design-md (ex. Vercel, Stripe, Apple), importar e estender:

```bash
# Baixar DESIGN.md base
curl -o DESIGN.md https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/vercel/DESIGN.md

# Adicionar seção de personalização ao final
cat >> DESIGN.md << 'EOF'

## 8. Customizações do Projeto
[Seus overrides aqui — mantém o DESIGN.md base intacto acima]
EOF
```

## Anti-Patterns que Este Skill Previne

| Problema                                          | Como o Skill Bloqueia                                 |
| ------------------------------------------------- | ----------------------------------------------------- |
| "Muda o botão pra azul" sem especificar o tom     | Valida contra paleta, usa --color-primary ou pergunta |
| IA adiciona `font-family: Arial` aleatoriamente   | Checklist detecta fonte fora do DESIGN.md             |
| Card com border-radius diferente dos outros cards | Valida contra padrão de componente                    |
| Gradiente aleatório no hero                       | Detecta cor fora da paleta                            |
| Animação de 1000ms quando padrão é 300ms          | Valida contra seção Motion                            |
