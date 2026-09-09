import { NoteHandler } from "./base.js";

/**
 * Creates and removes status-condition Active Effects.
 */
export class ConditionNoteHandler extends NoteHandler {
  /**
   * Creates a condition-note handler.
   *
   * @param {object} data The submitted form data.
   * @param {object} protoNote Shared data for the new note.
   * @param {TokenDocument[]} tokenDocuments Tokens receiving the effects.
   */
  constructor(data, protoNote, tokenDocuments) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.tokenDocuments = tokenDocuments;
  }

  /**
   * Creates status effects for the selected conditions and returns their note.
   *
   * @returns {Promise<object|undefined>} The created note, if valid.
   */
  async create() {
    if (!this.data.condition) return;

    const conditionEffect = CONFIG.statusEffects.find(statusEffect => statusEffect.name === this.data.condition);
    if (conditionEffect) {
      for (const tokenDoc of this.tokenDocuments) {
        await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
          icon: conditionEffect.img,
          name: conditionEffect.name,
          description: this.protoNote.id,
          statuses: new Set([conditionEffect.id]),
          flags: {
            dnd4e: {
              effectData: {
                // Necessary to prevent a null reference in the dnd4e system.
                durationType: "custom",
              }
            }
          }
        }]);

        const conditionEffect2 = CONFIG.statusEffects.find(statusEffect => statusEffect.name === this.data.condition2);

        if (conditionEffect2) {
          await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
            icon: conditionEffect2.img,
            name: conditionEffect2.name,
            description: this.protoNote.id,
            statuses: new Set([conditionEffect2.id]),
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
      }
    } else {
      ui.notifications.warn(`Condition "${this.data.condition}" not found in CONFIG.statusEffects. Please ensure the condition exists and has a name property.`);
    }

    return foundry.utils.mergeObject(this.protoNote, {
      text: this.data.condition + (this.data.condition2 ? ` & ${this.data.condition2}` : ''),
    });
  }

  /**
   * Removes Active Effects associated with a condition note.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object} note The note being removed.
   * @returns {Promise<void>}
   */
  async clean(token, note) {
    if (!token?.actor) return;
    const effects = token.actor.effects.filter(e => e.description === note.id);
    if (effects.length > 0) {
      for (const effect of effects) {
        await effect.delete();
      }
    }

    super.clean(token, note);
  }
}
