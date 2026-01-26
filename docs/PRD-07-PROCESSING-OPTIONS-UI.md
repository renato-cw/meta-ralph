# PRD-07: Processing Options UI (Painel de Configuração Unificado)

## Resumo
Criar um painel de configuração unificado que agrupa todas as opções de processamento antes de iniciar: modo, modelo, auto-push, iterações máximas, e CI awareness.

## Contexto
Com a adição de múltiplas opções de processamento (modo Plan/Build, modelo Sonnet/Opus, auto-push, CI awareness), precisamos de uma UI organizada que permita configurar tudo antes de iniciar o processamento.

## Objetivos
1. Interface unificada para todas as opções
2. Presets para configurações comuns
3. Persistência de preferências
4. Validação antes de processar

## Requisitos Funcionais

### RF-01: Painel de Opções
Modal ou painel expandível que aparece antes do processamento com todas as opções configuráveis.

### RF-02: Configurações Disponíveis
1. **Mode**: Plan / Build
2. **Model**: Sonnet / Opus
3. **Max Iterations**: 1-20 (slider)
4. **Auto-Push**: On/Off
5. **CI Awareness**: On/Off
6. **Auto-Fix CI**: On/Off (se CI awareness ligado)

### RF-03: Presets
- **Quick Fix**: Build + Sonnet + 5 iter + Auto-push
- **Careful Fix**: Plan → Build + Sonnet + 10 iter
- **Complex Issue**: Build + Opus + 15 iter + CI aware
- **Security Audit**: Plan + Opus + 3 iter (apenas análise)
- **Custom**: Todas as opções manuais

### RF-04: Validação
- Avisar se Opus selecionado para issues simples
- Avisar se muitas issues selecionadas com Opus (custo)
- Confirmar antes de processar >5 issues

### RF-05: Persistência
- Salvar última configuração usada
- Salvar presets customizados
- Restaurar ao reabrir

### RF-06: Resumo de Custo Estimado
- Mostrar estimativa de custo baseado em:
  - Modelo selecionado
  - Número de issues
  - Max iterações
- Formato: "Estimated cost: ~$0.50 - $2.00"

## Design da UI

### Trigger (no BulkActionBar ou ProcessButton)
```
[Process 3 Issues ▼]
```

### Painel Expandido
```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Processing Options                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Preset: [Quick Fix ▼]                                       │
│         Quick Fix | Careful Fix | Complex | Security | Custom│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Mode                                                        │
│ ┌─────────────────┐ ┌─────────────────┐                    │
│ │ 📋 Plan         │ │ 🔨 Build ✓      │                    │
│ │ Analyze only    │ │ Implement fix   │                    │
│ └─────────────────┘ └─────────────────┘                    │
│                                                             │
│ Model                                                       │
│ ┌─────────────────┐ ┌─────────────────┐                    │
│ │ ⚡ Sonnet ✓     │ │ 🧠 Opus         │                    │
│ │ Fast, $0.003/1K │ │ Smart, $0.015/1K│                    │
│ └─────────────────┘ └─────────────────┘                    │
│                                                             │
│ Max Iterations                                              │
│ ├────────●────────────────┤ 10                             │
│                                                             │
│ Options                                                     │
│ ☑ Auto-push commits                                        │
│ ☑ CI/CD awareness                                          │
│   └─ ☐ Auto-fix CI failures                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 💰 Estimated cost: ~$0.30 - $1.20 for 3 issues             │
│                                                             │
│              [Cancel]  [🚀 Start Processing]               │
└─────────────────────────────────────────────────────────────┘
```

### Compact Mode (após configurado)
```
┌─────────────────────────────────────────────────────────────┐
│ 🔨 Build + ⚡ Sonnet | 10 iter | Auto-push ✓    [Change]   │
└─────────────────────────────────────────────────────────────┘
```

## Tipos TypeScript

