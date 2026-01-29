export class CombatManager {
  static onCombatRound(combat, roundObject) {
    const round = roundObject.round;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const actor = combatant.actor;
      if (!actor) return;

      // Get the actor's tokens
      const tokens = canvas.tokens?.placeables.filter(t => t.actor?.id === actor.id);

      tokens?.forEach(token => {
        const tokenDocument = token.document;
        let notesArray = tokenDocument.getFlag("too-many-modifiers", "notes") || [];

        if (!Array.isArray(notesArray)) return;

        // Filter out notes with duration "Round" whose round is lower than current round
        const updatedNotesArray = notesArray.filter(note => {
          if (note.duration === "Round" && note.round !== undefined && note.round < round) {
            return false; // Remove this note
          }
          return true; // Keep this note
        });

        // Update the flag if notes were removed
        if (updatedNotesArray.length !== notesArray.length) {
          tokenDocument.setFlag("too-many-modifiers", "notes", updatedNotesArray);
        }
      });
    });
  }

  static onCombatTurnChange(combat, previous, current) {
    const previousRound = previous.round;
    const previousTurn = previous.turn;
    const previousCombatantId = previous.combatantId;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const actor = combatant.actor;
      if (!actor) return;

      // Get the actor's tokens
      const tokens = canvas.tokens?.placeables.filter(t => t.actor?.id === actor.id);

      tokens?.forEach(token => {
        const tokenDocument = token.document;
        let notesArray = tokenDocument.getFlag("too-many-modifiers", "notes") || [];

        if (!Array.isArray(notesArray)) return;

        const updatedNotesArray = notesArray.filter(note => {
          // Only process notes that have the same combatantId as the previous combatant
          if (note.combatantId !== previousCombatantId) {
            return true; // Keep notes not belonging to previous combatant
          }

          const noteRound = note.round;
          const noteTurn = note.turn;

          // Remove if:
          // - Current round is higher than note round, OR
          // - Current round equals note round and current turn is higher than note turn

          console.log(previousRound);
          console.log(previousTurn);

          console.log(noteRound);
          console.log(noteTurn);
          if (noteRound !== undefined && noteTurn !== undefined) {
            if (previousRound > noteRound || (previousRound === noteRound && previousTurn > noteTurn)) {
              return false; // Remove this note
            }
          }

          return true; // Keep this note
        });

        // Update the flag if notes were removed
        if (updatedNotesArray.length !== notesArray.length) {
          tokenDocument.setFlag("too-many-modifiers", "notes", updatedNotesArray);
        }
      });
    });
  }
}