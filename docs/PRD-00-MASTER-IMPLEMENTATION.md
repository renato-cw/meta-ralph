# PRD-00: Meta-Ralph Enhanced - Master Implementation Plan

## Visão Geral
Este documento é o plano mestre para implementação de todas as funcionalidades do cwralph no meta-ralph, mantendo a UI amigável e intuitiva.

## PRDs Relacionados
| PRD | Título | Prioridade | Dependências |
|-----|--------|------------|--------------|
| PRD-01 | JSON Streaming e Atividades em Tempo Real | Alta | - |
| PRD-02 | Modo Plan vs Build | Alta | PRD-01 |
| PRD-03 | Seleção de Modelo (Sonnet/Opus) | Média | PRD-01 |
| PRD-04 | Auto-Push com Feedback | Média | PRD-01 |
| PRD-05 | CI/CD Awareness | Baixa | PRD-01, PRD-04 |
| PRD-06 | Auto-Atualização IMPLEMENTATION_PLAN | Média | PRD-02 |
| PRD-07 | Processing Options UI | Alta | PRD-02, PRD-03, PRD-04 |

## Ordem de Implementação Recomendada

### Fase 1: Fundação (PRD-01)
**Objetivo**: Estabelecer a infraestrutura de streaming de eventos

1. Criar tipos TypeScript para eventos Claude
2. Implementar SSE endpoint no Next.js API
3. Criar componente ActivityFeed
4. Integrar com ProcessingQueue existente
5. Adicionar métricas (custo, duração)

**Entregáveis**:
- Activity feed funcional com eventos em tempo real
- Métricas de execução visíveis
- Parser de eventos JSON funcionando

### Fase 2: Controle de Processamento (PRD-02, PRD-03, PRD-07)
**Objetivo**: Dar controle ao usuário sobre como processar

1. Implementar toggle Plan/Build
2. Implementar seletor de modelo
3. Criar ProcessingOptionsPanel
4. Implementar sistema de presets
5. Adicionar estimativa de custo

**Entregáveis**:
- Painel de opções unificado
- Presets funcionais
- Modo Plan e Build operacionais

### Fase 3: Automação (PRD-04, PRD-06)
**Objetivo**: Automatizar tarefas repetitivas

1. Implementar auto-push
2. Implementar geração de IMPLEMENTATION_PLAN.md
3. Criar visualizador de plano na UI
4. Adicionar tracking de progresso

**Entregáveis**:
- Auto-push funcional
- Planos gerados e visualizáveis
- Checkboxes de progresso

### Fase 4: CI/CD Integration (PRD-05)
**Objetivo**: Fechar o loop com CI/CD

1. Implementar polling de GitHub checks
2. Criar CI status panel
3. Implementar detecção de falhas
4. Adicionar auto-fix de CI

**Entregáveis**:
- Status de CI na UI
- Detecção automática de falhas
- Fix automático de CI (opcional)

## Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        page.tsx                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │    IssueTable        │  │   ProcessingQueue          │  │
│  │    ├─ IssueRow       │  │   ├─ QueueHeader           │  │
│  │    └─ BulkActionBar  │  │   ├─ ActivityFeed          │  │
│  │        └─ Process ─────────│   │   ├─ ActivityItem    │  │
│  │                      │  │   │   └─ MetricsDisplay     │  │
│  └──────────────────────┘  │   ├─ CIStatusPanel         │  │
│                            │   ├─ PlanViewer            │  │
│  ┌──────────────────────┐  │   └─ QueueProgress         │  │
│  │ ProcessingOptions    │  └────────────────────────────┘  │
│  │ Panel (modal)        │                                  │
│  │ ├─ PresetSelector    │  ┌────────────────────────────┐  │
│  │ ├─ ModeToggle        │  │   ProcessingIndicator     │  │
│  │ ├─ ModelSelector     │  │   (floating)              │  │
│  │ ├─ IterationSlider   │  └────────────────────────────┘  │
│  │ ├─ OptionToggles     │                                  │
│  │ └─ CostEstimate      │                                  │
│  └──────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

## Estrutura de Arquivos

