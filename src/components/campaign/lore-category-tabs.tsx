"use client";

import { useState } from "react";
import type { LoreCategory } from "@/lib/schemas/lore-category";

interface LoreCategoryTabsProps {
  categories: LoreCategory[];
  activeCategoryId: string | null;
  editable: boolean;
  itemCountsByCategory: Map<string, number>;
  emptyMessage?: string;
  onSelect: (categoryId: string | null) => void;
  onAdd: (label: string) => void;
  onRename: (categoryId: string, label: string) => void;
  onRemove: (categoryId: string) => void;
}

export function LoreCategoryTabs({
  categories,
  activeCategoryId,
  editable,
  itemCountsByCategory,
  emptyMessage = "No categories yet.",
  onSelect,
  onAdd,
  onRename,
  onRemove,
}: LoreCategoryTabsProps) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(
    null
  );
  const [renameLabel, setRenameLabel] = useState("");

  function submitNewCategory() {
    const label = newCategoryLabel.trim();
    if (!label) return;
    onAdd(label);
    setNewCategoryLabel("");
    setAddingCategory(false);
  }

  function submitRename(categoryId: string) {
    const label = renameLabel.trim();
    if (!label) return;
    onRename(categoryId, label);
    setRenamingCategoryId(null);
    setRenameLabel("");
  }

  if (categories.length === 0 && !editable) {
    return <p className="retro-hint retro-muted">{emptyMessage}</p>;
  }

  return (
    <div className="lore-category-tabs">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {categories.map((category) => {
          const itemCount = itemCountsByCategory.get(category.id) ?? 0;
          const canRemove = itemCount === 0;

          if (editable && renamingCategoryId === category.id) {
            return (
              <div key={category.id} className="lore-category-rename-row">
                <input
                  className="candy-input"
                  value={renameLabel}
                  onChange={(event) => setRenameLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitRename(category.id);
                    if (event.key === "Escape") setRenamingCategoryId(null);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="candy-btn candy-btn-sm"
                  onClick={() => submitRename(category.id)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="retro-inline-link"
                  onClick={() => setRenamingCategoryId(null)}
                >
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div key={category.id} className="lore-category-tab-group">
              <button
                type="button"
                className={`candy-btn${activeCategoryId === category.id ? " candy-btn-active" : ""}`}
                style={{ flex: "0 1 auto" }}
                onClick={() =>
                  onSelect(activeCategoryId === category.id ? null : category.id)
                }
              >
                {category.label}
              </button>
              {editable ? (
                <span className="lore-category-tab-actions">
                  <button
                    type="button"
                    className="retro-inline-link"
                    title="Rename category"
                    onClick={() => {
                      setRenamingCategoryId(category.id);
                      setRenameLabel(category.label);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="retro-inline-link"
                    style={{ color: canRemove ? "#b00020" : undefined }}
                    disabled={!canRemove}
                    title={
                      canRemove
                        ? "Remove category"
                        : "Cannot remove a category that contains items"
                    }
                    onClick={() => onRemove(category.id)}
                  >
                    Remove
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}

        {editable ? (
          addingCategory ? (
            <div className="lore-category-add-row">
              <input
                className="candy-input"
                placeholder="Category name"
                value={newCategoryLabel}
                onChange={(event) => setNewCategoryLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitNewCategory();
                  if (event.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategoryLabel("");
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="candy-btn candy-btn-sm"
                onClick={submitNewCategory}
              >
                Add
              </button>
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryLabel("");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="candy-btn"
              style={{ flex: "0 1 auto" }}
              onClick={() => setAddingCategory(true)}
            >
              + Category
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