```typescript
interface ProcessingOptions {
  mode: 'plan' | 'build';
  model: 'sonnet' | 'opus';
  maxIterations: number;
  autoPush: boolean;
  ciAwareness: boolean;
  autoFixCi: boolean;
}

interface ProcessingPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: ProcessingOptions;
  isCustom?: boolean;
}

const DEFAULT_PRESETS: ProcessingPreset[] = [
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    description: 'Fast fixes for simple issues',
    icon: '⚡',
    options: {
      mode: 'build',
      model: 'sonnet',
      maxIterations: 5,
      autoPush: true,
      ciAwareness: false,
      autoFixCi: false,
    },
  },
  {
    id: 'careful-fix',
    name: 'Careful Fix',
    description: 'Plan first, then implement',
    icon: '📋',
    options: {
      mode: 'plan',
      model: 'sonnet',
      maxIterations: 10,
      autoPush: true,
      ciAwareness: true,
      autoFixCi: false,
    },
  },
  {
    id: 'complex-issue',
    name: 'Complex Issue',
    description: 'For difficult bugs and security issues',
    icon: '🧠',
    options: {
      mode: 'build',
      model: 'opus',
      maxIterations: 15,
      autoPush: true,
      ciAwareness: true,
      autoFixCi: true,
    },
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Deep analysis without code changes',
    icon: '🔒',
    options: {
      mode: 'plan',
      model: 'opus',
      maxIterations: 3,
      autoPush: false,
      ciAwareness: false,
      autoFixCi: false,
    },
  },
];

// Estimativa de custo
interface CostEstimate {
  min: number;
  max: number;
  currency: 'USD';
  breakdown: {
    perIssue: number;
    perIteration: number;
  };
}

function estimateCost(
  options: ProcessingOptions,
  issueCount: number
): CostEstimate {
  const costPerToken = options.model === 'opus' ? 0.015 : 0.003;
  const avgTokensPerIteration = 5000; // estimativa
  const perIteration = costPerToken * avgTokensPerIteration / 1000;
  const perIssue = perIteration * (options.maxIterations / 2); // média

  return {
    min: perIssue * issueCount * 0.5,
    max: perIssue * issueCount * 1.5,
    currency: 'USD',
    breakdown: { perIssue, perIteration },
  };
}
```

## Componentes React

```typescript
// ProcessingOptionsPanel.tsx
interface ProcessingOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIssues: Issue[];
  onStart: (options: ProcessingOptions) => void;
}

// PresetSelector.tsx
interface PresetSelectorProps {
  presets: ProcessingPreset[];
  selectedId: string;
  onSelect: (preset: ProcessingPreset) => void;
}

// ModeToggle.tsx
interface ModeToggleProps {
  mode: 'plan' | 'build';
  onChange: (mode: 'plan' | 'build') => void;
}

// ModelSelector.tsx
interface ModelSelectorProps {
  model: 'sonnet' | 'opus';
  onChange: (model: 'sonnet' | 'opus') => void;
  suggestedModel?: 'sonnet' | 'opus';
}

// IterationSlider.tsx
interface IterationSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

// CostEstimateDisplay.tsx
interface CostEstimateDisplayProps {
  estimate: CostEstimate;
  issueCount: number;
}
```

## Integração

### Com ProcessButton
```tsx
<ProcessButton
  selectedCount={selectedIds.size}
  isProcessing={processing.isProcessing}
  onProcess={() => setOptionsOpen(true)} // Abre painel
/>

<ProcessingOptionsPanel
  isOpen={optionsOpen}
  onClose={() => setOptionsOpen(false)}
  selectedIssues={selectedIssues}
  onStart={(options) => {
    setOptionsOpen(false);
    processIssues(selectedIds, options);
  }}
/>
```

### Com API
```typescript
// POST /api/process
{
  "ids": ["issue-1", "issue-2"],
  "options": {
    "mode": "build",
    "model": "sonnet",
    "maxIterations": 10,
    "autoPush": true,
    "ciAwareness": true,
    "autoFixCi": false
  }
}
```

## Critérios de Aceitação
- [ ] Painel de opções aparece antes de processar
- [ ] Todos os toggles funcionam corretamente
- [ ] Presets aplicam configurações corretas
- [ ] Slider de iterações funcional
- [ ] Estimativa de custo exibida
- [ ] Configurações persistidas no localStorage
- [ ] Validações e avisos funcionam
- [ ] Opções passadas corretamente para API