```
ui/src/
├── components/
│   ├── queue/
│   │   ├── ProcessingQueue.tsx (existente, modificar)
│   │   ├── QueueItem.tsx (existente)
│   │   ├── QueueProgress.tsx (existente)
│   │   ├── ProcessingIndicator.tsx (existente)
│   │   ├── ActivityFeed.tsx (novo)
│   │   ├── ActivityItem.tsx (novo)
│   │   ├── MetricsDisplay.tsx (novo)
│   │   ├── CIStatusPanel.tsx (novo)
│   │   └── PlanViewer.tsx (novo)
│   │
│   ├── options/
│   │   ├── ProcessingOptionsPanel.tsx (novo)
│   │   ├── PresetSelector.tsx (novo)
│   │   ├── ModeToggle.tsx (novo)
│   │   ├── ModelSelector.tsx (novo)
│   │   ├── IterationSlider.tsx (novo)
│   │   ├── CostEstimate.tsx (novo)
│   │   └── index.ts (novo)
│   │
│   └── common/
│       └── ProviderBadge.tsx (existente)
│
├── hooks/
│   ├── useProcessingStream.ts (novo)
│   ├── useActivityFeed.ts (novo)
│   ├── useCIStatus.ts (novo)
│   └── useProcessingOptions.ts (novo)
│
├── lib/
│   ├── types.ts (modificar - adicionar novos tipos)
│   ├── events.ts (novo - parser de eventos)
│   └── presets.ts (novo - definição de presets)
│
└── app/
    └── api/
        ├── process/
        │   ├── route.ts (modificar)
        │   └── stream/
        │       └── route.ts (novo - SSE endpoint)
        └── ci/
            ├── status/
            │   └── route.ts (novo)
            └── logs/
                └── route.ts (novo)
```

## Tipos Principais (Adicionar a types.ts)

```typescript
// Processing Types
export type ProcessingMode = 'plan' | 'build';
export type ModelType = 'sonnet' | 'opus';

export interface ProcessingOptions {
  mode: ProcessingMode;
  model: ModelType;
  maxIterations: number;
  autoPush: boolean;
  ciAwareness: boolean;
  autoFixCi: boolean;
}

// Activity Types
export type ActivityType = 'tool' | 'message' | 'result' | 'error' | 'push' | 'ci';
export type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'Task' | 'TodoWrite';

export interface Activity {
  id: string;
  timestamp: string;
  type: ActivityType;
  tool?: ToolName;
  details?: string;
  status?: 'pending' | 'success' | 'error';
  metadata?: Record<string, unknown>;
}

// Execution Metrics
export interface ExecutionMetrics {
  iteration: number;
  maxIterations: number;
  costUsd: number;
  durationMs: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

// CI Types
export interface CICheck {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  detailsUrl: string;
}

export interface CIStatus {
  sha: string;
  branch: string;
  checks: CICheck[];
  overallStatus: 'pending' | 'success' | 'failure';
}

// Plan Types
export interface ImplementationPlan {
  issueId: string;
  issueTitle: string;
  steps: { description: string; completed: boolean }[];
  progressPercent: number;
  rawMarkdown: string;
}
```

## Critérios de Sucesso

### Métricas de UX
- [ ] Tempo para entender opções < 30 segundos
- [ ] Clicks para processar uma issue: máximo 3
- [ ] Feedback visual para cada ação do Claude
- [ ] Custo visível antes de processar

### Métricas Técnicas
- [ ] Latência de streaming < 100ms
- [ ] UI responsiva durante processamento
- [ ] Sem memory leaks em sessões longas
- [ ] Graceful handling de erros

### Paridade com cwralph
- [ ] Modo Plan funcional
- [ ] Modo Build funcional
- [ ] Seleção de modelo
- [ ] Auto-push
- [ ] CI awareness (opcional)
- [ ] Métricas de custo/duração

## Timeline Sugerida

| Fase | Duração Estimada | Entregáveis |
|------|------------------|-------------|
| Fase 1 | 2-3 dias | Activity feed, streaming |
| Fase 2 | 2-3 dias | Options panel, presets |
| Fase 3 | 1-2 dias | Auto-push, plan viewer |
| Fase 4 | 2-3 dias | CI integration |

**Total estimado**: 7-11 dias de desenvolvimento

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Streaming pesado trava UI | Alto | Throttling, Web Workers |
| Custo alto com Opus | Médio | Warnings, estimativas |
| CI API rate limits | Médio | Caching, backoff |
| Complexidade da UI | Alto | Presets, defaults inteligentes |

## Próximos Passos
1. ✅ Criar PRDs detalhados
2. Começar Fase 1 (JSON Streaming)
3. Criar componentes base
4. Implementar API de streaming
5. Testes de integração
