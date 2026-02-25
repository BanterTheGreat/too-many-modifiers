export class ResistanceNoteHandler {
  constructor(data, protoNote) {
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!this.data.resistanceType || !this.data.resistanceValue) return;

    return foundry.utils.mergeObject(this.protoNote, {
      resistanceType: this.data.resistanceType,
      resistanceValue: this.data.resistanceValue,
      text: `${this.data.resistanceValue > 0 ? '+' : ''}${this.data.resistanceValue} ${this.data.resistanceType} Resistance`,
    });
  }

  async clean(token, note) {
    if (!token?.actor) return;

    const resistanceType = note.resistanceType;
    const bonusName = `too-many-modifiers: ${note.text}`;
    if (!resistanceType) return;

    const resistancePath = `system.resistances.${resistanceType}.bonus`;
    const resistanceBonus = foundry.utils.getProperty(token.actor, resistancePath) || [];
    const updatedResistanceBonus = resistanceBonus.filter(b => b.name !== bonusName);
    await token.actor.update({ [resistancePath]: updatedResistanceBonus });
  }
}
