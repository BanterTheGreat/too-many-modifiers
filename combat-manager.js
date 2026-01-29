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
        removedNotes.forEach(async note => {
          game.combatManager._removeConditionEffect(token, note.text);
          await game.combatManager._removeModifierBonus(token, note);
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
    game.combatManager._resolveOngoingDamage(combat, current);
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
        await game.combatManager._removeModifierBonus(token, note);
        game.combatManager._createRemovedNotesMessage(token.name, [note]);
      }
    });
  }

  _resolveOngoingDamage(combat, current) {
    const currentCombatantId = current.combatantId;
    const currentCombatant = combat.combatants.find(c => c.id === currentCombatantId);
    const token = currentCombatant?.token;

    if (!token) return;

    let notesArray = token.getFlag("too-many-modifiers", "notes") || [];

    if (!Array.isArray(notesArray)) return;

    // Find notes with "Ongoing" condition
    const ongoingNotes = notesArray.filter(note => !!note?.ongoingType && !!note?.ongoingDamage);
    ongoingNotes.forEach(async note => {
      const damageRoll = new Roll(`${note.ongoingDamage}[${note.ongoingType}]`);
      const damageResult = await damageRoll.evaluate();
      const damageTotal = damageResult.total;

      const flavorText = `<p><strong>${token.name}</strong> takes <strong>${damageTotal}</strong> ongoing ${note.ongoingType} damage</p>`;

      await damageResult.toMessage({
        flavor: flavorText
      });
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
        removedNotes.forEach(async note => {
          game.combatManager._removeConditionEffect(token, note.text);
          await game.combatManager._removeModifierBonus(token, note);
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

  async _removeModifierBonus(token, note) {
    if (!token?.actor) return;

    const actor = token.actor;
    const modifierType = note.modifierType;
    const bonusName = `too-many-modifiers: ${note.text}`;

    console.log(note);
    console.log(modifierType);

    switch (modifierType) {
      case 'AC':
        const acBonus = actor.system.defences.ac.bonus || [];
        const updatedAcBonus = acBonus.filter(b => b.name !== bonusName);

        console.log(acBonus);
        console.log(updatedAcBonus);
        await actor.update({ 'system.defences.ac.bonus': updatedAcBonus });
        break;
      case 'Speed':
        const speedBonus = actor.system.movement.base.bonus || [];
        const updatedSpeedBonus = speedBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.movement.base.bonus': updatedSpeedBonus });
        break;
      case 'Damage':
        const damageBonus = actor.system.modifiers.damage.bonus || [];
        const updatedDamageBonus = damageBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.modifiers.damage.bonus': updatedDamageBonus });
        break;
      case 'Saving Throws':
        const saveBonus = actor.system.details.saves.bonus || [];
        const updatedSaveBonus = saveBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.details.saves.bonus': updatedSaveBonus });
        break;
      case 'Attacks':
        const attackBonus = actor.system.modifiers.attack.bonus || [];
        const updatedAttackBonus = attackBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.modifiers.attack.bonus': updatedAttackBonus });
        break;
      default:
        ui.notifications.warn(`Modifier type "${modifierType}" is not supported yet.`);
        break;
    }
  }
}