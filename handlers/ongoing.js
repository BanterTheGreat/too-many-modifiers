export class OngoingNoteHandler {
  constructor(data, protoNote) {
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

  async clean() {
    // Has no effects to clean up.
    return;
  }
}
