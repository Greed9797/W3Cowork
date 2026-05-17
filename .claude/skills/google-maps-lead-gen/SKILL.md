---
name: google-maps-lead-gen
description: >
  Agent 1 do pipeline W3 Sites Agency. Prospecta empresas SEM SITE no Google Maps
  por nicho e região. Gera lista qualificada com score de oportunidade (0-100).
  Output em JSON + CSV em default_working_dir/leads/. Atualiza pipeline-state.json
  com top_lead. Acionar para: "prospectar empresas", "varrer Google Maps",
  "encontrar clientes sem site", "lead gen local", "lista de leads", "achar PMEs".
---

# Google Maps Lead Gen — Agent 1 (Prospector)

Encontra empresas locais sem site, classifica por oportunidade, entrega lista pronta
para o Agent 2 (Diagnosticador) consumir.

## Input esperado (via Paperclip task context)

```json
{
  "nicho": "padaria",
  "cidade": "Curitiba, PR",
  "raio_km": 10,
  "quantidade": 50
}
```

Se algum campo faltar: usar default seguro (`raio_km: 10`, `quantidade: 30`) e seguir.

## Pipeline de execução

### 1. Busca

Preferir tool `web_search` com queries:

- `"[nicho] em [cidade] site:maps.google.com"`
- `"[nicho] [cidade] -site:facebook.com -site:instagram.com"`
- `"melhores [nicho] [cidade]"`

Se `GOOGLE_MAPS_API_KEY` disponível: usar Places API (`textsearch` + `details`).

### 2. Coleta por resultado

Extrair:

- `nome` (string)
- `endereco` (string)
- `telefone` (string ou null)
- `rating` (number 0-5 ou null)
- `reviews` (int ou 0)
- `tem_site` (bool — verificar campo "Website" no Maps)
- `categoria` (string)
- `place_id` (se via Places API)

### 3. Filtro

Manter SÓ empresas onde `tem_site === false`.

### 4. Score de oportunidade (0-100)

```
score = 0
if !tem_site:               score += 50
if rating >= 4.0:           score += 20
if reviews >= 50:           score += 15
if telefone != null:        score += 10
if nicho in ["clinica","advogado","arquiteto","dentista","contabilidade"]:
                            score += 5
score = min(score, 100)
```

### 5. Output obrigatório

**Arquivo 1** — `default_working_dir/leads/[timestamp]-[nicho]-[cidade-slug].json`:

```json
{
  "timestamp": "2026-05-16T20:00:00Z",
  "query": { "nicho": "padaria", "cidade": "Curitiba, PR", "raio_km": 10 },
  "total_encontrados": 87,
  "total_sem_site": 42,
  "leads": [
    {
      "nome": "Padaria Exemplo",
      "endereco": "Rua X, 123",
      "telefone": "+55 41 9999-0000",
      "rating": 4.6,
      "reviews": 128,
      "tem_site": false,
      "categoria": "padaria",
      "score": 95
    }
  ]
}
```

**Arquivo 2** — `default_working_dir/leads/[timestamp]-leads.csv`:

```csv
nome,endereco,telefone,rating,reviews,score,nicho,cidade
Padaria Exemplo,"Rua X, 123",+55 41 9999-0000,4.6,128,95,padaria,Curitiba/PR
```

**Arquivo 3** — atualizar `default_working_dir/pipeline-state.json`:

```json
{
  "last_updated": "2026-05-16T20:00:00Z",
  "agent1_completed": true,
  "top_lead": {
    "nome": "Padaria Exemplo",
    "score": 95,
    "nicho": "padaria",
    "cidade": "Curitiba, PR",
    "telefone": "+55 41 9999-0000",
    "rating": 4.6,
    "reviews": 128,
    "endereco": "Rua X, 123"
  },
  "total_leads": 42,
  "leads_file": "default_working_dir/leads/2026-05-16-padaria-curitiba.json"
}
```

`top_lead` = entrada com maior `score`. Empate → maior `reviews`.

## Regras

- NUNCA inventar dados. Se um campo não existe no resultado real → `null`.
- NUNCA marcar `tem_site: false` sem confirmar (checar campo "Website" do listing).
- Limitar a `quantidade` leads no output JSON (default 30).
- Slugificar `cidade` para nome de arquivo: lowercase, `/` → `-`, espaços → `-`.

## Handoff para Agent 2

Ao concluir, Agent 2 lerá `pipeline-state.json` e usará `top_lead` automaticamente.
Não precisa notificar manualmente.

## Falhas comuns e como tratar

| Falha                                | Ação                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `web_search` retorna 0 resultados    | Tentar query alternativa sem operadores                                   |
| Rate limit Google Maps               | Aguardar 60s, retry 1x; senão usar `web_search`                           |
| Empresa tem site mas Maps não mostra | Tentar `site:[dominio-empresa]` no web_search; se confirma site → excluir |
| Telefone formato sujo                | Normalizar: `+55 DD NNNNN-NNNN` (BR), `+1 (NNN) NNN-NNNN` (US)            |
