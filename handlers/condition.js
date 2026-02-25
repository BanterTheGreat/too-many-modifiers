import { NoteHandler } from "./base.js";

export class ConditionNoteHandler extends NoteHandler {
  constructor(data, protoNote, tokenDocuments) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.tokenDocuments = tokenDocuments;
  }

  async create() {
    if (!this.data.condition) return;

    const conditionEffect = CONFIG.statusEffects.find(statusEffect => statusEffect.name === this.data.condition);
    if (conditionEffect) {
      for (const tokenDoc of this.tokenDocuments) {
        await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
          icon: conditionEffect.img,
          name: conditionEffect.name,
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
      }
    } else {
      ui.notifications.warn(`Condition "${this.data.condition}" not found in CONFIG.statusEffects. Please ensure the condition exists and has a name property.`);
    }

    return foundry.utils.mergeObject(this.protoNote, {
      condition: this.data.condition,
      text: this.data.condition,
    });
  }

  async clean(token, note) {
    if (!token?.actor) return;
    const conditionName = note.text;
    const effect = token.actor.effects.find(e => e.name === conditionName);
    if (effect) {
      await effect.delete();
    }

    super.clean(token, note);
  }
}
