import { NoteHandler } from "./base.js";

export class ResistanceNoteHandler extends NoteHandler {
  constructor(data, protoNote, documents) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.documents = documents;
  }

  async create() {
    if (!this.data.resistanceType || !this.data.resistanceValue) return;

    // Create the effects.
    for (const tokenDoc of this.documents) {
      // HACK: Auto-calculate seems to only work for resistances. Vulnerabilities go through the bonus dialog.
      const isResistance = this.data.resistanceValue > 0;
      await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
        name: this.protoNote.id,
        changes: [
          {
            key: `system.resistances.${this.data.resistanceType}.${isResistance ? 'res' : 'vuln'}`,
            mode: isResistance ? 4 : 3, // 4: Highest take priority. 3: Lowest take priority
            value: this.data.resistanceValue,
          }
        ],
        flags: {
          dnd4e: {
            effectData: {
              // Necessary to prevent a null reference in the dnd4e system.
              durationType: "custom",
            }
          }
        }
      }]);
    }

    return foundry.utils.mergeObject(this.protoNote, {
      text: `${this.data.resistanceValue > 0 ? '+' : ''}${this.data.resistanceValue} ${this.data.resistanceType} Resistance`,
    });
  }

  async clean(token, note) {
    if (!token?.actor) return;

    const effect = token.actor.effects.find(e => e.name === note.id);
    if (effect) {
      await effect.delete();
    }

    super.clean(token, note);
  }
}
