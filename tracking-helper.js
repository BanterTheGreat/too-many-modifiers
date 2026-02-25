export class TrackingHelper {
  static getCombatantDuration(combatant) {
    return { value: `EoT ${combatant.tokenId}`, label: `EoT ${combatant.name}` };
  }

  /// Cleans up all effects related to a note to prevent any weird leftovers.
  static async removeAdditionalNoteEffects(token, note) {
  }

  static formatNotesForDisplay(notes) {
    if (!Array.isArray(notes)) {
      return undefined;
    }

    // We got no notes, so this will result in us not rendering anything.
    if (notes.length === 0) {
      return "";
    }

    var resultArray = notes.map(note => {
      return `${note.text} ◆ ${note.duration}`;
    });

    return resultArray.join("\n");
  }

  static getUserFriendlyDuration(duration, combat) {
    if (duration?.startsWith("EoT ")) {
      const combatantName = duration.replace("EoT ", "");
      const combatant = combat?.combatants.find(c => c.tokenId === combatantName);
      return `EoT ${combatant?.name}`;
    }

    return duration;
  }
}