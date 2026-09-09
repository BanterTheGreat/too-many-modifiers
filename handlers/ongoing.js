import { NoteHandler } from "./base.js";

/**
 * Creates ongoing-damage notes without Active Effects.
 */
export class OngoingNoteHandler extends NoteHandler {
  /**
   * Creates an ongoing-damage handler.
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
   * Creates a note describing ongoing damage.
   *
   * @returns {Promise<object|undefined>} The created note, if valid.
   */
  async create() {
    if (!this.data.ongoingType || !this.data.ongoingDamage) return;

    return foundry.utils.mergeObject(this.protoNote, {
      ongoingType: this.data.ongoingType,
      ongoingDamage: this.data.ongoingDamage,
      text: `Ongoing ${this.data.ongoingDamage} ${this.data.ongoingType}`,
    });
  }

  /**
   * Cleans an ongoing-damage note; it has no associated effects.
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
