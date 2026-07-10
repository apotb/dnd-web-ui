"use client";

import { useState } from "react";
import type { LoreCategory } from "@/lib/schemas/lore-category";

interface LoreCategoryTabsProps {
  categories: LoreCategory[];
  activeCategoryId: string | null;
  editable: boolean;
  renamingCategoryId: string | null;
  onRenamingCategoryIdChange: (categoryId: string | null) => void;
  emptyMessage?: string;
  onSelect: (categoryId: string | null) => void;
  onAdd: (label: string) => void;
  onRename: (categoryId: string, label: string) => void;
}

function LoreCategoryRenameRow({
  category,
  onRename,
  onCancel,
}: {
  category: LoreCategory;
  onRename: (categoryId: string, label: string) => void;
  onCancel: () => void;
}) {
  const [renameLabel, setRenameLabel] = useState(category.label);

  function submitRename() {
    const label = renameLabel.trim();
    if (!label) return;
    onRename(category.id, label);
    onCancel();
  }

  return (
    <div className="lore-category-rename-row">
      <input
        className="candy-input"
        value={renameLabel}
        onChange={(event) => setRenameLabel(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitRename();
          if (event.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <button
        type="button"
        className="candy-btn candy-btn-sm"
        onClick={submitRename}
      >
        Save
      </button>
      <button
        type="button"
        className="candy-btn candy-btn-sm"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

export function LoreCategoryTabs({
  categories,
  activeCategoryId,
  editable,
  renamingCategoryId,
  onRenamingCategoryIdChange,
  emptyMessage = "No categories yet.",
  onSelect,
  onAdd,
  onRename,
}: LoreCategoryTabsProps) {
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  function submitNewCategory() {
    const label = newCategoryLabel.trim();
    if (!label) return;
    onAdd(label);
    setNewCategoryLabel("");
    setAddingCategory(false);
  }

  function cancelRename() {
    onRenamingCategoryIdChange(null);
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
          if (editable && renamingCategoryId === category.id) {
            return (
              <LoreCategoryRenameRow
                key={category.id}
                category={category}
                onRename={onRename}
                onCancel={cancelRename}
              />
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
                className="candy-btn candy-btn-sm"
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
