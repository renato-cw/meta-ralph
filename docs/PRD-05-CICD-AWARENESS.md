# PRD-05: CI/CD Awareness com Status de Builds

## Resumo
Implementar integração com sistemas de CI/CD (GitHub Actions, etc.) para mostrar status de builds na UI e permitir que o Claude reaja a falhas de CI.

## Contexto
O cwralph monitora o status de CI após cada push. Se o CI falha, Claude pode reagir automaticamente, tentando corrigir o problema. Isso cria um loop de feedback completo:

```
Push → CI Run → CI Fail → Claude Fix → Push → CI Run → CI Pass
```

## Objetivos
1. Mostrar status de builds/checks na UI
2. Detectar falhas de CI automaticamente
3. Permitir que Claude reaja a falhas de CI
4. Exibir logs de CI relevantes

## Requisitos Funcionais

### RF-01: Consulta de Status de CI
- Após push, consultar status dos checks via GitHub API
- Endpoints: `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`
- Polling a cada 30 segundos durante processamento ativo

### RF-02: Exibição de Status na UI
- Badge de status: 🟡 Pending, ✅ Passed, ❌ Failed, ⏳ Running
- Nome do workflow/check
- Link para visualização no GitHub
- Tempo de execução

### RF-03: Detecção de Falha
- Monitorar checks até conclusão
- Ao detectar falha, notificar na UI
- Opção de "Fix CI" para acionar Claude

### RF-04: Fix CI Automático
- Extrair logs de falha do CI
- Passar logs para Claude como contexto
- Claude tenta corrigir e faz novo push

### RF-05: CI Status no Activity Feed
- Eventos de CI no feed de atividades
- 🔄 CI Running → workflow iniciou
- ✅ CI Passed → workflow passou
- ❌ CI Failed → workflow falhou (com link)

## Design da UI

### CI Status Panel
```
┌─────────────────────────────────────────────────┐
│ 🔄 CI/CD Status                                │
├─────────────────────────────────────────────────┤
│ Branch: feature/fix-auth-123                    │
│                                                 │
│ ⏳ lint-and-test          Running... (2m 34s)  │
│ ✅ security-scan          Passed (1m 12s)       │
│ 🟡 deploy-preview         Waiting...           │
│                                                 │
│                      [View on GitHub]           │
└─────────────────────────────────────────────────┘
```

### CI Failed State
```
┌─────────────────────────────────────────────────┐
│ ❌ CI FAILED                                    │
├─────────────────────────────────────────────────┤
│ ❌ lint-and-test          Failed (3m 45s)      │
│                                                 │
│ Error: Type error in src/auth.ts:42            │
│ > Property 'user' does not exist on type...    │
│                                                 │
│ [View Full Logs]  [🔧 Auto-Fix CI]             │
└─────────────────────────────────────────────────┘
```

### Activity Feed com CI
```
│ 📤 Pushed   → feature/fix-auth-123 ✅          │
│ 🔄 CI       → lint-and-test started            │
│ 🔄 CI       → security-scan started            │
│ ✅ CI       → security-scan passed (1m 12s)    │
│ ❌ CI       → lint-and-test failed             │
│              → "Type error in src/auth.ts"     │
│ 🔧 Fix CI   → Analyzing failure...             │
```

## Tipos TypeScript

```typescript
interface CICheck {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral';
  startedAt?: string;
  completedAt?: string;
  detailsUrl: string;
  output?: {
    title?: string;
    summary?: string;
    text?: string;
  };
}

interface CIStatus {
  sha: string;
  branch: string;
  checks: CICheck[];
  overallStatus: 'pending' | 'success' | 'failure' | 'mixed';
  lastUpdated: string;
}

interface CIFailure {
  checkName: string;
  errorSummary: string;
  logs?: string;
  fixable: boolean;
}

// Configuração de CI awareness
interface CIConfig {
  enabled: boolean;
  autoFix: boolean;  // Auto-fix on CI failure
  pollInterval: number;  // ms
  maxWaitTime: number;  // ms
}
```

## API

### GitHub Check Runs
```typescript
// GET /api/ci/status?sha=abc123&owner=user&repo=project
{
  "sha": "abc123",
  "branch": "feature/fix-auth",
  "checks": [
    {
      "id": "12345",
      "name": "lint-and-test",
      "status": "completed",
      "conclusion": "failure",
      "detailsUrl": "https://github.com/...",
      "output": {
        "summary": "Type error in src/auth.ts:42"
      }
    }
  ],
  "overallStatus": "failure"
}
```

### CI Logs
```typescript
// GET /api/ci/logs?checkId=12345
{
  "logs": "npm run lint\n> Error: Type error...\n..."
}
```

### Trigger Fix
```typescript
// POST /api/ci/fix
{
  "issueId": "issue-123",
  "checkId": "12345",
  "context": "CI failed with type error..."
}
```

## Integração com Engine

```bash
# Polling de CI status
check_ci_status() {
    local sha="$1"
    local max_wait=600  # 10 minutos

    while true; do
        local status=$(gh api "repos/$GITHUB_OWNER/$GITHUB_REPO/commits/$sha/check-runs" \
            --jq '.check_runs | map({name, status, conclusion}) | tostring')

        echo "{\"type\":\"ci_status\",\"payload\":$status}"

        # Verificar se todos completaram
        if echo "$status" | jq -e 'all(.status == "completed")' >/dev/null; then
            # Verificar se algum falhou
            if echo "$status" | jq -e 'any(.conclusion == "failure")' >/dev/null; then
                echo "{\"type\":\"ci_failure\",\"payload\":$status}"
                return 1
            fi
            return 0
        fi

        sleep 30
    done
}
```

## Critérios de Aceitação
- [ ] Status de CI exibido na UI após push
- [ ] Polling automático durante processamento
- [ ] Detecção de falhas de CI
- [ ] Exibição de erro/summary da falha
- [ ] Link para logs completos no GitHub
- [ ] Botão "Fix CI" que aciona correção
- [ ] Eventos de CI no activity feed
- [ ] Configuração para habilitar/desabilitar
