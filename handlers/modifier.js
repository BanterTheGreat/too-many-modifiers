import { NoteHandler } from "./base.js";

/**
 * Creates and removes Active Effects for numeric modifiers.
 */
export class ModifierNoteHandler extends NoteHandler {
  /**
   * Creates a modifier-note handler.
   *
   * @param {object} data The submitted form data.
   * @param {object} protoNote Shared data for the new note.
   * @param {TokenDocument[]} documents Tokens receiving the effects.
   * @param {Combat} combat The active combat, if any.
   */
  constructor(data, protoNote, documents, combat) {
    super();
    this.data = data;
    this.protoNote = protoNote;
    this.documents = documents;
    this.combat = combat;
  }

  /**
   * Creates modifier Active Effects and returns their tracking note.
   *
   * @returns {Promise<object|undefined>} The created note, if valid.
   */
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
        // DnD4e 0.9.3 reads this directly during ActiveEffect._preCreate.
        system: {
          durationType: "custom",
        },
      }]);
    }

    const noteText = `${modifierValue > 0 ? '+' : ''}${modifierValue} ${this.data.modifierType} (${this.data.modifierBonusType})`;
    return foundry.utils.mergeObject(this.protoNote, {
      text: noteText,
    });
  }

  /**
   * Removes the Active Effect associated with a modifier note.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object} note The note being removed.
   * @returns {Promise<void>}
   */
  async clean(token, note) {
    if (!token?.actor) return;

    const effect = token.actor.effects.find(e => e.name === note.id);
    if (effect) {
      await effect.delete();
    }

    super.clean(token, note);
  }

  /**
   * Parses the modifier spinner value.
   *
   * @returns {number} The numeric modifier, or zero when invalid.
   */
  _getModifierValue() {
    // Simply return the number value from the spinner
    return Number.parseInt(this.data.numberValue) || 0;
  }

  /**
   * Maps the selected modifier type to DnD4e effect paths.
   *
   * @returns {string[]|undefined} The change keys for the selected type.
   */
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
