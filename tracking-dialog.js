const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

import { Constants } from "./constants.js";
import { MODULE_ID } from "./main.js";
import { TrackingHelper } from "./tracking-helper.js";

export class TrackingDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(tokens) {
    const options = {
      window: {
        title: `Editing tracking for ${tokens.length > 1 ? `${tokens.length} tokens` : `"${tokens[0].document.name}"`}`
      },
      position: {
        height: "auto",
        width: 400,
      }
    };

    super(options);
    this.tokens = tokens;
    this.currentTab = 'modifiers';
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
    }
  }

  static async onSubmit(event, form, formData) {
    const data = formData.object;
    const duration = data.durationOverride || data.duration;
    const combatantId = this._getCombatantIfEoT(duration);
    var note = null;

    const protoNote = {
      duration: duration,
      combatantId: combatantId,
      round: this.combat?.round,
      turn: this.combat?.turn,
    };

    switch (this.currentTab) {
      case "conditions":
        note = foundry.utils.mergeObject(protoNote, {
          condition: data.condition,
          text: data.condition,
        });
        break;
      case "ongoing":
        note = foundry.utils.mergeObject(protoNote, {
          ongoingType: data.ongoingType,
          ongoingDamage: data.ongoingDamage,
          text: `Ongoing ${data.ongoingDamage} ${data.ongoingType}`,
        });
        break;
      case "modifiers":
        note = foundry.utils.mergeObject(protoNote, {
          text: `${data.modifierValue > 0 ? '+' : ''}${data.modifierValue} ${data.modifierType}`,
          modifierType: data.modifierType,
          modifierValue: data.modifierValue,
        });
        break;
      case "resistances":
        note = foundry.utils.mergeObject(protoNote, {
          resistanceType: data.resistanceType,
          resistanceValue: data.resistanceValue,
          text: `${data.resistanceValue > 0 ? '+' : ''}${data.resistanceValue} ${data.resistanceType} Resistance`,
        });
        break;
      case "manual":
        note = foundry.utils.mergeObject(protoNote, {
          text: data.manualCondition,
        });
        break;
    }
  }

  get tokenDocuments() { return this.tokens.map(token => token.document); }

  // Get the combat one of the tokens is in, we do not currently support multiple combats at once.
  get combat() { return game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === this.tokenDocuments[0].actor?.id)); }
  get currentCombatant() { return this.combat?.combatants; }

  static PARTS = {
    notes: {
      template: "modules/too-many-modifiers/parts/notes-table.hbs",
    },
    tabs: {
      template: 'templates/generic/tab-navigation.hbs',
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

  static TABS = {
    primary: {
      tabs: [{ id: 'conditions', label: "Conditions" }, { id: 'ongoing', label: "Ongoing" }, { id: 'modifiers', label: "Modifiers" }, { id: 'resistances', label: "Resistances" }, { id: 'manual', label: "Manual" }],
      initial: 'modifiers',
    }
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

    // Duration options
    const durationOptions = [
      { value: Constants.DURATION_ENCOUNTER, label: Constants.DURATION_ENCOUNTER },
      { value: Constants.DURATION_ROUND, label: Constants.DURATION_ROUND },
      { value: Constants.DURATION_SAVE, label: Constants.DURATION_SAVE },
    ];
    if (this.combat) {
      for (const c of this.combat.combatants) {
        durationOptions.push(TrackingHelper.getCombatantDuration(c));
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

    // Default duration: EoT of current combatant if in combat
    const currentCombatant = this.combat?.combatant;
    const defaultDuration = currentCombatant
      ? TrackingHelper.getCombatantDuration(currentCombatant).value
      : "";

    return {
      notes: [...this.getNotes()],
      durations: durationOptions,
      defaultDuration,
      conditions: conditionOptions,
      damageTypes: damageTypeOptions,
      tabs: this._prepareTabs("primary"),

      // Footer
      buttons: [
        { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
      ],
    };
  }

  async _preparePartContext(partId, context) {
    const tab = context.tabs?.[partId];
    if (tab) {
      context.tab = { ...tab };
      // Set active class for initial tab
      if (partId === "modifiers") {
        context.tab.cssClass = "active";
      }
    }
    return context;
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

  _onClickTab(event) {
    const selectedTab = event.srcElement.dataset.tab;
    this.currentTab = selectedTab;

    // Auto-set duration based on selected tab
    const durationSelect = this.element.querySelector('[name="duration"]');
    if (durationSelect) {
      if (selectedTab === "ongoing") {
        durationSelect.value = Constants.DURATION_SAVE;
      } else {
        const currentCombatant = this.combat?.combatant;
        if (currentCombatant) {
          const duration = TrackingHelper.getCombatantDuration(currentCombatant);
          durationSelect.value = duration.value;
        }
      }
    }

    super._onClickTab(event);
  }

  _getCombatantIfEoT(duration) {
    if (duration?.startsWith("EoT ")) {
      const combatantName = duration.replace("EoT ", "");
      const combatant = this.combat?.combatants.find(c => c.name === combatantName);
      return combatant?.id;
    }
  }
}