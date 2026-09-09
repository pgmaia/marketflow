import type { TaskTemplate, TemplateTask, FlowLane, FlowNode, FlowEdge } from '../types';

export interface FlowStruct { lanes: FlowLane[]; nodes: FlowNode[]; edges: FlowEdge[] }

const PALETTE = ['#1f6feb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899'];

/** Reconstrói o DESENHO de um template de fluxo (faixas, blocos e setas).
 *
 *  1. Template salvo a partir de um fluxo carrega o desenho inteiro — é ele
 *     que volta, com ids novos e posições normalizadas.
 *  2. Template antigo/da Lista sem o desenho, mas com ETAPA nas tarefas:
 *     reconstrói blocos por etapa e faixas por fase.
 *  3. Sem nenhum dos dois: devolve null (o chamador decide o que fazer).
 */
export function structFromTemplate(tpl: TaskTemplate, ts: number): FlowStruct | null {
  if (tpl.flow && tpl.flow.nodes.length > 0) {
    const f = tpl.flow;
    // Normaliza para a origem: o chamador desloca para onde quiser.
    const minX = Math.min(...f.nodes.map(n => n.x), ...f.lanes.map(l => l.x));
    const minY = Math.min(...f.nodes.map(n => n.y));
    const idOf = new Map<string, string>();
    f.nodes.forEach((n, i) => idOf.set(n.id, `fn${ts}-${i}`));
    return {
      lanes: f.lanes.map((l, i) => ({ ...l, id: `fl${ts}-${i}`, x: l.x - minX })),
      nodes: f.nodes.map((n, i) => ({
        ...n,
        id: idOf.get(n.id)!,
        x: n.x - minX,
        y: n.y - minY,
        tasks: n.tasks.map((t, ti) => ({
          ...t,
          id: `fnt${ts}-${i}-${ti}`,
          fromProject: undefined,
          subtasks: (t.subtasks ?? []).map((st, si) => ({ ...st, id: `fns${ts}-${i}-${ti}-${si}` })),
        })),
      })),
      edges: f.edges
        .filter(e => idOf.has(e.fromId) && idOf.has(e.toId))
        .map((e, i) => ({ ...e, id: `fe${ts}-${i}`, fromId: idOf.get(e.fromId)!, toId: idOf.get(e.toId)! })),
    };
  }

  // ── Fallback por etapa ────────────────────────────────────────────────────
  const distintas = new Set(tpl.tasks.filter(t => t.etapa).map(t => t.etapa));
  if (distintas.size < 2) return null;

  const LANE_W = 380, GAP = 16, NODE_W = 250, NODE_GAP = 40;
  const phases: string[] = [];
  const byPhase = new Map<string, Map<string, TemplateTask[]>>();
  for (const t of tpl.tasks) {
    const ph = t.phase || 'Sem fase';
    const et = t.etapa || t.title;
    if (!byPhase.has(ph)) { byPhase.set(ph, new Map()); phases.push(ph); }
    const blocks = byPhase.get(ph)!;
    if (!blocks.has(et)) blocks.set(et, []);
    blocks.get(et)!.push(t);
  }

  const lanes: FlowLane[] = [];
  const nodes: FlowNode[] = [];
  phases.forEach((ph, pi) => {
    const laneX = pi * (LANE_W + GAP);
    const color = PALETTE[pi % PALETTE.length];
    lanes.push({ id: `fl${ts}-${pi}`, title: ph, color, x: laneX, width: LANE_W });
    let y = 0;
    [...byPhase.get(ph)!.entries()].forEach(([etapa, tks], bi) => {
      // Bloco que era vazio no original virou uma tarefa com o nome do bloco:
      // volta a ser bloco vazio.
      const tarefas = tks.filter(t => !(tks.length === 1 && t.title === etapa));
      nodes.push({
        id: `fn${ts}-${pi}-${bi}`,
        type: 'stage',
        x: laneX + (LANE_W - NODE_W) / 2,
        y,
        width: NODE_W,
        title: etapa,
        color,
        tasks: tarefas.map((t, ti) => ({
          id: `fnt${ts}-${pi}-${bi}-${ti}`,
          title: t.title,
          type: t.type,
          subtasks: (t.subtasks ?? []).map((st, si) => ({ id: `fns${ts}-${pi}-${bi}-${ti}-${si}`, title: st.title })),
        })),
      });
      y += 110 + NODE_GAP + tarefas.length * 26;
    });
  });
  return { lanes, nodes, edges: [] };
}
