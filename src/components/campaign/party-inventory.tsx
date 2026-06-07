"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  formatAnimalHeading,
  formatPartyWeight,
  getPartyCarryCapacity,
  getPartySuppliesWeight,
  listAnimalSupplies,
  listPartyAnimals,
  newPartyAnimal,
} from "@/lib/dnd/party-summary";
import { useRealtimePartyData } from "@/lib/hooks/use-realtime-party-data";
import type { PartyData } from "@/lib/schemas/party";

interface PartyInventoryProps {
  campaignId: string;
  initialPartyData: PartyData;
  characters: ParsedCharacter[];
  isDm: boolean;
}

export function PartyInventory({
  campaignId,
  initialPartyData,
  characters,
  isDm,
}: PartyInventoryProps) {
  const livePartyData = useRealtimePartyData(campaignId, initialPartyData);
  const [draft, setDraft] = useState(livePartyData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isDm) return;
    setDraft(livePartyData);
  }, [livePartyData, isDm]);

  const partyData = isDm ? draft : livePartyData;
  const animals = listPartyAnimals(partyData, characters);
  const suppliesWeight = getPartySuppliesWeight(partyData);
  const carryCapacity = getPartyCarryCapacity(partyData);
  const defaultCaretaker = characters[0]?.id ?? "";

  async function save() {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({ party_data: draft })
      .eq("id", campaignId);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Saved");
    }
    setSaving(false);
  }

  function addAnimal() {
    setDraft({
      ...draft,
      animals: [...draft.animals, newPartyAnimal(defaultCaretaker)],
    });
  }

  return (
    <section className="retro-box">
      <div className="retro-section-header animals-section-header">
        <p className="retro-box-title">
          Animals · {formatPartyWeight(suppliesWeight, carryCapacity)}
        </p>
        {isDm && (
          <button
            type="button"
            className="retro-inline-link"
            onClick={addAnimal}
          >
            + Add animal
          </button>
        )}
      </div>

      {isDm ? (
        <PartyInventoryEditor
          draft={draft}
          characters={characters}
          onChange={setDraft}
        />
      ) : animals.length === 0 ? (
        <p className="retro-muted">No animals yet.</p>
      ) : (
        <PartyAnimalList
          partyData={partyData}
          characters={characters}
          animals={animals}
        />
      )}

      {isDm && (
        <div className="party-inventory-save">
          <button
            type="button"
            className="candy-btn"
            onClick={save}
            disabled={saving}
          >
            {saving ? "..." : "Save animals"}
          </button>
          {message && <span className="retro-muted">{message}</span>}
        </div>
      )}
    </section>
  );
}

