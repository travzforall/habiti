import { MindMapNode, childrenOf, depthOf, rootOf } from '../models/mind-map.models';
import { FALLBACK_SIZE, edgePath, layoutMap, measureNode } from './mind-map-layout';

/**
 * Taking a map somewhere else.
 *
 * Two formats, chosen because they are the two that survive: Markdown, which
 * every notes app and every text box understands, and SVG, which is the map
 * itself at any size. Both are built from the same tree the editor draws, so
 * what you export is what you saw.
 *
 * PNG is deliberately not here: it is the SVG below drawn into a canvas, which
 * needs a DOM, so it lives with the component that has one.
 */

/**
 * `# Root`, `## Branch`, `- leaf` — headings while the structure is coarse,
 * bullets once it is a list. Six levels of `#` is Markdown's limit and also
 * roughly where a heading stops meaning anything.
 */
export function exportMarkdown(nodes: readonly MindMapNode[]): string {
  const root = rootOf(nodes);
  if (!root) return '';

  const lines: string[] = [];

  const walk = (node: MindMapNode): void => {
    const depth = depthOf(nodes, node);
    const label = node.text || 'Untitled';

    if (depth < 3) {
      lines.push('', `${'#'.repeat(depth + 1)} ${label}`);
    } else {
      const indent = '  '.repeat(Math.max(0, depth - 3));
      // A task node exports as a checkbox, which is what a task is in Markdown.
      const bullet = node.kind === 'task' ? '- [ ] ' : '- ';
      lines.push(`${indent}${bullet}${label}`);
    }

    if (node.note) {
      const indent = depth < 3 ? '' : '  '.repeat(Math.max(0, depth - 2));
      lines.push(`${indent}> ${node.note.replace(/\n/g, ' ')}`);
    }
    if (node.url) lines.push(`${depth < 3 ? '' : '  '}<${node.url}>`);

    for (const child of childrenOf(nodes, node.id)) walk(child);
  };

  walk(root);
  return lines.join('\n').trim() + '\n';
}

/**
 * The map as a standalone SVG file.
 *
 * Rebuilt from the layout rather than serialised from the live DOM: the live
 * one is full of Tailwind classes that mean nothing outside the app, and its
 * viewBox is wherever the user happened to be looking.
 *
 * Text is escaped, and only ever lands inside a text node — there is no path
 * here for a label to become markup.
 */
export function exportSvg(nodes: readonly MindMapNode[]): string {
  const wrapped = new Map<string, string[]>();

  const laid = layoutMap(nodes, node => {
    const measured = measureNode(node.text || 'Untitled', text => text.length * 7.4, {
      hasBadge: node.kind === 'task'
    });
    wrapped.set(node.id, measured.lines);
    return measured.size ?? FALLBACK_SIZE;
  });

  if (laid.nodes.length === 0) return '';

  const margin = 40;
  const width = Math.ceil(laid.bounds.width + margin * 2);
  const height = Math.ceil(laid.bounds.height + margin * 2);
  const viewBox = `${laid.bounds.x - margin} ${laid.bounds.y - margin} ${width} ${height}`;

  const edges = laid.edges
    .map(
      edge =>
        `<path d="${edgePath(edge)}" fill="none" stroke="#cbd5e1" stroke-width="${
          edge.depth === 1 ? 3 : 2
        }" stroke-linecap="round"/>`
    )
    .join('\n  ');

  const boxes = laid.nodes
    .map(box => {
      const lines = wrapped.get(box.node.id) ?? [box.node.text];
      const fill = box.depth === 0 ? box.node.colour || '#16a34a' : box.node.colour || '#ffffff';
      const colour = box.depth === 0 || box.node.colour ? '#ffffff' : '#1e293b';
      const stroke = box.depth === 0 ? fill : '#cbd5e1';

      const text = lines
        .map(
          (line, index) =>
            `<text x="${box.x + 14}" y="${box.y + 9 + 18 * (index + 0.78)}" fill="${colour}" font-size="${
              box.depth === 0 ? 15 : 13
            }" font-weight="${box.depth === 0 ? 700 : 400}" font-family="system-ui, sans-serif">${escapeXml(
              line
            )}</text>`
        )
        .join('');

      return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${text}</g>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <rect x="${laid.bounds.x - margin}" y="${laid.bounds.y - margin}" width="${width}" height="${height}" fill="#ffffff"/>
  ${edges}
  ${boxes}
</svg>
`;
}

/** The five characters that would otherwise end an attribute or a tag early. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
