export class ModifierNoteHandler {
  constructor(data, protoNote) {
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!this.data.modifierType || (!this.data.scoreValue && !this.data.numberValue)) return;

    const modifierValue = this._getModifierValue();

    return foundry.utils.mergeObject(this.protoNote, {
      text: `${modifierValue > 0 ? '+' : ''}${modifierValue} ${this.data.modifierType}`,
      modifierType: this.data.modifierType,
      modifierValue: modifierValue,
    });
  }

  async clean() {
    return;
  }

  _getModifierValue() {
    // We got an ability score and no number, we use the ability score.
    if (this.data.scoreValue && !this.data.numberValue) {
      const originToken = this.combat.combatants.find(combatant => combatant.tokenId === this.data.origin);
      if (!originToken) {
        ui.notifications.error("Selected origin token not found in combat.");
        return;
      }

      const abilityMap = {
        'strength': 'str',
        'dexterity': 'dex',
        'constitution': 'con',
        'intelligence': 'int',
        'wisdom': 'wis',
        'charisma': 'cha'
      };

      let ability = this.data.origin;
      let multiplier = 1;

      if (ability.startsWith('minus-')) {
        multiplier = -1;
        ability = ability.replace('minus-', '');
      }

      const abilityProperty = abilityMap[ability];
      const value = originToken.actor.system.abilities[abilityProperty].mod;

      return value < 0 ? value : multiplier * value;
    } else {
      return this.data.numberValue;
    }
  }
}