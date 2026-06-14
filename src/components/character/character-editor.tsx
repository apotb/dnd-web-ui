"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CharacterSheet } from "@/components/character/character-sheet";
import { JsonImportExport } from "@/components/character/json-import-export";
import type { CharacterData } from "@/lib/schemas/character";
import { syncCharacterTopLevelFields } from "@/lib/character/utils";
import { prepareCharacterDataForSave } from "@/lib/character/save-character-data";
import { syncSavingThrowsFromClass } from "@/lib/character/class-derivation";
import type { PhbClass } from "@/lib/dnd/phb/types";

interface CharacterEditorProps {
  characterId: string;
  campaignId: string;
  initialName: string;
  initialPlayerName: string;
  initialData: CharacterData;
  classes: PhbClass[];
  canDelete?: boolean;
  showDmNotes?: boolean;
  showEditingNote?: boolean;
}

export function CharacterEditor({
  characterId,
  campaignId,
  initialName,
  initialPlayerName,
  initialData,
  classes,
  canDelete = true,
  showDmNotes = true,
  showEditingNote = false,
}: CharacterEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);

    const synced = prepareCharacterDataForSave(
      syncCharacterTopLevelFields(name, playerName, {
        ...data,
        savingThrows: syncSavingThrowsFromClass(data, classes),
      }),
      classes
    );
    const supabase = createClient();

    const { error } = await supabase
      .from("characters")
      .update({
        name: name || synced.basicInfo.name,
        player_name: playerName || synced.basicInfo.playerName,
        data: synced,
      })
      .eq("id", characterId);

    if (error) {
      setMessage(error.message);
    } else {
      setData(synced);
      setMessage("Saved");
      router.refresh();
    }

    setSaving(false);
  }

  async function deleteCharacter() {
    if (!confirm("Delete this character?")) return;
    const supabase = createClient();
    await supabase.from("characters").delete().eq("id", characterId);
    router.push(`/campaigns/${campaignId}/characters`);
    router.refresh();
  }

  return (
    <div>
      <h2 className="page-title">Edit Character</h2>

      <div className="page-intro">
        <Link
          href={`/campaigns/${campaignId}/characters`}
          className="retro-back-link"
        >
          ← Characters
        </Link>
        {showEditingNote ? (
          <p className="retro-note">
            You are editing <strong>{name}</strong>.
          </p>
        ) : null}
      </div>

      <section className="retro-box">
        <div className="sheet-editor-toolbar">
          <div className="sheet-editor-fields">
            <div>
              <label className="candy-label" htmlFor="char-name">
                Character name
              </label>
              <input
                id="char-name"
                className="candy-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="candy-label" htmlFor="player-name">
                Player name
              </label>
              <input
                id="player-name"
                className="candy-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
          </div>

          <div className="sheet-editor-actions">
            <JsonImportExport
              name={name}
              playerName={playerName}
              data={data}
              onImport={({ name: n, playerName: pn, data: d }) => {
                setName(n);
                setPlayerName(pn);
                setData(d);
              }}
            />
            <button
              type="button"
              className="candy-btn"
              onClick={save}
              disabled={saving}
            >
              {saving ? "..." : "Save"}
            </button>
            {canDelete ? (
              <button
                type="button"
                className="candy-btn"
                onClick={deleteCharacter}
              >
                Delete
              </button>
            ) : null}
          </div>

          {message && <p className="retro-muted">{message}</p>}
        </div>
      </section>

      <section className="retro-box character-sheet-wrap">
        <CharacterSheet
          data={data}
          isDm={showDmNotes}
          editable
          classes={classes}
          onChange={setData}
        />
      </section>
    </div>
  );
}
