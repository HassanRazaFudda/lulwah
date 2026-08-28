'use client';

import type { DragEvent } from 'react';
import type { MenuItemNode } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';
import type { MenuPath } from '../../lib/menu-tree-utils';
import { MediaRefField } from './MediaRefField';

export interface MenuItemRowProps {
  node: MenuItemNode;
  path: MenuPath;
  dragPath: MenuPath | null;
  onDragStart: (path: MenuPath) => void;
  onDropOnto: (path: MenuPath) => void;
  onUpdate: (path: MenuPath, patch: Partial<MenuItemNode>) => void;
  onRemove: (path: MenuPath) => void;
  onIndent: (path: MenuPath) => void;
  onOutdent: (path: MenuPath) => void;
  onAddChild: (path: MenuPath) => void;
}

/** One node in the Menus tab's nested tree — renders itself, then
 *  recurses into `node.children` at increasing indent. See
 *  `lib/menu-tree-utils.ts`'s doc comment for the drag-reorders-siblings /
 *  Indent-Outdent-reparents split this implements. */
export function MenuItemRow({
  node,
  path,
  dragPath,
  onDragStart,
  onDropOnto,
  onUpdate,
  onRemove,
  onIndent,
  onOutdent,
  onAddChild,
}: MenuItemRowProps) {
  const depth = path.length - 1;

  return (
    <div style={{ marginLeft: depth * 24 }} className="flex flex-col gap-8 border border-line bg-paper p-12">
      <div
        draggable
        onDragStart={() => onDragStart(path)}
        onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.stopPropagation();
          onDropOnto(path);
        }}
        className="flex cursor-grab items-center gap-8 active:cursor-grabbing"
      >
        <span className="text-ink-70" aria-hidden="true">
          ⠿
        </span>
        <span className="flex-1 text-body-sm font-semibold text-ink">{node.label || '(untitled item)'}</span>
        <button type="button" className="text-body-sm text-ink-70 hover:text-ink" onClick={() => onOutdent(path)} disabled={depth === 0}>
          ← Outdent
        </button>
        <button type="button" className="text-body-sm text-ink-70 hover:text-ink" onClick={() => onIndent(path)}>
          Indent →
        </button>
        <button type="button" className="text-body-sm text-zamurrad hover:underline" onClick={() => onAddChild(path)}>
          + Child
        </button>
        <button
          type="button"
          className="text-body-sm text-danger hover:underline"
          onClick={() => {
            if (window.confirm(`Remove "${node.label || 'this item'}" and all of its children?`)) onRemove(path);
          }}
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Input label="Label (EN)" value={node.label} onChange={(e) => onUpdate(path, { label: e.target.value })} />
        <Input label="Label (AR)" value={node.labelAr} onChange={(e) => onUpdate(path, { labelAr: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Input label="Href" value={node.href} onChange={(e) => onUpdate(path, { href: e.target.value })} />
        <Input
          label="Badge — optional"
          value={node.badge ?? ''}
          onChange={(e) => onUpdate(path, { badge: e.target.value.trim() || null })}
        />
      </div>
      <MediaRefField label="Featured image" value={node.featuredMedia} onChange={(featuredMedia) => onUpdate(path, { featuredMedia })} />

      {node.children.length > 0 ? (
        <div className="flex flex-col gap-8 pt-4">
          {node.children.map((child, index) => (
            <MenuItemRow
              key={child.id}
              node={child}
              path={[...path, index]}
              dragPath={dragPath}
              onDragStart={onDragStart}
              onDropOnto={onDropOnto}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
