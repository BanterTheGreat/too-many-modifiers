import { NoteHandler } from "./base.js";

export class ModifierNoteHandler extends NoteHandler {
  constructor(data, protoNote, documents, combat) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.documents = documents;
    this.combat = combat;
  }

  async create() {
    if (!this.data.modifierType || (!this.data.scoreValue && !this.data.numberValue)) return;

    const modifierValue = this._getModifierValue();
    const changeKey = this._getChangeKey();

    if (!changeKey || !modifierValue) {
      ui.notifications.warn("Unsupported modifier type or zero modifier value. Modifier note will not be created.");
      return;
    };

    const noteText = `${modifierValue > 0 ? '+' : ''}${modifierValue} ${this.data.modifierType} (${this.data.modifierBonusType})`;

    // Create the effects.
    for (const tokenDoc of this.documents) {
      await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
        name: this.protoNote.id,
        changes: [
          // Effect Modes
          // 0: Custom
          // 1: Multiply
          // 2: Add
          // 3: Downgrade
          // 4: Upgrade
          // 5: Override
          {
            key: changeKey,
            mode: this.data.modifierBonusType === 'untyped' ? 2 : 4, // They should not stack if we got an type.
            value: modifierValue,
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
      text: noteText,
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

  _getChangeKey() {
    const modifierPaths = {
      "ac": "system.defences.ac",
      "speed": "system.movement.base",
      "damage": "system.modifiers.damage",
      "savingThrows": "system.details.saves",
      "attacks": "system.modifiers.attack",
    };

    const basePath = modifierPaths[this.data.modifierType];

    if (!basePath) return;

    return basePath + `.${this.data.modifierBonusType}`;
  }
}