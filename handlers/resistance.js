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
      if (this.data.resistanceValue > 0) {
        await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
          name: this.protoNote.id,
          changes: [
            {
              key: `system.resistances.${this.data.resistanceType}.res`,
              mode: 4, // They should not stack.
              value: Math.abs(this.data.resistanceValue), // Should always be positive, we send it to the bonus field if it is negative.
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
      } else {
        const actor = tokenDoc.actor;
        const bonus = {
          active: true,
          name: this.protoNote.id,
          note: 'tmtt-resistance',
          value: this.data.resistanceValue,
        };

        const resistancePath = `system.resistances.${this.data.resistanceType}.bonus`;
        const resistanceBonus = getProperty(actor, resistancePath) || [];
        resistanceBonus.push(bonus);
        await actor.update({ [resistancePath]: resistanceBonus });
      }
    }

    return foundry.utils.mergeObject(this.protoNote, {
      resistanceType: this.data.resistanceType,
      resistanceValue: this.data.resistanceValue,
      text: `${this.data.resistanceValue > 0 ? '+' : ''}${this.data.resistanceValue} ${this.data.resistanceType} Resistance`,
    });
  }

  async clean(token, note) {
    if (!token?.actor) return;
    
    if (note.resistanceValue > 0) {
      // HACK: Auto-calculate seems to only work for resistances. Vulnerabilities go through the bonus dialog.
      const effect = token.actor.effects.find(e => e.name === note.id);
      if (effect) {
        await effect.delete();
      }
    } else {
      const resistanceType = note.resistanceType;
      if (!resistanceType) return;
      
      const resistancePath = `system.resistances.${resistanceType}.bonus`;
      const resistanceBonus = getProperty(token.actor, resistancePath) || [];
      const updatedResistanceBonus = resistanceBonus.filter(b => b.name !== note.id);
      await token.actor.update({ [resistancePath]: updatedResistanceBonus });
    }

    super.clean(token, note);
  }
}
