# PRD-10: Multi-Repo Support & Linear Integration

## Visão Geral

Habilitar o meta-ralph a processar issues que requerem trabalho em repositórios diferentes do atual, com foco inicial na integração com Linear para issues como registro de repos no Capidex.

## Problema

Atualmente o meta-ralph assume que todas as issues serão resolvidas no repositório onde ele está rodando. Porém, existem casos onde:

1. Uma issue do Linear pede para "registrar repo X no Capidex" → precisa clonar `cloudwalk/capidex`
2. Uma issue referencia múltiplos repos → precisa de contexto de vários lugares
3. O usuário quer processar issues de diferentes projetos sem reiniciar o meta-ralph

### Exemplo Real (Linear Issue)
```
"Registrar o repositório shylock-agent no Capidex"

→ target_repo: cloudwalk/capidex (onde fazer a mudança)
→ context_repo: cloudwalk/shylock-agent (referência para dados)
→ action: adicionar ao JSON de configuração seguindo o README
```

## Objetivos

1. **Backward Compatible**: Providers existentes (Sentry, ZeroPath, Codecov) continuam funcionando sem mudanças
2. **Workspace Management**: Sistema para clonar/gerenciar repos automaticamente
3. **Issue Parser**: Extrair repos envolvidos de issues em linguagem natural
4. **Linear Provider**: Novo provider para buscar issues do Linear

## Não-Objetivos

- Suporte a múltiplos orgs do GitHub simultaneamente (fase futura)
- UI para gerenciar workspaces manualmente (fase futura)
- Migração dos providers existentes para multi-repo (opcional)

---

## Arquitetura

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    ISSUE (Linear/GitHub)                    │
│  "Registrar shylock-agent no Capidex"                       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ISSUE PARSER                             │
│  Extrai via Claude:                                         │
│  - target_repo: "cloudwalk/capidex"                         │
│  - context_repos: ["cloudwalk/shylock-agent"]               │
│  - action: "register_repo"                                  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  WORKSPACE MANAGER                          │
│  ~/.meta-ralph/workspaces/                                  │
│  ├── cloudwalk_capidex/         (clonado)                   │
│  └── cloudwalk_shylock-agent/   (clonado para contexto)     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE EXECUTION                         │
│  cd ~/.meta-ralph/workspaces/cloudwalk_capidex              │
│  claude "Registre shylock-agent seguindo o README..."       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      PR CREATION                            │
│  gh pr create no repo cloudwalk/capidex                     │
└─────────────────────────────────────────────────────────────┘
```

### Schema Estendido da Issue

```typescript
interface MultiRepoIssue extends Issue {
  // Campos existentes (backward compatible)
  id: string;
  provider: string;
  title: string;
  description: string;
  // ...

  // Novos campos (opcionais)
  target_repo?: {
    org: string;
    name: string;
    full_name: string;      // "cloudwalk/capidex"
    clone_url?: string;     // override se não for github.com
  };

  context_repos?: Array<{
    org: string;
    name: string;
    full_name: string;
    purpose: string;        // "reference", "data_source", etc.
  }>;

  parsed_action?: {
    type: "register" | "fix" | "update" | "create" | "migrate";
    description: string;
    files_hint?: string[];  // arquivos prováveis a modificar
  };
}
```

---

## Componentes

### 1. Workspace Manager (`lib/workspace-manager.sh`)

Gerencia clones de repositórios em um workspace centralizado.

```bash
WORKSPACE_ROOT="${META_RALPH_WORKSPACE:-$HOME/.meta-ralph/workspaces}"

# Garante que o repo existe localmente (clone ou pull)
ensure_repo() {
  local full_name="$1"  # org/repo
  local repo_path="$WORKSPACE_ROOT/${full_name//\//_}"

  if [[ -d "$repo_path/.git" ]]; then
    echo "Updating $full_name..." >&2
    git -C "$repo_path" fetch origin
    git -C "$repo_path" checkout main 2>/dev/null || git -C "$repo_path" checkout master
    git -C "$repo_path" pull --ff-only
  else
    echo "Cloning $full_name..." >&2
    mkdir -p "$WORKSPACE_ROOT"
    git clone "git@github.com:${full_name}.git" "$repo_path"
  fi

  echo "$repo_path"
}

# Retorna o path local de um repo
get_repo_path() {
  local full_name="$1"
  echo "$WORKSPACE_ROOT/${full_name//\//_}"
}

# Lista todos os repos no workspace
list_workspace_repos() {
  ls -1 "$WORKSPACE_ROOT" 2>/dev/null | sed 's/_/\//g'
}

