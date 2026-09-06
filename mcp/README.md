# Icarus MCP

Servidor MCP que permite consultar e alterar os projetos do Icarus via prompt
(Claude Code / Claude Desktop).

## Ferramentas

| Ferramenta | Faz o quê |
|---|---|
| `listar_empresas` | Empresas cadastradas + nº de projetos |
| `listar_projetos` | Projetos (filtro opcional por empresa), com fases e período |
| `listar_membros` | Equipe (para usar como responsáveis) |
| `listar_tarefas` | Tarefas de um projeto, com filtros (status, fase, responsável) |
| `buscar_tarefas` | Busca por texto no título e/ou por prazo, em todos os projetos |
| `criar_tarefa` | Cria tarefa (fase, prioridade, prazo, responsáveis…) |
| `atualizar_tarefa` | Edita status, título, prazo, fase, prioridade, responsáveis |
| `listar_documentacao` | Lê os registros de Documentação de um projeto |
| `adicionar_registro_documentacao` | Adiciona registro assinado numa seção |

Tudo que o MCP escreve aparece **na hora** no app de quem estiver com ele
aberto (Realtime por linha, Fase 2 do backend).

## Como funciona

- Autentica no Supabase como usuário normal (RLS se aplica; sem service key).
- Tarefas e documentação: leitura/escrita direto nas tabelas `tasks` /
  `doc_entries`.
- Projetos, empresas e membros: lidos do blob **somente leitura** — o MCP
  nunca escreve no blob (merge fica exclusivo do app).
- Excluir tarefa é de propósito só pelo app (lá existe a Lixeira).

## Configuração

Credenciais em `mcp/.env` (fora do git):

```
ICARUS_EMAIL=seu@email.com
ICARUS_PASSWORD=...
```

Registro no Claude (`~/.claude.json` → `mcpServers`):

```json
"icarus": { "type": "stdio", "command": "node", "args": ["/Users/paulomaia/Skills/marketflow/mcp/server.mjs"] }
```
