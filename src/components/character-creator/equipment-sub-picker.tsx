"use client";

import { CatalogItemPicker } from "./catalog-item-picker";
import {
  catalogPickerFilterLabel,
  getEquipmentPlaceholderFilter,
  type CatalogPickerFilter,
} from "@/lib/items/catalog-picker-filter";

export type { CatalogPickerFilter, PlaceholderFilter } from "@/lib/items/catalog-picker-filter";
export { getEquipmentPlaceholderFilter };

interface EquipmentSubPickerProps {
  filter: CatalogPickerFilter;
  value: string | null;
  onSelect: (name: string) => void;
  /** Override the default label derived from the filter. */
  label?: string;
}

export function EquipmentSubPicker({
  filter,
  value,
  onSelect,
  label,
}: EquipmentSubPickerProps) {
  return (
    <CatalogItemPicker
      filter={filter}
      selected={value ? [value] : []}
      max={1}
      label={label ?? catalogPickerFilterLabel(filter)}
      onChange={(names) => onSelect(names[0] ?? "")}
    />
  );
}
