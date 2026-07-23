/** Helpers for category permission previews, labels, and hierarchical toggles. */

export type PreviewModuleNode = {
  id: string;
  label: string;
  children?: PreviewModuleNode[];
};

export type PreviewCatalogGroup = {
  id: string;
  label: string;
  modules: PreviewModuleNode[];
};

export type ToggleState = "on" | "off" | "partial";

export function leafIdsUnder(node: PreviewModuleNode): string[] {
  if (node.children?.length) {
    return node.children.flatMap(leafIdsUnder);
  }
  return [node.id];
}

export function allLeafIds(catalog: PreviewCatalogGroup[]): string[] {
  return catalog.flatMap((group) => group.modules.flatMap((mod) => leafIdsUnder(mod)));
}

export function moduleNodeState(node: PreviewModuleNode, modules: Record<string, boolean>): ToggleState {
  const leaves = leafIdsUnder(node);
  const enabled = leaves.filter((id) => modules[id]).length;
  if (enabled === 0) return "off";
  if (enabled === leaves.length) return "on";
  return "partial";
}

export function groupNodeState(modulesInGroup: PreviewModuleNode[], modules: Record<string, boolean>): ToggleState {
  const leaves = modulesInGroup.flatMap((mod) => leafIdsUnder(mod));
  if (leaves.length === 0) return "off";
  const enabled = leaves.filter((id) => modules[id]).length;
  if (enabled === 0) return "off";
  if (enabled === leaves.length) return "on";
  return "partial";
}

export function applyNodeToggle(
  modules: Record<string, boolean>,
  node: PreviewModuleNode,
  enabled: boolean,
): Record<string, boolean> {
  const next = { ...modules };
  leafIdsUnder(node).forEach((id) => {
    next[id] = enabled;
  });
  return next;
}

export function applyGroupToggle(
  modules: Record<string, boolean>,
  groupModules: PreviewModuleNode[],
  enabled: boolean,
): Record<string, boolean> {
  const next = { ...modules };
  allLeafIds([{ id: "_", label: "", modules: groupModules }]).forEach((id) => {
    next[id] = enabled;
  });
  return next;
}

export function countEnabledLeaves(catalog: PreviewCatalogGroup[], modules: Record<string, boolean>): {
  enabled: number;
  total: number;
} {
  const leaves = allLeafIds(catalog);
  return {
    enabled: leaves.filter((id) => modules[id]).length,
    total: leaves.length,
  };
}

export function enabledModuleLabels(
  catalog: PreviewCatalogGroup[],
  modules: Record<string, boolean>,
): string[] {
  const out: string[] = [];
  const walk = (node: PreviewModuleNode) => {
    if (node.children?.length) {
      node.children.forEach(walk);
      return;
    }
    if (modules[node.id]) out.push(node.label);
  };
  catalog.forEach((g) => g.modules.forEach(walk));
  return out;
}
