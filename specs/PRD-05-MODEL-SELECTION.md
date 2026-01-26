# PRD-03: Seleção de Modelo (Sonnet/Opus)

## Resumo
Permitir que o usuário escolha qual modelo Claude usar para processamento: Sonnet (rápido e econômico) ou Opus (mais capaz para tarefas complexas).

## Contexto
O cwralph permite escolher entre modelos via flag `--model`. Diferentes issues podem se beneficiar de diferentes modelos:
- **Sonnet**: Bugs simples, refatorações diretas, tarefas de coverage
- **Opus**: Issues de segurança complexas, arquitetura, bugs difíceis

## Objetivos
1. Adicionar seleção de modelo na UI
2. Exibir trade-offs (velocidade vs capacidade vs custo)
3. Sugerir modelo baseado no tipo/severidade da issue
4. Passar modelo selecionado para o engine

## Requisitos Funcionais

### RF-01: Seletor de Modelo na UI
- Dropdown ou toggle para selecionar modelo
- Opções: Sonnet (padrão), Opus
- Exibir informações de cada modelo

### RF-02: Informações do Modelo
Exibir para cada modelo:
- Nome e descrição breve
- Indicador de velocidade (⚡ Fast, 🐢 Slower)
- Indicador de custo (💰 $, 💰💰💰 $$$)
- Indicador de capacidade (🧠 Standard, 🧠🧠🧠 Advanced)

### RF-03: Sugestão Inteligente
- Para issues CRITICAL/HIGH de segurança: sugerir Opus
- Para issues de coverage/low severity: sugerir Sonnet
- Badge "Recommended" no modelo sugerido

### RF-04: Configuração Global vs Por Issue
- Configuração global afeta novos processamentos
- Possibilidade de override por issue (futuro)

### RF-05: Persistência
- Salvar preferência de modelo no localStorage
- Restaurar na próxima sessão

## Design da UI

### Seletor de Modelo
```
┌─────────────────────────────────────────────────┐
│ Model Selection                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ ○ Sonnet (Recommended)                          │
│   ⚡ Fast  |  💰 $0.003/1K tokens              │
│   Best for: Simple bugs, refactoring, coverage  │
│                                                 │
│ ● Opus                                          │
│   🐢 Slower  |  💰💰 $0.015/1K tokens          │
│   Best for: Complex security issues, architecture│
│                                                 │
└─────────────────────────────────────────────────┘
```

### Compact View (no ProcessingOptions)
```
┌─────────────────────────────────────────────────┐
│ Mode: [Plan] [Build]    Model: [Sonnet ▼]      │
└─────────────────────────────────────────────────┘
```

### Durante Processamento
```
┌─────────────────────────────────────────────────┐
│ 🔨 BUILD MODE  |  🧠 Opus           Loop 2/10  │
├─────────────────────────────────────────────────┤
```

## Tipos TypeScript

```typescript
type ModelType = 'sonnet' | 'opus';

interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  costPer1kTokens: number;
  bestFor: string[];
  icon: string;
}

const MODELS: Record<ModelType, ModelInfo> = {
  sonnet: {
    id: 'sonnet',
    name: 'Claude Sonnet',
    description: 'Fast and cost-effective',
    speed: 'fast',
    costPer1kTokens: 0.003,
    bestFor: ['Simple bugs', 'Refactoring', 'Coverage tasks'],
    icon: '⚡',
  },
  opus: {
    id: 'opus',
    name: 'Claude Opus',
    description: 'Most capable for complex tasks',
    speed: 'slow',
    costPer1kTokens: 0.015,
    bestFor: ['Security issues', 'Architecture', 'Complex debugging'],
    icon: '🧠',
  },
};

// Sugestão baseada na issue
function suggestModel(issue: Issue): ModelType {
  if (issue.provider === 'zeropath' &&
      ['CRITICAL', 'HIGH'].includes(issue.severity)) {
    return 'opus';
  }
  return 'sonnet';
}
```

## Integração com Engine

### Passagem de Parâmetro
```bash
# ralph-engine.sh recebe --model flag
ralph_fix_loop "$max_iterations" "$prd_file" "$progress_file" "$mode" "$model"

# Traduz para flag do Claude
if [[ "$model" == "opus" ]]; then
    model_flag="--model opus"
fi

# Executa com modelo selecionado
claude -p $model_flag --output-format=stream-json ...
```

### API
```typescript
// POST /api/process
{
  "ids": ["issue-1", "issue-2"],
  "options": {
    "mode": "build",
    "model": "opus",
    "maxIterations": 10
  }
}
```

## Critérios de Aceitação
- [ ] Seletor de modelo visível na UI
- [ ] Informações de cada modelo exibidas
- [ ] Sugestão inteligente baseada na issue
- [ ] Modelo selecionado é passado para o engine
- [ ] Preferência salva no localStorage
- [ ] Badge do modelo atual durante processamento
