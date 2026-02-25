export class ModifierNoteHandler {
  constructor(data, protoNote) {
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!data.modifierType || (!data.scoreValue && !data.numberValue)) return;
    let modifierValue;

    // We got an ability score and no number, we use the ability score.
    if (data.scoreValue && !data.numberValue) {
      const originToken = this.combat.combatants.find(combatant => combatant.tokenId === data.origin);
      if (!originToken) {
        ui.notifications.warn("Selected origin token not found in combat.");
        return;
      }
    } else {
      modifierValue = data.numberValue;
    }

    console.error(this.combat.combatant);

    return foundry.utils.mergeObject(protoNote, {
      text: `${data.modifierValue > 0 ? '+' : ''}${data.modifierValue} ${data.modifierType}`,
      modifierType: data.modifierType,
      modifierValue: data.numberValue,
    });
  }
}