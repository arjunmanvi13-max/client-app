/** Helpers for category permission previews and labels. */

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