function PartyAnimalList({
  partyData,
  characters,
  animals,
}: {
  partyData: PartyData;
  characters: ParsedCharacter[];
  animals: ReturnType<typeof listPartyAnimals>;
}) {
  return (
    <div className="party-animal-list">
      {animals.map(({ animal }) => {
        const supplies = listAnimalSupplies(partyData, animal.id);

        return (
          <div key={animal.id} className="party-animal-entry">
            <p className="party-animal-heading">
              {formatAnimalHeading(animal, partyData, characters)}
            </p>
            {supplies.length === 0 ? (
              <p className="retro-muted">No supplies.</p>
            ) : (
              <AnimalSuppliesTable supplies={supplies} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnimalSuppliesTable({
  supplies,
}: {
  supplies: ReturnType<typeof listAnimalSupplies>;
}) {
  return (
    <table className="retro-table party-supplies-table">
      <colgroup>
        <col className="party-supplies-col-item" />
        <col className="party-supplies-col-wt" />
        <col className="party-supplies-col-qty" />
        <col className="party-supplies-col-total" />
      </colgroup>
      <thead>
        <tr>
          <th>Item</th>
          <th className="party-supplies-num">Wt (lb)</th>
          <th className="party-supplies-num">Qty</th>
          <th className="party-supplies-num">Total (lb)</th>
        </tr>
      </thead>
      <tbody>
        {supplies.map(({ item, totalWeightLb }) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td className="party-supplies-num">
              {item.weightLb > 0 ? item.weightLb : "—"}
            </td>
            <td className="party-supplies-num">{item.quantity}</td>
            <td className="party-supplies-num">
              {totalWeightLb > 0 ? totalWeightLb : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PartyInventoryEditor({
  draft,
  characters,
  onChange,
}: {
  draft: PartyData;
  characters: ParsedCharacter[];
  onChange: (data: PartyData) => void;
}) {
  if (draft.animals.length === 0) {
    return <p className="retro-muted">No animals yet.</p>;
  }

  return (
    <div className="party-animal-list">
      {draft.animals.map((animal, index) => {
        const supplies = draft.items.filter(
          (item) => item.animalId === animal.id
        );

        return (
          <div key={animal.id} className="party-animal-block">
            <div className="party-animal-fields">
              <div>
                <label className="candy-label">Name</label>
                <input
                  className="candy-input"
                  value={animal.name}
                  onChange={(e) => {
                    const animals = [...draft.animals];
                    animals[index] = { ...animal, name: e.target.value };
                    onChange({ ...draft, animals });
                  }}
                />
              </div>
              <div>
                <label className="candy-label">Type</label>
                <input
                  className="candy-input"
                  value={animal.type}
                  onChange={(e) => {
                    const animals = [...draft.animals];
                    animals[index] = { ...animal, type: e.target.value };
                    onChange({ ...draft, animals });
                  }}
                />
              </div>
              <div>
                <label className="candy-label">Caretaker</label>
                <select
                  className="candy-input"
                  value={animal.caretakerCharacterId}
                  onChange={(e) => {
                    const animals = [...draft.animals];
                    animals[index] = {
                      ...animal,
                      caretakerCharacterId: e.target.value,
                    };
                    onChange({ ...draft, animals });
                  }}
                >
                  <option value="">No caretaker</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="candy-label">Carry (lb)</label>
                <input
                  className="candy-input"
                  type="number"
                  min={0}
                  step={1}
                  value={animal.carryCapacityLb || ""}
                  onChange={(e) => {
                    const animals = [...draft.animals];
                    animals[index] = {
                      ...animal,
                      carryCapacityLb: parseFloat(e.target.value) || 0,
                    };
                    onChange({ ...draft, animals });
                  }}
                />
              </div>
            </div>

            <p className="retro-edit-link">
              <button
                type="button"
                className="retro-inline-link"
                onClick={() =>
                  onChange({
                    ...draft,
                    animals: draft.animals.filter((_, i) => i !== index),
                    items: draft.items.filter(
                      (item) => item.animalId !== animal.id
                    ),
                  })
                }
              >
                Remove animal
              </button>
            </p>

            <p className="retro-box-subtitle">Items</p>
            <div className="party-animal-supplies">
              {supplies.map((item) => {
                const itemIndex = draft.items.findIndex(
                  (entry) => entry.id === item.id
                );
                if (itemIndex < 0) return null;

                return (
                  <div key={item.id} className="party-inventory-row">
                    <input
                      className="candy-input party-inventory-input"
                      placeholder="Item"
                      value={item.name}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[itemIndex] = { ...item, name: e.target.value };
                        onChange({ ...draft, items });
                      }}
                    />
                    <input
                      className="candy-input party-inventory-input party-inventory-wt"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="lb"
                      value={item.weightLb || ""}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[itemIndex] = {
                          ...item,
                          weightLb: parseFloat(e.target.value) || 0,
                        };
                        onChange({ ...draft, items });
                      }}
                    />
                    <input
                      className="candy-input party-inventory-input party-inventory-qty"
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[itemIndex] = {
                          ...item,
                          quantity: parseInt(e.target.value) || 0,
                        };
                        onChange({ ...draft, items });
                      }}
                    />
                    <button
                      type="button"
                      className="retro-inline-link"
                      onClick={() =>
                        onChange({
                          ...draft,
                          items: draft.items.filter((_, i) => i !== itemIndex),
                        })
                      }
                    >
                      remove
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="retro-inline-link"
                onClick={() =>
                  onChange({
                    ...draft,
                    items: [
                      ...draft.items,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        quantity: 1,
                        weightLb: 0,
                        animalId: animal.id,
                        notes: "",
                      },
                    ],
                  })
                }
              >
                + Add item
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
