import { ConditionNoteHandler } from "./handlers/condition.js";
import { OngoingNoteHandler } from "./handlers/ongoing.js";
import { ModifierNoteHandler } from "./handlers/modifier.js";
import { ResistanceNoteHandler } from "./handlers/resistance.js";
import { ManualNoteHandler } from "./handlers/manual.js";
import { MODULE_ID } from "./constants.js";

/**
 * Provides shared note storage, cleanup, and display helpers.
 */
export class TrackingHelper {
  /**
   * Builds a duration option for a combatant's end of turn.
   *
   * @param {Combatant} combatant The combatant to use as the origin.
   * @returns {{value: string, label: string}} The duration option.
   */
  static getCombatantDuration(combatant) {
    return { value: `EoT ${combatant.tokenId}`, label: `EoT ${combatant.name}` };
  }

  /**
   * Cleans up effects related to notes and removes the notes from storage.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object[]} notes The notes to remove.
   * @returns {Promise<void>}
   */
  static async deleteNotesAndEffects(token, notes) {
    const handlers = {
      // Somewhat scuffed, but the handlers have a clean function that does not require any class data.
      conditions: new ConditionNoteHandler(),
      ongoing: new OngoingNoteHandler(),
      modifiers: new ModifierNoteHandler(),
      resistances: new ResistanceNoteHandler(),
      manual: new ManualNoteHandler(),
    };

    for (const note of notes) {
      const noteHandler = handlers[note.type];
      if (noteHandler) {
        await noteHandler.clean(token, note);
      } else {
        ui.notifications.warn(`No handler found for note type "${note.type}". Please ensure the type is correct and a handler exists.`);
        return;
      }
    }

    const tokenNotes = TrackingHelper.getNoteFlags(token);
    const newTokenNotes = tokenNotes.filter(n => !notes.map(x => x.id).includes(n.id));

    // Keep track of removed notes
    await TrackingHelper.setNoteFlags(token, newTokenNotes);
  }

  /**
   * Formats notes for the token overlay.
   *
   * @param {object[]|unknown} notes The note data to format.
   * @returns {string|undefined} Newline-separated note text, or undefined for invalid data.
   */
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

  /**
   * Replaces an end-of-turn token ID with its combatant name.
   *
   * @param {string} duration The stored duration.
   * @param {Combat} combat The active combat, if any.
   * @returns {string} A display-friendly duration.
   */
  static getUserFriendlyDuration(duration, combat) {
    if (duration?.startsWith("EoT ")) {
      const combatantName = duration.replace("EoT ", "");
      const combatant = combat?.combatants.find(c => c.tokenId === combatantName);
      return `EoT ${combatant?.name}`;
    }

    return duration;
  }

  /**
   * Reads notes from the actor for linked tokens, otherwise from the token.
   *
   * @param {TokenDocument} token The token document to inspect.
   * @returns {object[]} The stored notes.
   */
  static getNoteFlags(token) {
    if (token.actorLink) {
      return token.actor.getFlag(MODULE_ID, "notes") || [];
    } else {
      return token.getFlag(MODULE_ID, "notes") || [];
    }
  }

  /**
   * Stores notes on the actor for linked tokens, otherwise on the token.
   *
   * @param {TokenDocument} token The token document to update.
   * @param {object[]} notes The notes to store.
   * @returns {Promise<unknown>} The Foundry flag-update result.
   */
  static async setNoteFlags(token, notes) {
    if (token.actorLink) {
      return await token.actor.setFlag(MODULE_ID, "notes", notes);
    } else {
      return await token.setFlag(MODULE_ID, "notes", notes);
    }
  }
}
