# PRD-04: Auto-Push com Feedback na UI

## Resumo
Implementar funcionalidade de push automático após cada commit bem-sucedido, com feedback visual na UI sobre o status do push.

## Contexto
O cwralph possui opção `--no-push` que desabilita push automático. Por padrão, após cada commit bem-sucedido, o código é automaticamente enviado para o repositório remoto. Isso permite:
- CI/CD iniciar mais rapidamente
- Colaboradores verem o progresso
- Backup automático do trabalho

## Objetivos
1. Toggle de auto-push na UI
2. Push automático após cada commit (se habilitado)
3. Feedback visual do status do push
4. Tratamento de erros de push

## Requisitos Funcionais

### RF-01: Toggle de Auto-Push
- Checkbox ou switch para habilitar/desabilitar
- Padrão: habilitado
- Tooltip explicando a funcionalidade

### RF-02: Execução do Push
- Após commit bem-sucedido, executar `git push`
- Se branch não existe no remote, usar `git push -u origin <branch>`
- Não fazer push em branches main/master (proteção)

### RF-03: Feedback Visual
- Indicador durante push ("Pushing...")
- Sucesso: "✅ Pushed to feature/fix-issue-123"
- Falha: "❌ Push failed: <mensagem>"
- Link para o commit/PR se disponível

### RF-04: Tratamento de Erros
- Falha de autenticação: instruir sobre credenciais
- Conflitos: avisar que merge é necessário
- Branch protegida: avisar sobre restrições
- Não bloquear o processamento se push falhar

### RF-05: Activity Feed Integration
- Mostrar evento de push no activity feed
- Ícone: 📤 Push
- Cor: verde (sucesso) ou vermelho (falha)

## Design da UI

### Toggle no ProcessingOptions
```
┌─────────────────────────────────────────────────┐
│ Processing Options                              │
├─────────────────────────────────────────────────┤
│ Mode:  [Plan] [Build]    Model: [Sonnet ▼]     │
│                                                 │
│ ☑ Auto-push after commits                       │
│   Automatically push changes to remote          │
└─────────────────────────────────────────────────┘
```

### Durante Push (Activity Feed)
```
│ ✅ Success  → Tests passed                      │
│ 💾 Commit   → "fix: resolve auth bypass"        │
│ 📤 Pushing  → feature/fix-auth-123...          │
```

### Push Sucesso
```
│ 📤 Pushed   → feature/fix-auth-123 ✅          │
│              View on GitHub →                   │
```

### Push Falha
```
│ 📤 Push     → ❌ Failed: Permission denied      │
│              Auto-push disabled for this run    │
```

## Tipos TypeScript

```typescript
interface PushStatus {
  status: 'idle' | 'pushing' | 'success' | 'failed';
  branch?: string;
  commitHash?: string;
  remoteUrl?: string;
  error?: string;
}

interface ProcessingOptions {
  mode: ProcessingMode;
  model: ModelType;
  maxIterations: number;
  autoPush: boolean;  // Nova opção
}

// Activity para push
interface PushActivity extends Activity {
  type: 'push';
  branch: string;
  status: 'pending' | 'success' | 'failed';
  commitHash?: string;
  error?: string;
}
```

## Lógica do Engine

```bash
# Em ralph-engine.sh

# Auto-push após sucesso
if [[ "$auto_push" == "true" && "$mode" == "build" ]]; then
    local current_branch=$(git branch --show-current 2>/dev/null || echo "")

    # Proteção: não push para main/master
    if [[ -n "$current_branch" && "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        echo -e "${BLUE}📤 Auto-pushing changes...${NC}"

        if git push origin "$current_branch" 2>/dev/null; then
            echo -e "${GREEN}✅ Pushed to $current_branch${NC}"
            # Emitir evento JSON para UI
            echo "{\"type\":\"push\",\"status\":\"success\",\"branch\":\"$current_branch\"}"
        else
            echo -e "${YELLOW}⚠️  Push failed, trying with -u flag...${NC}"
            if git push -u origin "$current_branch" 2>/dev/null; then
                echo -e "${GREEN}✅ Pushed to $current_branch (upstream set)${NC}"
            else
                echo -e "${RED}❌ Push failed${NC}"
                echo "{\"type\":\"push\",\"status\":\"failed\",\"branch\":\"$current_branch\"}"
            fi
        fi
    fi
fi
```

## API

```typescript
// POST /api/process
{
  "ids": ["issue-1"],
  "options": {
    "mode": "build",
    "model": "sonnet",
    "maxIterations": 10,
    "autoPush": true
  }
}

// SSE Event
{
  "type": "activity",
  "payload": {
    "type": "push",
    "branch": "feature/fix-auth-123",
    "status": "success",
    "commitHash": "abc123"
  }
}
```

## Critérios de Aceitação
- [ ] Toggle de auto-push na UI
- [ ] Push automático após commit (quando habilitado)
- [ ] Proteção contra push em main/master
- [ ] Feedback visual no activity feed
- [ ] Tratamento de erros de push
- [ ] Opção salva no localStorage
- [ ] Push não bloqueia processamento se falhar
