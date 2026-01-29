import { Constants } from "./constants.js";

export class CombatManager {
  static onCombatRound(combat, roundObject) {
    if (!game.user.isGM) return;

    const round = roundObject.round;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const token = combatant.token;
      if (!token) return;

      let notesArray = token.getFlag("too-many-modifiers", "notes") || [];

      if (!Array.isArray(notesArray)) return;

      // Find notes to remove
      const removedNotes = [];
      const updatedNotesArray = notesArray.filter(note => {
        if (note.duration === Constants.DURATION_ROUND && note.round !== undefined && note.round < round) {
          removedNotes.push(note);
          return false; // Remove this note
        }
        return true; // Keep this note
      });

      // Update the flag if notes were removed
      if (updatedNotesArray.length !== notesArray.length) {
        token.setFlag("too-many-modifiers", "notes", updatedNotesArray);

        // Remove corresponding active effects
        removedNotes.forEach(note => {
          game.combatManager._removeConditionEffect(token, note.text);
        });

        // Create chat message with removed notes
        game.combatManager._createRemovedNotesMessage(token.name, removedNotes);
      }
    });
  }

  static onCombatTurnChange(combat, previous, current) {
    if (!game.user.isGM) return;

    game.combatManager._rollSavingThrows(combat, previous);
    game.combatManager._removeEndOfTurnNotes(combat, previous);
  }

  _rollSavingThrows(combat, previous) {
    const previousCombatantId = previous.combatantId;
    const previousCombatant = combat.combatants.find(c => c.id === previousCombatantId);
    const token = previousCombatant?.token;

    if (!token) return;

    let notesArray = token.getFlag("too-many-modifiers", "notes") || [];

    if (!Array.isArray(notesArray)) return;

    // Find notes with "Save Ends" duration
    const saveEndsNotes = notesArray.filter(note => note.duration === Constants.DURATION_SAVE);

    // Create a chat message for each "Save Ends" note
    saveEndsNotes.forEach(async note => {
      let savingThrowBonus = token.actor.system.details.saves.value;

      const roll = new Roll(`1d20 + ${savingThrowBonus}`);
      const rollResult = await roll.evaluate();
      const rollTotal = rollResult.total;
      const success = rollTotal >= 10;

      const flavorText = `<p><strong>${token.name}</strong> makes a saving throw against: <strong>${note.text}</strong></p>
        <p>Result: ${success ? '<span style="color: green;"><strong>Success!</strong></span>' : '<span style="color: red;"><strong>Failed</strong></span>'}</p>`;

      await rollResult.toMessage({
        flavor: flavorText
      });

      // If successful, remove the note immediately
      if (success) {
        const updatedNotesArray = notesArray.filter(n => n !== note);
        token.setFlag("too-many-modifiers", "notes", updatedNotesArray);
        game.combatManager._removeConditionEffect(token, note.text);
        game.combatManager._createRemovedNotesMessage(token.name, [note]);

      }
    });
  }

  _removeEndOfTurnNotes(combat, previous) {
    const previousRound = previous.round;
    const previousTurn = previous.turn;
    const previousCombatantId = previous.combatantId;

    // Loop through each combatant
    combat.combatants.forEach(combatant => {
      const token = combatant.token;
      if (!token) return;

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

        // Remove corresponding active effects
        removedNotes.forEach(note => {
          game.combatManager._removeConditionEffect(token, note.text);
        });

        // Create chat message with removed notes
        game.combatManager._createRemovedNotesMessage(token.name, removedNotes);
      }

    });
  }

  _createRemovedNotesMessage(tokenName, removedNotes) {
    const notesList = removedNotes.map(note => `<li>${note.text} (${note.duration})</li>`).join('');
    const content = `
        Removing notes & conditions from <strong>${tokenName}</strong><br>
        <ul>${notesList}</ul>
    `;

    ChatMessage.create({
      content: content,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }

  _removeConditionEffect(token, conditionName) {
    if (!token?.actor) return;

    const actor = token.actor;
    const effect = actor.effects.find(e => e.name === conditionName);

    if (effect) {
      effect.delete();
    }
  }
}