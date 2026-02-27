import { ConditionNoteHandler } from "./handlers/condition.js";
import { OngoingNoteHandler } from "./handlers/ongoing.js";
import { ModifierNoteHandler } from "./handlers/modifier.js";
import { ResistanceNoteHandler } from "./handlers/resistance.js";
import { ManualNoteHandler } from "./handlers/manual.js";
import { MODULE_ID } from "./constants.js";

export class TrackingHelper {
  static getCombatantDuration(combatant) {
    return { value: `EoT ${combatant.tokenId}`, label: `EoT ${combatant.name}` };
  }

  /// Cleans up all effects related to a note to prevent any weird leftovers.
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

  /// For linked actors, gets the note data from the actor.
  /// For unlinked actors, gets the note data from the token.
  /// This is done because otherwise we might later get rid of the token, but the side effects remain.
  static getNoteFlags(token) {
    console.error(token);
    if (token.actorLink) {
      return token.actor.getFlag(MODULE_ID, "notes") || [];
    } else {
      return token.getFlag(MODULE_ID, "notes") || [];
    }
  }

  /// For linked actors, sets the note data on the actor.
  /// For unlinked actors, sets the note data on the token.
  /// This is done because otherwise we might later get rid of the token, but the side effects remain.
  static async setNoteFlags(token, notes) {
    if (token.actorLink) {
      return await token.actor.setFlag(MODULE_ID, "notes", notes);
    } else {
      return await token.setFlag(MODULE_ID, "notes", notes);
    }
  }
}