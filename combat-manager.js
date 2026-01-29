export class CombatManager {
  static onCombatRound(combat, roundObject) {
    if (!game.user.isGM) return;
    
    const round = roundObject.round;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const token = combatant.token;
      if (!token) return;

      console.log(token);
      let notesArray = token.getFlag("too-many-modifiers", "notes") || [];

      if (!Array.isArray(notesArray)) return;

      // Find notes to remove
      const removedNotes = [];
      const updatedNotesArray = notesArray.filter(note => {
        if (note.duration === "Round" && note.round !== undefined && note.round < round) {
          removedNotes.push(note);
          return false; // Remove this note
        }
        return true; // Keep this note
      });

      // Update the flag if notes were removed
      if (updatedNotesArray.length !== notesArray.length) {
        token.setFlag("too-many-modifiers", "notes", updatedNotesArray);

        // Create chat message with removed notes
        game.combatManager._createRemovedNotesMessage(token.name, removedNotes, "Round ended");
      }
    });
  }

  static onCombatTurnChange(combat, previous, current) {
    if (!game.user.isGM) return;
    
    const previousRound = previous.round;
    const previousTurn = previous.turn;
    const previousCombatantId = previous.combatantId;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const token = combatant.token;
      if (!token) return;

      console.log(token);
      let notesArray = token.getFlag("too-many-modifiers", "notes") || [];

      if (!Array.isArray(notesArray)) return;

      // Find notes to remove
      const removedNotes = [];
      const updatedNotesArray = notesArray.filter(note => {
        // Only process notes that have the same combatantId as the previous combatant
        if (note.combatantId !== previousCombatantId) {
          return true; // Keep notes not belonging to previous combatant
        }

        const noteRound = note.round;
        const noteTurn = note.turn;

        // Remove if:
        // - Previous round is higher than note round, OR
        // - Previous round equals note round and previous turn is higher than note turn
        if (noteRound !== undefined && noteTurn !== undefined) {
          if (previousRound > noteRound || (previousRound === noteRound && previousTurn > noteTurn)) {
            removedNotes.push(note);
            return false; // Remove this note
          }
        }

        return true; // Keep this note
      });

      // Update the flag if notes were removed
      if (updatedNotesArray.length !== notesArray.length) {
        token.setFlag("too-many-modifiers", "notes", updatedNotesArray);

        // Create chat message with removed notes
        game.combatManager._createRemovedNotesMessage(token.name, removedNotes, "End of turn");
      }

    });
  }

  _createRemovedNotesMessage(tokenName, removedNotes, reason) {
    const notesList = removedNotes.map(note => `<li>${note.text} (${note.duration})</li>`).join('');
    const content = `
        Removing notes from <strong>${tokenName}</strong><br>
        <ul>${notesList}</ul>
    `;

    ChatMessage.create({
      content: content,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }
}