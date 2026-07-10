"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  sortCategories,
  type LoreCategory,
} from "@/lib/schemas/lore-category";

interface LoreCategoryEditingHeaderProps {
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  editable: boolean;
  activeCategoryId: string | null;
  categories: LoreCategory[];
  itemCountsByCategory: Map<string, number>;
  renamingCategoryId: string | null;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRename: () => void;
  onRemove: () => void;
}

export function LoreCategoryEditingHeader({
  canEdit,
  editing,
  onEditingChange,
  editable,
  activeCategoryId,
  categories,
  itemCountsByCategory,
  renamingCategoryId,
  onMoveLeft,
  onMoveRight,
  onRename,
  onRemove,
}: LoreCategoryEditingHeaderProps) {
  if (!canEdit) return null;

  const sortedCategories = sortCategories(categories);
  const activeIndex = activeCategoryId
    ? sortedCategories.findIndex((category) => category.id === activeCategoryId)
    : -1;
  const renaming = renamingCategoryId !== null;
  const hasActiveCategory = activeIndex >= 0;
  const canMoveLeft =
    editable && hasActiveCategory && activeIndex > 0 && !renaming;
  const canMoveRight =
    editable &&
    hasActiveCategory &&
    activeIndex < sortedCategories.length - 1 &&
    !renaming;
  const canRename = editable && hasActiveCategory && !renaming;
  const canRemove =
    editable &&
    hasActiveCategory &&
    (itemCountsByCategory.get(activeCategoryId!) ?? 0) === 0 &&
    !renaming;

  return (
    <div className="lore-category-editing-header">
      <label
        className={`notable-editing-toggle candy-btn cursor-pointer select-none w-fit${editing ? " candy-btn-active" : ""}`}
      >
        <Checkbox
          checked={editing}
          onCheckedChange={(checked) => onEditingChange(checked === true)}
        />
        <span>Editing</span>
      </label>

      {editing ? (
        <>
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            disabled={!canMoveLeft}
            title="Move category left"
            onClick={onMoveLeft}
          >
            Left
          </button>
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            disabled={!canMoveRight}
            title="Move category right"
            onClick={onMoveRight}
          >
            Right
          </button>
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            disabled={!canRename}
            title="Rename category"
            onClick={onRename}
          >
            Rename
          </button>
          <button
            type="button"
            className="candy-btn candy-btn-sm"
            disabled={!canRemove}
            title={
              canRemove
                ? "Remove category"
                : "Cannot remove a category that contains items"
            }
            onClick={onRemove}
          >
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}
