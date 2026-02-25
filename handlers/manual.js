export class ManualNoteHandler {
  constructor(data, protoNote) {
    this.data = data;
    this.protoNote = protoNote;
  }

  async create() {
    if (!this.data.manualCondition) return;

    return foundry.utils.mergeObject(this.protoNote, {
      text: this.data.manualCondition,
    });
  }

  async clean() {
    // Has no effects to clean up.
    return;
  }
}
