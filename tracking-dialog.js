const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

import { Constants } from "./constants.js";
import { MODULE_ID } from "./main.js";

export class TrackingDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(tokens) {
    const options = {
      window: {
        title: `Editing tracking for ${tokens.length > 1 ? `${tokens.length} tokens` : `"${tokens[0].document.name}"`}`
      }
    };

    super(options);
    this.tokens = tokens;
  }

  static DEFAULT_OPTIONS = {
    id: "too-much-too-track-dialog",
    tag: "form",
    classes: [],
    actions: {
    }
  }

  get tokenDocuments() { return this.tokens.map(token => token.document); }

  // Get the combat one of the tokens is in, we do not currently support multiple combats at once.
  get combat() { return game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === this.tokenDocuments[0].actor?.id)); }

  static PARTS = {
    notesTable: {
      template: "modules/too-many-modifiers/parts/tracking-notes-table.hbs",
    },
    typeSelect: {
      template: "modules/too-many-modifiers/parts/tracking-type-select.hbs",
    },
    conditionSection: {
      template: "modules/too-many-modifiers/parts/tracking-condition-section.hbs",
    },
    ongoingSection: {
      template: "modules/too-many-modifiers/parts/tracking-ongoing-section.hbs",
    },
    modifierSection: {
      template: "modules/too-many-modifiers/parts/tracking-modifier-section.hbs",
    },
    resistancesSection: {
      template: "modules/too-many-modifiers/parts/tracking-resistances-section.hbs",
    },
    manualSection: {
      template: "modules/too-many-modifiers/parts/tracking-manual-section.hbs",
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Duration options
    const durationOptions = [
      { value: Constants.DURATION_ENCOUNTER, label: Constants.DURATION_ENCOUNTER },
      { value: Constants.DURATION_ROUND, label: Constants.DURATION_ROUND },
      { value: Constants.DURATION_SAVE, label: Constants.DURATION_SAVE },
    ];
    if (this.combat) {
      for (const c of this.combat.combatants) {
        durationOptions.push({ value: `EoT ${c.name}`, label: `EoT ${c.name}` });
      }
    }

    // Condition options
    const conditions = CONFIG.statusEffects || [];
    const conditionOptions = conditions.map(condition => {
      const label = condition.label || condition.name || condition;
      const value = condition.name || condition.id || label;
      return { value, label };
    });

    // Damage type options
    const damageTypes = CONFIG.DND4E?.damageTypes || {};
    const damageTypeOptions = Object.entries(damageTypes).map(([key, label]) => {
      return { value: key, label };
    });

    return foundry.utils.mergeObject(context, {
      notes: [...this.getNotes()],
      durationOptions,
      conditionOptions,
      damageTypeOptions,
    });
  }

  getNotes() {
    console.error(this.tokens);
    console.error(this.tokenDocuments);

    // Only include notes that are present on every selected token (match by text+duration)
    const primaryNotes = this.tokenDocuments[0].getFlag(MODULE_ID, "notes") || [];
    let notesArray = [];
    if (!Array.isArray(primaryNotes)) {
      ui.notifications.warn("Non-Array notes data found on primary token. Resetting notes.");
      notesArray = [];
    } else {
      notesArray = primaryNotes.filter(n => {
        return this.tokenDocuments.every(td => {
          if (td === this.tokenDocuments[0]) return true;
          const otherNotes = td.getFlag(MODULE_ID, "notes");
          return Array.isArray(otherNotes) && otherNotes.some(on => on.text === n.text && on.duration === n.duration);
        });
      });
    }

    return [];
  }
}