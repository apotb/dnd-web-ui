"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import { fetchCatalogClassesClient } from "@/lib/content/catalog-client";
import { PHB_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { getItemsBySlugsClient } from "@/lib/items/catalog-client";
import type { Item } from "@/lib/schemas/item";

export function useCombatCatalog(characters: ParsedCharacter[]) {
  const [catalogItems, setCatalogItems] = useState<Record<string, Item>>({});
  const [classCatalog, setClassCatalog] = useState<PhbClass[]>([]);

  const itemSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const character of characters) {
      for (const item of character.data.inventory.items) {
        if (item.itemId) slugs.add(item.itemId);
      }
    }
    return [...slugs];
  }, [characters]);

  useEffect(() => {
    fetchCatalogClassesClient().then(setClassCatalog);
  }, []);

  useEffect(() => {
    if (itemSlugs.length === 0) {
      setCatalogItems({});
      return;
    }
    getItemsBySlugsClient(itemSlugs).then(setCatalogItems);
  }, [itemSlugs]);

  const featureCatalogs = useMemo(
    () => ({
      species: ALL_SPECIES,
      classes: classCatalog,
      backgrounds: PHB_BACKGROUNDS,
    }),
    [classCatalog]
  );

  return { catalogItems, classCatalog, featureCatalogs };
}
