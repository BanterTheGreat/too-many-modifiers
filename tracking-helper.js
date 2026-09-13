import { MODULE_ID } from "./constants.js";

/**
 * Provides the Active Effect lifecycle used by the tracking HUD.
 */
export class TrackingHelper {
  /**
   * Combines an effect's displayed text with its selected duration.
   *
   * @param {string} text The effect text.
   * @param {string} duration The human-readable duration.
   * @returns {string} The description displayed in the token overlay.
   */
  static formatEffectDescription(text, duration) {
    return duration ? `${text} ◆ ${duration}` : text;
  }

  /**
   * Deletes module-created effects corresponding to notes selected in the HUD.
   *
   * @param {TokenDocument} token The affected token document.
   * @param {object[]} notes The displayed notes to remove.
   * @returns {Promise<void>}
   */
  static async deleteNotesAndEffects(token, notes) {
    if (!token?.actor || !Array.isArray(notes)) {
      return;
    }

    const effects = TrackingHelper.getTrackedEffects(token).filter(effect => {
      return notes.some(note => note.text === effect.description && note.duration === effect.duration.label);
    });
    if (effects.length > 0) {
      await token.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(effect => effect.id));
    }
  }

  /**
   * Formats every temporary Active Effect description for the token overlay.
   *
   * @param {TokenDocument} token The token whose effect descriptions are displayed.
   * @returns {string|undefined} Newline-separated effect descriptions.
   */
  static formatNotesForDisplay(token) {
    if (!token?.actor) {
      return undefined;
    }

    return token.actor.effects
      .filter(effect => effect.isTemporary && effect.description)
      .map(effect => effect.description)
      .join("\n");
  }

  /**
   * Gets effects created by this module for the HUD's removal table.
   *
   * @param {TokenDocument} token The token document to inspect.
   * @returns {ActiveEffect[]} The module-created effects.
   */
  static getTrackedEffects(token) {
    if (!token?.actor) {
      return [];
    }

    return token.actor.effects.filter(effect => effect.getFlag(MODULE_ID, "tracked"));
  }
}