# Remove repos não usados há N dias
cleanup_workspace() {
  local days="${1:-30}"
  find "$WORKSPACE_ROOT" -maxdepth 1 -type d -mtime "+$days" -exec rm -rf {} \;
}

# Verifica se um repo existe no workspace
repo_exists() {
  local full_name="$1"
  local repo_path="$WORKSPACE_ROOT/${full_name//\//_}"
  [[ -d "$repo_path/.git" ]]
}
```

### 2. Issue Parser (`lib/issue-parser.sh`)

Usa Claude para extrair informações de repositórios de issues em linguagem natural.

```bash
# Parseia uma issue e extrai repos envolvidos
parse_issue_repos() {
  local issue_json="$1"
  local description=$(echo "$issue_json" | jq -r '.description // .title')

  # Usa Claude para extrair estruturadamente
  local result=$(claude --print "
Analise esta issue e extraia informações sobre repositórios.

ISSUE:
$description

Retorne APENAS um JSON válido (sem markdown, sem explicação):
{
  \"target_repo\": \"org/repo onde fazer a mudança\" ou null,
  \"context_repos\": [\"org/repo para referência\"] ou [],
  \"action\": {
    \"type\": \"register|fix|update|create|migrate\",
    \"description\": \"descrição curta da ação\"
  }
}

Se não houver repo externo mencionado, retorne target_repo: null.
Se houver menção a um repo mas não estiver claro onde fazer a mudança,
coloque em context_repos.
")

  # Valida JSON
  if echo "$result" | jq -e '.' > /dev/null 2>&1; then
    echo "$result"
  else
    # Fallback: sem repos externos
    echo '{"target_repo": null, "context_repos": [], "action": null}'
  fi
}

# Enriquece uma issue com informações de repos
enrich_issue_with_repos() {
  local issue_json="$1"
  local repos_info=$(parse_issue_repos "$issue_json")

  echo "$issue_json" | jq --argjson repos "$repos_info" '. + {
    target_repo: $repos.target_repo,
    context_repos: $repos.context_repos,
    parsed_action: $repos.action
  }'
}
```

### 3. Linear Provider (`providers/linear/provider.sh`)

Novo provider para buscar issues do Linear.

```bash
#!/bin/bash
PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"
source "$RALPH_DIR/lib/issue-parser.sh"

provider_name() {
  echo "linear"
}

provider_fetch() {
  local team_id="${LINEAR_TEAM_ID:-}"
  local states="${LINEAR_STATES:-Todo,In Progress}"

  # GraphQL query
  local query='
  query($teamId: String!) {
    team(id: $teamId) {
      issues(filter: { state: { name: { in: ["Todo", "In Progress"] } } }) {
        nodes {
          id
          identifier
          title
          description
          priority
          url
          state { name }
          labels { nodes { name } }
          assignee { name email }
          createdAt
          updatedAt
        }
      }
    }
  }'

  local response=$(curl -s -X POST "https://api.linear.app/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "{\"query\": \"$(echo "$query" | tr '\n' ' ')\", \"variables\": {\"teamId\": \"$team_id\"}}")

  # Normaliza para formato comum
  local issues=$(echo "$response" | jq '[.data.team.issues.nodes[] | {
    id: .id,
    short_id: .identifier,
    provider: "linear",
    title: .title,
    description: .description,
    location: .state.name,
    severity: (
      if .priority == 1 then "CRITICAL"
      elif .priority == 2 then "HIGH"
      elif .priority == 3 then "MEDIUM"
      else "LOW"
      end
    ),
    raw_severity: .priority,
    count: 1,
    priority: (
      if .priority == 1 then 95
      elif .priority == 2 then 75
      elif .priority == 3 then 50
      else 25
      end
    ),
    permalink: .url,
    metadata: {
      state: .state.name,
      labels: [.labels.nodes[].name],
      assignee: .assignee.name,
      createdAt: .createdAt
    }
  }]')

  # Enriquece cada issue com info de repos (para issues que mencionam repos externos)
  echo "$issues" | jq -c '.[]' | while read -r issue; do
    enrich_issue_with_repos "$issue"
  done | jq -s '.'
}

