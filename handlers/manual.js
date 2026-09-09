import { NoteHandler } from "./base.js";

/**
 * Creates free-form notes without mechanical side effects.
 */
export class ManualNoteHandler extends NoteHandler {
  /**
   * Creates a manual-note handler.
   *
   * @param {object} data The submitted form data.
   * @param {object} protoNote Shared data for the new note.
   */
  constructor(data, protoNote) {
    super();
    this.data = data;
    this.protoNote = protoNote;
  }

  /**
   * Creates a note from the entered manual condition.
   *
   * @returns {Promise<object|undefined>} The created note, if valid.
   */
  async create() {
    if (!this.data.manualCondition) return;

    return foundry.utils.mergeObject(this.protoNote, {
      text: this.data.manualCondition,
    });
  }

  /**
   * Cleans a manual note; it has no associated effects.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object} note The note being removed.
   * @returns {Promise<void>}
   */
  async clean(token, note) {
    super.clean(token, note);
    // Has no effects to clean up.
    return;
  }
}
