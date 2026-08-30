'use client';

import { useState } from 'react';
import type { Menu, MenuItemNode, MenuLocation } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminMenusQuery,
  useCreateMenuMutation,
  useUpdateMenuMutation,
  useDeleteMenuMutation,
} from '../../lib/queries/content-menus';
import {
  addChildAtPath,
  indentNode,
  moveWithinParent,
  newMenuItem,
  normalizeSortOrder,
  outdentNode,
  removeNodeAtPath,
  updateNodeAtPath,
} from '../../lib/menu-tree-utils';
import type { MenuPath } from '../../lib/menu-tree-utils';
import { selectClassName } from '../product-editor/field-styles';
import { MenuItemRow } from './MenuItemRow';

const LOCATIONS: MenuLocation[] = ['header', 'footer', 'mobile'];
const LOCATION_LABELS: Record<MenuLocation, string> = { header: 'Header', footer: 'Footer', mobile: 'Mobile' };

/** plan.md §11.1: "Menus — nested drag-and-drop with featured imagery per
 *  column." One menu per `MenuLocation` (that field is the menu's own
 *  lookup key — see `content.ts`'s `Menu` doc comment), each editable as a
 *  nested tree (`lib/menu-tree-utils.ts` + `MenuItemRow.tsx`). */
export function MenusPanel() {
  const { data: menus, isLoading } = useAdminMenusQuery();
  const createMenu = useCreateMenuMutation();
  const updateMenu = useUpdateMenuMutation();
  const deleteMenu = useDeleteMenuMutation();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItemNode[]>([]);
  const [dragPath, setDragPath] = useState<MenuPath | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const list = menus ?? [];
  const usedLocations = new Set(list.map((m) => m.location));
  const availableLocations = LOCATIONS.filter((loc) => !usedLocations.has(loc));
  const activeMenu = list.find((m) => m.id === activeMenuId) ?? null;

  const openMenu = (menu: Menu) => {
    setActiveMenuId(menu.id);
    setItems(menu.items);
  };

  const handleCreate = (location: MenuLocation) => {
    createMenu.mutate(location, {
      onSuccess: (menu) => {
        pushToast('success', `${LOCATION_LABELS[location]} menu created.`);
        openMenu(menu);
      },
      onError: (error) => pushToast('error', `Could not create menu: ${error.message}`),
    });
  };

  const handleSave = () => {
    if (!activeMenuId) return;
    updateMenu.mutate(
      { id: activeMenuId, items: normalizeSortOrder(items) },
      {
        onSuccess: () => pushToast('success', 'Menu saved.'),
        onError: (error) => pushToast('error', `Could not save menu: ${error.message}`),
      },
    );
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deleteMenu.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Menu deleted.');
        setPendingDeleteId(null);
        if (activeMenuId === pendingDeleteId) {
          setActiveMenuId(null);
          setItems([]);
        }
      },
      onError: (error) => pushToast('error', `Could not delete menu: ${error.message}`),
    });
  };

  const handleDropOnto = (targetPath: MenuPath) => {
    if (!dragPath) return;
    const sameParent =
      dragPath.length === targetPath.length && dragPath.slice(0, -1).join('.') === targetPath.slice(0, -1).join('.');
    if (!sameParent) {
      pushToast('error', 'Drag only reorders within the same level. Use Indent/Outdent to move a level.');
      setDragPath(null);
      return;
    }
    const parentPath = targetPath.slice(0, -1);
    const from = dragPath[dragPath.length - 1] as number;
    const to = targetPath[targetPath.length - 1] as number;
    setItems((current) => moveWithinParent(current, parentPath, from, to));
    setDragPath(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[56px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-wrap items-center gap-8">
        {list.map((menu) => (
          <Button key={menu.id} type="button" variant={activeMenuId === menu.id ? 'primary' : 'secondary'} onClick={() => openMenu(menu)}>
            {LOCATION_LABELS[menu.location]} {menu.isActive ? '' : '(inactive)'}
          </Button>
        ))}
        {availableLocations.length > 0 ? (
          <div className="flex items-center gap-8">
            <select id="new-menu-location" className={selectClassName} defaultValue={availableLocations[0]}>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCATION_LABELS[loc]}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={() => {
                const select = document.getElementById('new-menu-location') as HTMLSelectElement | null;
                handleCreate((select?.value as MenuLocation) ?? availableLocations[0]);
              }}
              disabled={createMenu.isPending}
            >
              New menu
            </Button>
          </div>
        ) : null}
      </div>

      {activeMenu ? (
        <div className="flex flex-col gap-16 border border-line bg-nacre p-16">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body font-semibold text-ink">{LOCATION_LABELS[activeMenu.location]} menu</h3>
              <label className="mt-4 flex items-center gap-8 text-body-sm text-ink">
                <input
                  type="checkbox"
                  checked={activeMenu.isActive}
                  onChange={(e) =>
                    updateMenu.mutate(
                      { id: activeMenu.id, isActive: e.target.checked },
                      { onError: (error) => pushToast('error', `Could not update menu: ${error.message}`) },
                    )
                  }
                />
                Active
              </label>
            </div>
            <button
              type="button"
              className="text-body-sm text-danger hover:underline"
              onClick={() => setPendingDeleteId(activeMenu.id)}
            >
              Delete menu
            </button>
          </div>

          <div className="flex flex-col gap-8">
            {items.length === 0 ? <p className="text-body-sm text-ink-70">No items yet. Add one below.</p> : null}
            {items.map((node, index) => (
              <MenuItemRow
                key={node.id}
                node={node}
                path={[index]}
                dragPath={dragPath}
                onDragStart={setDragPath}
                onDropOnto={handleDropOnto}
                onUpdate={(path, patch) => setItems((current) => updateNodeAtPath(current, path, patch))}
                onRemove={(path) => setItems((current) => removeNodeAtPath(current, path))}
                onIndent={(path) => setItems((current) => indentNode(current, path))}
                onOutdent={(path) => setItems((current) => outdentNode(current, path))}
                onAddChild={(path) => setItems((current) => addChildAtPath(current, path, newMenuItem()))}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="self-start text-body-sm font-semibold text-zamurrad hover:underline"
              onClick={() => setItems((current) => [...current, newMenuItem()])}
            >
              + Add top-level item
            </button>
            <Button type="button" onClick={handleSave} disabled={updateMenu.isPending}>
              {updateMenu.isPending ? 'Saving…' : 'Save menu'}
            </Button>
          </div>
          {updateMenu.isError ? <p className="text-body-sm text-danger">{updateMenu.error.message}</p> : null}
        </div>
      ) : (
        <p className="text-body-sm text-ink-70">
          {list.length === 0 ? 'No menus yet. Create one above.' : 'Select a menu above to edit it.'}
        </p>
      )}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete menu"
        description="This permanently removes the whole menu, including all of its items. Type DELETE to confirm."
        confirmLabel="DELETE"
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deleteMenu.isPending}
        errorMessage={deleteMenu.isError ? deleteMenu.error.message : null}
      />
    </div>
  );
}
