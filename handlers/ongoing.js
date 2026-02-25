import { NoteHandler } from "./base.js";

export class OngoingNoteHandler extends NoteHandler {
  constructor(data, protoNote) {
    super();
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!this.data.ongoingType || !this.data.ongoingDamage) return;

    return foundry.utils.mergeObject(this.protoNote, {
      ongoingType: this.data.ongoingType,
      ongoingDamage: this.data.ongoingDamage,
      text: `Ongoing ${this.data.ongoingDamage} ${this.data.ongoingType}`,
    });
  }

  async clean(token, note) {
    super.clean(token, note);
    // Has no effects to clean up.
    return;
  }
}
