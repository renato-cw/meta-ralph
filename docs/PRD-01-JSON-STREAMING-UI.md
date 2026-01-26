# PRD-01: JSON Streaming e Visualização de Atividades em Tempo Real

## Resumo
Implementar um sistema de visualização em tempo real das ações do Claude durante o processamento de issues, utilizando o output JSON estruturado do Claude Code.

## Contexto
Atualmente, os logs de processamento são exibidos como texto plano, dificultando o acompanhamento do progresso. O cwralph utiliza `--output-format=stream-json` para obter eventos estruturados que permitem uma visualização rica e em tempo real.

## Objetivos
1. Capturar eventos JSON estruturados do Claude Code
2. Parsear e exibir ações em tempo real na UI
3. Mostrar ferramentas sendo usadas (Read, Write, Bash, Task, etc.)
4. Exibir custo e duração ao final de cada iteração

## Requisitos Funcionais

### RF-01: Parser de Eventos JSON
- O backend deve parsear eventos JSON do Claude Code
- Tipos de eventos a capturar:
  - `content_block_start` (tool_use) → ferramenta iniciada
  - `content_block_delta` (input_json_delta) → parâmetros da ferramenta
  - `result` → resultado final com custo/duração
  - `assistant` → mensagens de texto do Claude
  - `error` → erros durante execução

### RF-02: Activity Feed na UI
- Componente `ActivityFeed` que mostra ações em tempo real
- Cada ação deve ter:
  - Ícone identificando a ferramenta (🔍 Read, ✏️ Write, ⚡ Bash, etc.)
  - Cor específica por tipo de ação
  - Detalhes relevantes (nome do arquivo, comando, etc.)
  - Timestamp

### RF-03: Indicadores de Progresso
- Spinner animado durante processamento
- Contador de iterações (Loop 1 of 10)
- Status atual (Reading files, Writing code, Running tests)

### RF-04: Métricas de Execução
- Exibir custo em USD ao final de cada iteração
- Exibir duração em segundos
- Acumular totais para a sessão completa

## Requisitos Não-Funcionais

### RNF-01: Performance
- Updates na UI devem ser throttled (máx 10/segundo)
- Não bloquear a UI durante streaming

### RNF-02: UX
- Auto-scroll suave para novas atividades
- Opção de pausar auto-scroll
- Expandir/colapsar detalhes das ações

## Design da UI

```
┌─────────────────────────────────────────────────┐
│ 🔄 LOOP 2 of 10                    Cost: $0.03  │
├─────────────────────────────────────────────────┤
│ ▶ Activity Feed                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔍 Read     → src/components/Button.tsx     │ │
│ │ 🔍 Read     → src/lib/utils.ts              │ │
│ │ ✏️  Edit     → src/components/Button.tsx     │ │
│ │ ⚡ Bash     → npm run lint                   │ │
│ │ ✅ Success  → Lint passed                    │ │
│ │ 💬 Claude   → "Fixed the type error..."     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📊 Session: $0.15 total | 45s elapsed           │
└─────────────────────────────────────────────────┘
```

## Tipos TypeScript

```typescript
// Tipos de eventos do Claude
type ClaudeEventType =
  | 'assistant'
  | 'content_block_start'
  | 'content_block_delta'
  | 'result'
  | 'error'
  | 'system';

// Atividade parseada para exibição
interface Activity {
  id: string;
  timestamp: string;
  type: 'tool' | 'message' | 'result' | 'error';
  tool?: 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'Task' | 'TodoWrite';
  details?: string;
  status?: 'pending' | 'success' | 'error';
}

// Métricas de execução
interface ExecutionMetrics {
  iteration: number;
  maxIterations: number;
  costUsd: number;
  durationMs: number;
  totalCostUsd: number;
  totalDurationMs: number;
}
```

## API

### Endpoint: SSE Stream
```
GET /api/process/stream?ids=issue1,issue2
Content-Type: text/event-stream

data: {"type": "activity", "payload": {...}}
data: {"type": "metrics", "payload": {...}}
data: {"type": "complete", "payload": {...}}
```

## Critérios de Aceitação
- [ ] Eventos JSON são parseados corretamente
- [ ] Activity feed mostra ações em tempo real
- [ ] Ícones e cores corretos por tipo de ferramenta
- [ ] Custo e duração exibidos ao final de cada iteração
- [ ] Auto-scroll funciona suavemente
- [ ] UI não trava durante streaming pesado
