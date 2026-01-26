# PRD-06: Auto-Atualização do IMPLEMENTATION_PLAN.md

## Resumo
Implementar geração e atualização automática de um arquivo de plano de implementação que documenta a estratégia de correção e progresso.

## Contexto
O cwralph mantém um arquivo `IMPLEMENTATION_PLAN.md` que é atualizado durante o processo de planejamento. Este arquivo serve como:
- Documentação da estratégia
- Contexto para iterações subsequentes
- Registro auditável das decisões

## Objetivos
1. Gerar IMPLEMENTATION_PLAN.md no modo Plan
2. Atualizar o plano durante o modo Build
3. Exibir conteúdo do plano na UI
4. Permitir edição manual do plano

## Requisitos Funcionais

### RF-01: Estrutura do Plano
O arquivo deve conter:
```markdown
# Implementation Plan: [Issue Title]

## Issue Summary
[Descrição da issue]

## Analysis
### Files Identified
- [ ] `src/auth.ts` - Main authentication logic
- [ ] `src/middleware/auth.ts` - Auth middleware

### Root Cause
[Análise da causa raiz]

### Proposed Solution
[Descrição da solução]

## Implementation Steps
1. [ ] Step 1: Modify auth.ts
2. [ ] Step 2: Update middleware
3. [ ] Step 3: Add tests
4. [ ] Step 4: Run lint and tests

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking existing auth | Add regression tests |

## Test Strategy
- Unit tests for new logic
- Integration tests for auth flow

## Progress Log
### Iteration 1 - [timestamp]
- Analyzed codebase
- Identified affected files

### Iteration 2 - [timestamp]
- Implemented fix in auth.ts
- Tests passing
```

### RF-02: Geração no Modo Plan
- Claude gera o plano completo durante Plan mode
- Arquivo salvo em `.ralph-work/IMPLEMENTATION_PLAN.md`
- Checkboxes para tracking de progresso

### RF-03: Atualização no Modo Build
- A cada iteração, Claude atualiza o Progress Log
- Checkboxes são marcados conforme passos completados
- Novas descobertas são adicionadas

### RF-04: Visualização na UI
- Painel lateral ou modal para ver o plano
- Renderização Markdown com syntax highlight
- Checkboxes interativos (read-only)

### RF-05: Edição Manual
- Usuário pode editar o plano antes de Build
- Edições são salvas e usadas como contexto
- Warning se plano foi modificado manualmente

## Design da UI

### Botão de Visualização
```
┌─────────────────────────────────────────────────┐
│ Issue: Fix auth bypass        [📋 View Plan]   │
└─────────────────────────────────────────────────┘
```

### Modal/Painel do Plano
```
┌─────────────────────────────────────────────────┐
│ 📋 Implementation Plan          [Edit] [Close] │
├─────────────────────────────────────────────────┤
│ # Implementation Plan: Fix auth bypass         │
│                                                 │
│ ## Files Identified                             │
│ ☑ src/auth.ts                                  │
│ ☐ src/middleware/auth.ts                       │
│ ☐ tests/auth.test.ts                           │
│                                                 │
│ ## Implementation Steps                         │
│ ☑ 1. Modify auth.ts                            │
│ ☐ 2. Update middleware                         │
│ ☐ 3. Add tests                                 │
│                                                 │
│ ## Progress Log                                 │
│ ### Iteration 1 - 2024-01-15 10:30             │
│ - Analyzed codebase structure                   │
│ - Found vulnerable endpoint                     │
│                                                 │
│ ### Iteration 2 - 2024-01-15 10:35             │
│ - Fixed auth.ts                                │
│ - Running tests...                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Indicador de Progresso
```
┌─────────────────────────────────────────────────┐
│ Plan Progress: ███████░░░ 70% (7/10 steps)     │
└─────────────────────────────────────────────────┘
```

## Tipos TypeScript

```typescript
interface ImplementationPlan {
  issueId: string;
  issueTitle: string;
  createdAt: string;
  updatedAt: string;

  analysis: {
    filesIdentified: PlanFile[];
    rootCause: string;
    proposedSolution: string;
  };

  steps: PlanStep[];
  risks: PlanRisk[];
  testStrategy: string;
  progressLog: ProgressEntry[];

  rawMarkdown: string;  // Conteúdo original
}

interface PlanFile {
  path: string;
  description: string;
  completed: boolean;
}

interface PlanStep {
  number: number;
  description: string;
  completed: boolean;
}

interface PlanRisk {
  risk: string;
  mitigation: string;
}

interface ProgressEntry {
  iteration: number;
  timestamp: string;
  notes: string[];
}
```

## Parser de Markdown

```typescript
// Parsear IMPLEMENTATION_PLAN.md para objeto estruturado
function parsePlanMarkdown(content: string): ImplementationPlan {
  const lines = content.split('\n');
  const plan: Partial<ImplementationPlan> = {
    steps: [],
    progressLog: [],
  };

  // Parser regex para checkboxes
  const checkboxRegex = /^- \[(x| )\] (.+)$/i;

  // Parser regex para arquivos
  const fileRegex = /^- \[(x| )\] `([^`]+)` - (.+)$/i;

  // ... parsing logic

  return plan as ImplementationPlan;
}
```

## Integração com Engine

```bash
# Prompt adicional para modo Plan
PLAN_INSTRUCTIONS="
Create or update IMPLEMENTATION_PLAN.md with:

## Structure Required
- Issue Summary
- Files Identified (with checkboxes)
- Root Cause Analysis
- Proposed Solution
- Implementation Steps (numbered checkboxes)
- Risks & Mitigations (table)
- Test Strategy
- Progress Log (append new entries)

## Checkbox Format
Use '- [ ]' for pending and '- [x]' for completed items.

## Progress Log Format
Add new entry with timestamp for each iteration:
### Iteration N - $(date)
- What was done
- What was discovered
"
```

## API

```typescript
// GET /api/plan/{issueId}
{
  "issueId": "issue-123",
  "exists": true,
  "plan": {
    "issueTitle": "Fix auth bypass",
    "steps": [...],
    "progress": 70,
    "rawMarkdown": "..."
  }
}

// PUT /api/plan/{issueId}
{
  "rawMarkdown": "# Updated plan..."
}
```

## Critérios de Aceitação
- [ ] IMPLEMENTATION_PLAN.md gerado no modo Plan
- [ ] Plano atualizado a cada iteração no Build
- [ ] Visualização do plano na UI
- [ ] Checkboxes renderizados corretamente
- [ ] Progress log com timestamps
- [ ] Parser de Markdown funcional
- [ ] Edição manual possível
- [ ] Indicador de progresso visual
