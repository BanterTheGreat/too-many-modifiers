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
