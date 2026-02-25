import { NoteHandler } from "./base.js";

export class ManualNoteHandler extends NoteHandler {
  constructor(data, protoNote) {
    super();
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!this.data.manualCondition) return;

    return foundry.utils.mergeObject(this.protoNote, {
      text: this.data.manualCondition,
    });
  }

  async clean(token, note) {
    super.clean(token, note);
    // Has no effects to clean up.
    return;
  }
}
