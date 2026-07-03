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
    if (!this.data.modifierType || !this.data.numberValue) return;

    const modifierValue = this._getModifierValue();
    const changeKeys = this._getChangeKeys();

    if (!changeKeys || !modifierValue) {
      ui.notifications.warn("Unsupported modifier type or zero modifier value. Modifier note will not be created.");
      return;
    };

    const changes = changeKeys.map(key => {
      // Effect Modes
      // 0: Custom
      // 1: Multiply
      // 2: Add
      // 3: Downgrade
      // 4: Upgrade
      // 5: Override
      return {
        key: key,
        mode: this.data.modifierBonusType === 'untyped' ? 2 : 4, // They should not stack if we got an type.
        value: modifierValue,
      }
    });

    // Create the effects.
    for (const tokenDoc of this.documents) {
      await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
        name: this.protoNote.id,
        changes: changes,
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

    const noteText = `${modifierValue > 0 ? '+' : ''}${modifierValue} ${this.data.modifierType} (${this.data.modifierBonusType})`;
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
    // Simply return the number value from the spinner
    return Number.parseInt(this.data.numberValue) || 0;
  }

  _getChangeKeys() {
    const modifierPaths = {
      "ac": ["system.defences.ac"],
      "speed": ["system.movement.base"],
      "damage": ["system.modifiers.damage"],
      "savingThrows": ["system.details.saves"],
      "attacks": ["system.modifiers.attack"],
      'defenses': ["system.defences.ac", "system.defences.fort", "system.defences.ref", "system.defences.wil"],
    };

    const basePath = modifierPaths[this.data.modifierType];

    if (!basePath) return;

    return basePath.map(path => path + `.${this.data.modifierBonusType}`);
  }
}