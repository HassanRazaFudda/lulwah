import type { MenuItemNode } from '@lulwah/contracts';

/**
 * Immutable-tree helpers for the Menus tab's nested drag-and-drop
 * (plan.md §11.1: "nested drag-and-drop with featured imagery per
 * column"). `MenuItemNode` (`@lulwah/contracts`' `content.ts`) is
 * recursive — a node holds its own `children: MenuItemNode[]` — so every
 * edit (rename, reorder, nest, delete) needs to walk down to the right
 * node/array and rebuild every ancestor immutably. A `MenuPath` is the
 * sequence of child-indices from the root to one node (e.g. `[1, 0]` =
 * "the first child of the second root item").
 */
export type MenuPath = number[];

export function getChildrenAtParentPath(items: MenuItemNode[], parentPath: MenuPath): MenuItemNode[] {
  let list = items;
  for (const index of parentPath) {
    const node = list[index];
    if (!node) return [];
    list = node.children;
  }
  return list;
}

export function replaceChildrenAtParentPath(
  items: MenuItemNode[],
  parentPath: MenuPath,
  nextChildren: MenuItemNode[],
): MenuItemNode[] {
  if (parentPath.length === 0) return nextChildren;
  const [head, ...rest] = parentPath;
  return items.map((node, index) =>
    index === head ? { ...node, children: replaceChildrenAtParentPath(node.children, rest, nextChildren) } : node,
  );
}

export function updateNodeAtPath(items: MenuItemNode[], path: MenuPath, patch: Partial<MenuItemNode>): MenuItemNode[] {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  const children = getChildrenAtParentPath(items, parentPath);
  const nextChildren = children.map((node, i) => (i === index ? { ...node, ...patch } : node));
  return replaceChildrenAtParentPath(items, parentPath, nextChildren);
}

export function removeNodeAtPath(items: MenuItemNode[], path: MenuPath): MenuItemNode[] {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  const children = getChildrenAtParentPath(items, parentPath);
  const nextChildren = children.filter((_, i) => i !== index);
  return replaceChildrenAtParentPath(items, parentPath, nextChildren);
}

export function addChildAtPath(items: MenuItemNode[], parentPath: MenuPath, newNode: MenuItemNode): MenuItemNode[] {
  const children = getChildrenAtParentPath(items, parentPath);
  return replaceChildrenAtParentPath(items, parentPath, [...children, newNode]);
}

/** Reorders one node within its own siblings — dragging a node onto
 *  another node only ever reorders (never re-parents); nesting/un-nesting
 *  is its own explicit "Indent"/"Outdent" action instead of an implicit
 *  side effect of a drag, which is the "reasonably simple" interaction
 *  this task's brief explicitly allows for. */
export function moveWithinParent(items: MenuItemNode[], parentPath: MenuPath, from: number, to: number): MenuItemNode[] {
  const children = getChildrenAtParentPath(items, parentPath);
  if (from === to || from < 0 || to < 0 || from >= children.length || to >= children.length) return items;
  const next = children.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as MenuItemNode);
  return replaceChildrenAtParentPath(items, parentPath, next);
}

/** Moves a node to become the last child of its preceding sibling
 *  ("Indent") — the explicit re-parenting action referenced above. */
export function indentNode(items: MenuItemNode[], path: MenuPath): MenuItemNode[] {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  if (index === 0) return items; // no preceding sibling to become a child of
  const siblings = getChildrenAtParentPath(items, parentPath);
  const node = siblings[index];
  if (!node) return items;
  const withoutNode = removeNodeAtPath(items, path);
  return addChildAtPath(withoutNode, [...parentPath, index - 1], node);
}

/** Moves a node up one level to become its parent's next sibling
 *  ("Outdent") — the inverse of `indentNode`. No-op at the root. */
export function outdentNode(items: MenuItemNode[], path: MenuPath): MenuItemNode[] {
  if (path.length < 2) return items;
  const parentPath = path.slice(0, -1);
  const grandparentPath = path.slice(0, -2);
  const parentIndex = parentPath[parentPath.length - 1] as number;
  const index = path[path.length - 1] as number;
  const siblings = getChildrenAtParentPath(items, parentPath);
  const node = siblings[index];
  if (!node) return items;
  const withoutNode = removeNodeAtPath(items, path);
  const grandChildren = getChildrenAtParentPath(withoutNode, grandparentPath);
  const insertAt = parentIndex + 1;
  const nextGrandChildren = [...grandChildren.slice(0, insertAt), node, ...grandChildren.slice(insertAt)];
  return replaceChildrenAtParentPath(withoutNode, grandparentPath, nextGrandChildren);
}

/** Sets `sortOrder` to match array position, recursively — the wire shape
 *  keeps an explicit `sortOrder` per node (not just array order), so every
 *  save normalizes it rather than letting it drift from the actual order. */
export function normalizeSortOrder(items: MenuItemNode[]): MenuItemNode[] {
  return items.map((node, index) => ({ ...node, sortOrder: index, children: normalizeSortOrder(node.children) }));
}

export function newMenuItem(): MenuItemNode {
  return {
    id: crypto.randomUUID(),
    label: '',
    labelAr: '',
    href: '',
    featuredMedia: null,
    badge: null,
    sortOrder: 0,
    children: [],
  };
}
