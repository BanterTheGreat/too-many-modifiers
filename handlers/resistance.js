import { NoteHandler } from "./base.js";

/**
 * Creates and removes Active Effects for resistances and vulnerabilities.
 */
export class ResistanceNoteHandler extends NoteHandler {
  /**
   * Creates a resistance-note handler.
   *
   * @param {object} data The submitted form data.
   * @param {object} protoNote Shared data for the new note.
   * @param {TokenDocument[]} documents Tokens receiving the effects.
   */
  constructor(data, protoNote, documents) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.documents = documents;
  }

  /**
   * Creates resistance effects and returns their tracking note.
   *
   * @returns {Promise<object|undefined>} The created note, if valid.
   */
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
        // DnD4e 0.9.3 reads this directly during ActiveEffect._preCreate.
        system: {
          durationType: "custom",
        },
      }]);
    }

    return foundry.utils.mergeObject(this.protoNote, {
      text: `${this.data.resistanceValue > 0 ? '+' : ''}${this.data.resistanceValue} ${this.data.resistanceType} Resistance`,
    });
  }

  /**
   * Removes the Active Effect associated with a resistance note.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object} note The note being removed.
   * @returns {Promise<void>}
   */
  async clean(token, note) {
    if (!token?.actor) return;

    const effect = token.actor.effects.find(e => e.name === note.id);
    if (effect) {
      await effect.delete();
    }

    super.clean(token, note);
  }
}
