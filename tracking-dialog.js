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
    this.uiState = "modifiers";
  }

  static DEFAULT_OPTIONS = {
    id: "too-much-too-track-dialog",
    tag: "form",
    form: {
      handler: TrackingDialog.onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    classes: [],
    actions: {
      switchTab: TrackingDialog.#onSwitchTab,
    }
  }

  static async onSubmit(event, form, formData) {
    console.error(event);
    console.error(form);
    console.error(formData);
  }

  get tokenDocuments() { return this.tokens.map(token => token.document); }

  // Get the combat one of the tokens is in, we do not currently support multiple combats at once.
  get combat() { return game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === this.tokenDocuments[0].actor?.id)); }

  static PARTS = {
    notes: {
      template: "modules/too-many-modifiers/parts/notes-table.hbs",
    },
    tabs: {
      template: "modules/too-many-modifiers/parts/type-select.hbs",
    },
    conditions: {
      template: "modules/too-many-modifiers/parts/condition-section.hbs",
    },
    ongoing: {
      template: "modules/too-many-modifiers/parts/ongoing-section.hbs",
    },
    modifiers: {
      template: "modules/too-many-modifiers/parts/modifier-section.hbs",
    },
    resistances: {
      template: "modules/too-many-modifiers/parts/resistances-section.hbs",
    },
    manual: {
      template: "modules/too-many-modifiers/parts/manual-section.hbs",
    },
    duration: {
      template: "modules/too-many-modifiers/parts/duration-section.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  }

  /** @override */
  _configureRenderOptions(options) {
    // This fills in `options.parts` with an array of ALL part keys by default
    // So we need to call `super` first
    super._configureRenderOptions(options);
    // Completely overriding the parts
    options.parts = [];

    if (this.getNotes().length > 0) {
      options.parts.push("notes");
    }

    options.parts.push("tabs");
    options.parts.push(this.uiState);
    options.parts.push("duration");
    options.parts.push("footer");
  }

  /** @override */
  _replaceHTML(result, content, options) {
    const validParts = new Set(options.parts);

    // Remove all existing part elements not in the current render set.
    for (const el of [...this.element.querySelectorAll("[data-application-part]")]) {
      if (!validParts.has(el.dataset.applicationPart)) {
        el.remove();
      }
    }

    // Let the parent insert/replace rendered parts.
    super._replaceHTML(result, content, options);
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
      durations: durationOptions,
      conditions: conditionOptions,
      damageTypes: damageTypeOptions,
      activeTab: this.uiState,

      // Footer
      buttons: [
        { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
      ],
    });
  }

  static #onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (tab && tab !== this.uiState) {
      this.uiState = tab;
      this.render();
    }
  }

  getNotes() {

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