provider_gen_prd() {
  local issue_json="$1"

  local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
  local title=$(echo "$issue_json" | jq -r '.title')
  local description=$(echo "$issue_json" | jq -r '.description // ""')
  local target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // "current"')
  local context_repos=$(echo "$issue_json" | jq -r '.context_repos[]?.full_name // empty' | tr '\n' ', ')
  local action_type=$(echo "$issue_json" | jq -r '.parsed_action.type // "fix"')
  local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')

  cat << EOF
# Task PRD - $issue_id

## Overview
**Issue ID:** $issue_id
**Provider:** Linear
**Target Repository:** $target_repo
**Context Repositories:** ${context_repos:-none}
**Action Type:** $action_type
**Linear Link:** $permalink

## Task Description
$title

## Details
$description

## Requirements

### Must Have
- [ ] Complete the task as described
- [ ] Ensure changes are correct and complete
- [ ] Code must pass linting/build checks
- [ ] Commit with descriptive message

### Must NOT Do
- [ ] Do NOT make unrelated changes
- [ ] Do NOT break existing functionality

## Instructions for AI Agent
1. Read and understand the task
2. If target_repo is specified, you are working in that repository
3. If context_repos exist, use them for reference data
4. Implement the required changes
5. Run appropriate build/lint commands for the project type
6. Commit: \`${action_type}: ${title:0:50}\`
7. When complete, output: <promise>COMPLETE</promise>
EOF
}

provider_branch_name() {
  local issue_json="$1"
  local short_id=$(echo "$issue_json" | jq -r '.short_id // .id')
  local safe_id=$(echo "$short_id" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
  echo "task/linear-$safe_id"
}

provider_pr_body() {
  local issue_json="$1"

  local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
  local title=$(echo "$issue_json" | jq -r '.title')
  local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
  local action_type=$(echo "$issue_json" | jq -r '.parsed_action.type // "task"')

  cat << EOF
## $action_type - Linear Issue

**Issue ID:** $issue_id
**Linear:** $permalink

### Description
$title

### Changes
This PR addresses the task from Linear.

### Testing
- [ ] Changes reviewed
- [ ] Build passes
- [ ] Manual verification complete

---
*This PR was automatically generated by Meta-Ralph (Linear provider)*
EOF
}
```

### 4. Modificação no Ralph Engine (`lib/ralph-engine.sh`)

Adicionar suporte a multi-repo no `process_issue()`:

```bash
# No início do process_issue(), ANTES do código existente:
process_issue() {
  local issue_json="$1"
  # ... outros parâmetros ...

  # ============ MULTI-REPO SUPPORT (NOVO) ============
  local target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // empty')

  if [[ -n "$target_repo" ]]; then
    echo -e "${YELLOW}Multi-repo issue detected: $target_repo${NC}"

    # Carrega workspace manager
    source "$SCRIPT_DIR/lib/workspace-manager.sh"

    # Garante que o repo alvo está clonado
    local repo_path=$(ensure_repo "$target_repo")

    # Clona context repos também (para referência)
    echo "$issue_json" | jq -r '.context_repos[]?.full_name // empty' | while read -r ctx_repo; do
      if [[ -n "$ctx_repo" ]]; then
        echo -e "${YELLOW}Cloning context repo: $ctx_repo${NC}"
        ensure_repo "$ctx_repo" > /dev/null
      fi
    done

    # Override TARGET_REPO para o resto do processamento
    export TARGET_REPO="$repo_path"
    echo -e "${GREEN}Working directory: $TARGET_REPO${NC}"
  fi
  # ============ FIM MULTI-REPO SUPPORT ============

  # ... resto do código existente (que já usa TARGET_REPO) ...
}
```

---

## Configuração

### Novas variáveis em `.env`

```bash
# Linear Integration
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx
LINEAR_TEAM_ID=TEAM-123
LINEAR_STATES=Todo,In Progress    # Estados para buscar

# Workspace Management
META_RALPH_WORKSPACE=$HOME/.meta-ralph/workspaces
WORKSPACE_CLEANUP_DAYS=30         # Limpar repos não usados
```

### Adições ao `config.sh`

```bash
# Linear
export LINEAR_API_KEY="${LINEAR_API_KEY:-}"
export LINEAR_TEAM_ID="${LINEAR_TEAM_ID:-}"
export LINEAR_STATES="${LINEAR_STATES:-Todo,In Progress}"

# Workspace
export META_RALPH_WORKSPACE="${META_RALPH_WORKSPACE:-$HOME/.meta-ralph/workspaces}"
export WORKSPACE_CLEANUP_DAYS="${WORKSPACE_CLEANUP_DAYS:-30}"

# Priority weights for Linear
export PRIORITY_LINEAR_URGENT="${PRIORITY_LINEAR_URGENT:-95}"
export PRIORITY_LINEAR_HIGH="${PRIORITY_LINEAR_HIGH:-75}"
export PRIORITY_LINEAR_MEDIUM="${PRIORITY_LINEAR_MEDIUM:-50}"
export PRIORITY_LINEAR_LOW="${PRIORITY_LINEAR_LOW:-25}"
```

---

## UI Changes

### Nova coluna na IssueTable

```typescript
// Adicionar coluna "Repo" quando issue tem target_repo
{
  header: 'Repo',
  cell: (issue) => issue.target_repo?.full_name || 'local',
  visible: issues.some(i => i.target_repo)
}
```

### Badge de Repo Externo

```typescript
// Mostrar badge quando issue vai trabalhar em outro repo
{issue.target_repo && (
  <Badge variant="outline" className="text-xs">
    📦 {issue.target_repo.name}
  </Badge>
)}
```

### Filtro por Repositório

```typescript
// Adicionar filtro na FilterBar
const repoFilter = useMemo(() => {
  const repos = new Set(issues.map(i => i.target_repo?.full_name || 'local'));
  return Array.from(repos);
}, [issues]);
```

---

## Backward Compatibility

| Aspecto | Impacto | Garantia |
|---------|---------|----------|
| Schema da Issue | `target_repo` é opcional | Issues sem campo = comportamento atual |
| Providers existentes | Nenhuma mudança necessária | Não setam `target_repo` |
| ralph-engine.sh | Mudança aditiva | `if target_repo` só executa se campo existir |
| UI | Badge só aparece se campo existir | Condicional no render |

**Prova de backward compatibility:**
```bash
# Issue SEM target_repo (providers atuais)
{
  "id": "123",
  "provider": "sentry",
  "title": "Error in foo.rs"
  # Sem target_repo → usa diretório atual
}

# Issue COM target_repo (Linear)
{
  "id": "456",
  "provider": "linear",
  "title": "Register shylock in capidex",
  "target_repo": { "full_name": "cloudwalk/capidex" }
  # Com target_repo → clona e usa esse repo
}
```

---

## Fases de Implementação

### Fase 1: Workspace Manager (Core)
**Prioridade:** Alta
**Estimativa:** 1 dia

- [ ] Criar `lib/workspace-manager.sh`
- [ ] Implementar `ensure_repo()`, `get_repo_path()`, `cleanup_workspace()`
- [ ] Testes manuais de clone/pull
- [ ] Documentação de uso

### Fase 2: Issue Parser
**Prioridade:** Alta
**Estimativa:** 1 dia

- [ ] Criar `lib/issue-parser.sh`
- [ ] Implementar `parse_issue_repos()` com Claude
- [ ] Implementar `enrich_issue_with_repos()`
- [ ] Testes com issues reais

### Fase 3: Linear Provider
**Prioridade:** Alta
**Estimativa:** 1-2 dias

- [ ] Criar `providers/linear/provider.sh`
- [ ] Implementar GraphQL queries
- [ ] Integrar com issue parser
- [ ] Testes end-to-end

### Fase 4: Engine Integration
**Prioridade:** Alta
**Estimativa:** 0.5 dia

- [ ] Modificar `process_issue()` em `ralph-engine.sh`
- [ ] Testar com issue multi-repo real
- [ ] Verificar PR é criado no repo correto

### Fase 5: UI Updates
**Prioridade:** Média
**Estimativa:** 0.5 dia

- [ ] Adicionar coluna/badge de repo
- [ ] Adicionar filtro por repo
- [ ] Testar visualização

---

## Critérios de Sucesso

### Funcional
- [ ] Issue do Linear "registrar X no Capidex" → PR criado no Capidex
- [ ] Providers existentes continuam funcionando sem mudanças
- [ ] Clone de repos funciona com SSH keys existentes
- [ ] Cleanup de workspace funciona

### Performance
- [ ] Clone de repo < 30 segundos (repos médios)
- [ ] Parser de issue < 5 segundos
- [ ] Não bloqueia UI durante clone

### UX
- [ ] Claro qual repo será modificado antes de processar
- [ ] Logs mostram em qual repo está trabalhando
- [ ] Erro claro se clone falhar (permissão, repo não existe)

---

## Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| SSH keys não configuradas | Alto | Média | Docs claros, mensagem de erro útil |
| Parser extrai repo errado | Alto | Média | Confirmação na UI antes de processar |
| Disco cheio de clones | Médio | Baixa | Cleanup automático, limite de repos |
| Rate limit do Linear | Baixo | Baixa | Cache, backoff exponencial |
| Repo privado sem acesso | Alto | Média | Verificar acesso antes de processar |

---

## Dependências

- **GitHub CLI (`gh`)**: Já usado, necessário para PRs
- **Git SSH**: Necessário para clone de repos privados
- **Linear API Key**: Nova dependência para o provider
- **jq**: Já usado para JSON parsing

---

## Próximos Passos

1. Aprovar este PRD
2. Começar Fase 1 (Workspace Manager)
3. Testar com repo público primeiro
4. Integrar Linear e testar end-to-end
5. Deploy e documentação
