import { MODULE_ID } from "../constants.js";

/**
 * Defines the common lifecycle for a tracked note type.
 */
export class NoteHandler {
  constructor() {
  };

  /**
   * Removes side effects associated with a note.
   *
   * @param {TokenDocument} tokenDoc The affected token document.
   * @param {object} note The tracked note.
   * @returns {Promise<void>}
   */
  async clean(tokenDoc, note) {
    return;
  }
}
