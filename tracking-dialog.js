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
    this.currentTab = 'modifiers';
    this.tokens = tokens;
    this.combat = game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === this.tokenDocuments[0].actor?.id));
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
    console.error(formData.object);

    const data = formData.object;
    const duration = data.durationOverride || data.duration;
    const combatantId = this._getCombatantIfEoT(duration);
    var note = null;

    const protoNote = {
      duration: duration,
      id: foundry.utils.randomID(),
      combatantId: combatantId,
      round: this.combat?.round,
      turn: this.combat?.turn,
      type: this.currentTab,
    };

    switch (this.currentTab) {
      case "conditions":
        note = await this._createConditionNote(data, protoNote);
        break;
      case "ongoing":
        note = await this._createOngoingNote(data, protoNote);
        break;
      case "modifiers":
        note = await this._createModifierNote(data, protoNote);
        break;
      case "resistances":
        note = await this._createResistanceNote(data, protoNote);
        break;
      case "manual":
        note = await this._createManualNote(data, protoNote);
        break;
    }

    return;

    for (const tokenDoc of this.tokenDocuments) {
      // Get existing notes and reset broken ones. Any note without an ID is filtered away.
      const existingNotes = tokenDoc.getFlag(MODULE_ID, "notes") || [];
      const verifiedNotes = Array.isArray(existingNotes) ? [...existingNotes.filter(note => !!note?.id)] : [];

      // Keep track of removed notes
      const removedNotes = data.deleteNote != null ? verifiedNotes.filter((note) => data.deleteNote.includes(note.id)) : [];
      const remainingNotes = data.deleteNote != null ? verifiedNotes.filter((note) => !data.deleteNote.includes(note.id)) : verifiedNotes;

      // Nothing was inputted, as such we don't need to add a note.
      if (note != null && note.duration != null) {
        remainingNotes.push(note);
      }

      await tokenDoc.setFlag(MODULE_ID, "notes", remainingNotes);

      for (const removedNote of removedNotes) {
        await TrackingHelper.removeAdditionalNoteEffects(tokenDoc.object, removedNote);
      }
    }
  }

  get tokenDocuments() { return this.tokens.map(token => token.document); }

  static PARTS = {
    tabs: { template: 'templates/generic/tab-navigation.hbs' },
    notes: { template: "modules/too-many-modifiers/parts/notes-table.hbs" },
    conditions: { template: "modules/too-many-modifiers/parts/condition-section.hbs" },
    ongoing: { template: "modules/too-many-modifiers/parts/ongoing-section.hbs" },
    modifiers: { template: "modules/too-many-modifiers/parts/modifier-section.hbs" },
    resistances: { template: "modules/too-many-modifiers/parts/resistances-section.hbs" },
    manual: { template: "modules/too-many-modifiers/parts/manual-section.hbs" },
    duration: { template: "modules/too-many-modifiers/parts/duration-section.hbs" },
    footer: { template: "templates/generic/form-footer.hbs" },
  }

  static TABS = {
    primary: {
      tabs: [{ id: 'conditions', label: "Conditions" }, { id: 'ongoing', label: "Ongoing" }, { id: 'modifiers', label: "Modifiers" }, { id: 'resistances', label: "Resistances" }, { id: 'manual', label: "Manual" }],
      initial: 'modifiers',
    }
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
        console.error(c);
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
      combatants: this.combat?.combatants,
      defaultDuration,
      defaultCombatant: this.combat?.combatant ?? "",
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

    return notesArray;
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
        console.error(currentCombatant);
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

  async _createConditionNote(data, protoNote) {
    if (!data.condition) return;

    const conditionEffect = CONFIG.statusEffects.find(statusEffect => statusEffect.name === data.condition);
    if (conditionEffect) {
      for (const tokenDoc of this.tokenDocuments) {
        await tokenDoc.actor.createEmbeddedDocuments("ActiveEffect", [{
          icon: conditionEffect.img,
          name: conditionEffect.name,
          statuses: new Set([conditionEffect.id]),
          flags: {
            dnd4e: {
              effectData: {
                // Neccessary to prevent a null reference in the dnd4e system.
                durationType: "custom",
              }
            }
          }
        }]);
      }
    } else {
      ui.notifications.warn(`Condition "${data.condition}" not found in CONFIG.statusEffects. Please ensure the condition exists and has a name property.`);
    }

    return foundry.utils.mergeObject(protoNote, {
      condition: data.condition,
      text: data.condition,
    });
  }

  async _createOngoingNote(data, protoNote) {
    if (!data.ongoingType || !data.ongoingDamage) return;

    return foundry.utils.mergeObject(protoNote, {
      ongoingType: data.ongoingType,
      ongoingDamage: data.ongoingDamage,
      text: `Ongoing ${data.ongoingDamage} ${data.ongoingType}`,
    });
  }

  async _createResistanceNote(data, protoNote) {
    if (!data.resistanceType || !data.resistanceValue) return;

    return foundry.utils.mergeObject(protoNote, {
      resistanceType: data.resistanceType,
      resistanceValue: data.resistanceValue,
      text: `${data.resistanceValue > 0 ? '+' : ''}${data.resistanceValue} ${data.resistanceType} Resistance`,
    });
  }

  async _createManualNote(data, protoNote) {
    if (!data.manualCondition) return;

    note = foundry.utils.mergeObject(protoNote, {
      text: data.manualCondition,
    });
  }
}