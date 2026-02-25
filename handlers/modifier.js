export class ModifierNoteHandler {
  constructor(data, protoNote, documents, combat) {
    this.data = data;
    this.protoNote = protoNote;
    this.documents = documents;
    this.combat = combat;
  }

  async create() {
    if (!this.data.modifierType || (!this.data.scoreValue && !this.data.numberValue)) return;

    const modifierValue = this._getModifierValue();

    // Create the effect.
    

    return foundry.utils.mergeObject(this.protoNote, {
      text: `${modifierValue > 0 ? '+' : ''}${modifierValue} ${this.data.modifierType} (${this.data.modifierBonusType})`,
      modifierType: this.data.modifierType,
      modifierValue: modifierValue,
    });
  }

  async clean(token, note) {
    if (!token?.actor) return;

    const actor = token.actor;
    const modifierType = note.modifierType;
    const bonusName = `too-many-modifiers: ${note.text}`;
    if (!modifierType) return;

    const modifierPaths = {
      'AC': 'system.defences.ac.bonus',
      'Speed': 'system.movement.base.bonus',
      'Damage': 'system.modifiers.damage.bonus',
      'Saving Throws': 'system.details.saves.bonus',
      'Attacks': 'system.modifiers.attack.bonus',
    };

    const path = modifierPaths[modifierType];
    if (path) {
      const bonus = foundry.utils.getProperty(actor, path) || [];
      const updatedBonus = bonus.filter(b => b.name !== bonusName);
      await actor.update({ [path]: updatedBonus });
    } else {
      ui.notifications.warn(`Modifier type "${modifierType}" is not supported yet.`);
    }
  }

  _getModifierValue() {
    if (this.data.scoreValue && !this.data.numberValue) {
      // We got an ability score and no number, we use the ability score.
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

      let ability = this.data.scoreValue;

      const abilityProperty = abilityMap[ability];
      let value = originToken.actor.system.abilities[abilityProperty].mod;

      // We checked that it is a penalty. Turn the value negative.
      if (value > 0 && this.data.isNegativeModifier === "true") {
        value = -value;
      }

      return value;
    } else {
      return this.data.numberValue;
    }
  }
}