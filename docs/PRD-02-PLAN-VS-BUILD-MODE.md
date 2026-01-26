# PRD-02: Modo Plan vs Build

## Resumo
Implementar dois modos de operação distintos: **Plan** para análise e planejamento sem alterações de código, e **Build** para implementação efetiva das correções.

## Contexto
O cwralph separa o processo em duas fases:
1. **Plan**: Claude analisa o problema, estuda o codebase e documenta a estratégia
2. **Build**: Claude implementa a correção seguindo o plano

Esta separação permite revisão humana antes de alterações no código.

## Objetivos
1. Permitir escolha entre modo Plan e Build na UI
2. Em Plan, Claude apenas analisa e documenta (não altera código)
3. Em Build, Claude implementa, testa e commita
4. Transição fluida de Plan para Build

## Requisitos Funcionais

### RF-01: Seleção de Modo na UI
- Toggle ou dropdown para selecionar modo
- Visual claro indicando modo atual
- Modo padrão: Build (para retrocompatibilidade)

### RF-02: Modo Plan
- Claude recebe prompt específico para planejamento
- Proibido fazer alterações de código
- Deve documentar:
  - Arquivos a serem modificados
  - Abordagem proposta
  - Riscos identificados
  - Estratégia de testes
- Gera arquivo `IMPLEMENTATION_PLAN.md` no diretório de trabalho
- Completion marker: `<promise>PLAN_COMPLETE</promise>`

### RF-03: Modo Build
- Claude recebe prompt para implementação
- Deve:
  - Ler PRD e progress.txt
  - Implementar a correção
  - Rodar lint/build
  - Rodar testes
  - Commitar alterações
  - Atualizar progress.txt
- Completion marker: `<promise>COMPLETE</promise>`

### RF-04: Workflow Plan → Build
- Após Plan completo, botão "Execute Build" aparece
- Build usa o IMPLEMENTATION_PLAN.md como contexto adicional
- UI mostra claramente a transição

### RF-05: Indicadores Visuais
- Badge de modo no header do ProcessingQueue
- Cor diferente para cada modo (ex: azul=Plan, verde=Build)
- Ícone específico (📋 Plan, 🔨 Build)

## Design da UI

### Seleção de Modo (antes de processar)
```
┌─────────────────────────────────────────────────┐
│ Processing Options                              │
├─────────────────────────────────────────────────┤
│ Mode:  [📋 Plan] [🔨 Build (active)]           │
│                                                 │
│ Plan: Analyze only, no code changes             │
│ Build: Implement, test, and commit              │
└─────────────────────────────────────────────────┘
```

### Durante Processamento
```
┌─────────────────────────────────────────────────┐
│ 🔨 BUILD MODE           Loop 2 of 10           │
├─────────────────────────────────────────────────┤
│ Issue: Fix authentication bypass               │
│ Status: Implementing fix...                     │
│                                                 │
│ [Activity Feed...]                              │
└─────────────────────────────────────────────────┘
```

### Após Plan Completo
```
┌─────────────────────────────────────────────────┐
│ ✅ PLAN COMPLETE                                │
├─────────────────────────────────────────────────┤
│ Plan saved to: .ralph-work/IMPLEMENTATION_PLAN.md │
│                                                 │
│ Summary:                                        │
│ • 3 files to modify                             │
│ • Estimated complexity: Medium                  │
│                                                 │
│ [View Plan]  [Execute Build →]                  │
└─────────────────────────────────────────────────┘
```

## Tipos TypeScript

```typescript
type ProcessingMode = 'plan' | 'build';

interface ProcessingOptions {
  mode: ProcessingMode;
  model: 'sonnet' | 'opus';
  maxIterations: number;
  autoPush: boolean;
}

interface PlanResult {
  planFile: string;
  filesToModify: string[];
  approach: string;
  risks: string[];
  testStrategy: string;
}
```

## Prompts

### Plan Mode Prompt
```
You are a senior engineer PLANNING a fix. DO NOT implement anything yet.

@PRD.md
@progress.txt

PLANNING INSTRUCTIONS:
1. Read the PRD carefully
2. Study the codebase to understand the architecture
3. Identify all files that need to be modified
4. Document your plan in IMPLEMENTATION_PLAN.md with:
   - Files to modify
   - Approach to take
   - Potential risks
   - Test strategy
5. When planning is COMPLETE, output: <promise>PLAN_COMPLETE</promise>

IMPORTANT: Do NOT make any code changes. Only analyze and plan.
```

### Build Mode Prompt
```
You are a senior engineer fixing an issue.

@PRD.md
@progress.txt
@IMPLEMENTATION_PLAN.md (if exists)

BUILD INSTRUCTIONS:
1. Read the PRD and plan carefully
2. Read the progress file to understand what has been tried
3. Locate and fix the issue
4. Run appropriate linting/build commands to verify
5. Run tests if they exist
6. Commit your changes with an appropriate message
7. Update the progress file with what you did
8. If the fix is COMPLETE and verified, output: <promise>COMPLETE</promise>

DO NOT output COMPLETE if there are still errors or the fix is partial.
```

## Critérios de Aceitação
- [ ] Toggle de modo funciona na UI
- [ ] Plan mode não altera código
- [ ] Plan mode gera IMPLEMENTATION_PLAN.md
- [ ] Build mode implementa e commita
- [ ] Transição Plan → Build funciona
- [ ] Indicadores visuais claros para cada modo
- [ ] Modo é passado corretamente para ralph-engine.sh
