const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

import { Constants } from "./constants.js";
import { MODULE_ID } from "./constants.js";
import { TrackingHelper } from "./tracking-helper.js";

import { ConditionNoteHandler } from "./handlers/condition.js";
import { OngoingNoteHandler } from "./handlers/ongoing.js";
import { ModifierNoteHandler } from "./handlers/modifier.js";
import { ResistanceNoteHandler } from "./handlers/resistance.js";
import { ManualNoteHandler } from "./handlers/manual.js";

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
    this.combat = game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === tokens[0].document.actor?.id));
    console.error(this.tokens);
    console.error(this.combat);
  }

  static DEFAULT_OPTIONS = {
    id: "too-much-too-track-dialog",
    tag: "form",
    form: {
      handler: TrackingDialog.onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    classes: [],
    actions: {
    }
  }

  static async onSubmit(event, form, formData) {
    const action = event.submitter.dataset.type;
    const data = formData.object;
    const duration = data.durationOverride || data.duration;
    const combatantId = this._getCombatantIfEoT(duration);
    const userFriendlyDuration = TrackingHelper.getUserFriendlyDuration(duration, this.combat);
    var note = null;

    const protoNote = {
      duration: userFriendlyDuration,
      id: `tmtt-${foundry.utils.randomID()}`,
      combatantId: combatantId,
      round: this.combat?.round,
      turn: this.combat?.turn,
      type: this.currentTab,
    };

    const handlers = {
      conditions: new ConditionNoteHandler(data, protoNote, this.tokenDocuments),
      ongoing: new OngoingNoteHandler(data, protoNote),
      modifiers: new ModifierNoteHandler(data, protoNote, this.tokenDocuments, this.combat),
      resistances: new ResistanceNoteHandler(data, protoNote, this.tokenDocuments),
      manual: new ManualNoteHandler(data, protoNote),
    };

    const noteHandler = handlers[this.currentTab];
    if (noteHandler) {
      note = await noteHandler.create();
    } else {
      ui.notifications.warn(`No handler found for note type "${this.currentTab}". Please ensure the type is correct and a handler exists.`);
      return;
    }

    for (const tokenDoc of this.tokenDocuments) {
      // Get existing notes and reset broken ones. Any note without an ID is filtered away.
      const existingNotes = tokenDoc.getFlag(MODULE_ID, "notes") || [];
      const verifiedNotes = Array.isArray(existingNotes) ? [...existingNotes.filter(note => !!note?.id)] : [];

      // Keep track of removed notes
      const notesToRemove = data.deleteNote != null ? verifiedNotes.filter((note) => data.deleteNote.includes(note.id)) : [];

      // Nothing was inputted, as such we don't need to add a note.
      if (note != null && note.duration != null) {
        verifiedNotes.push(note);
      }

      await tokenDoc.setFlag(MODULE_ID, "notes", verifiedNotes);
      await TrackingHelper.deleteNotesAndEffects(tokenDoc, notesToRemove);
    }

    if (action === "saveAndClose") {
      this.close();
    } else {
      this.render();
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
    footer: { template: "modules/too-many-modifiers/parts/footer.hbs" },
  }

  static TABS = {
    primary: {
      tabs: [{ id: 'conditions', label: "Conditions" }, { id: 'ongoing', label: "Ongoing" }, { id: 'modifiers', label: "Modifiers" }, { id: 'resistances', label: "Resistances" }, { id: 'manual', label: "Manual" }],
      initial: 'modifiers',
    }
  }

  async _prepareContext(options) {
    const playerCombatants = [];
    const durationOptions = [
      { value: Constants.DURATION_ENCOUNTER, label: Constants.DURATION_ENCOUNTER },
      { value: Constants.DURATION_ROUND, label: Constants.DURATION_ROUND },
      { value: Constants.DURATION_SAVE, label: Constants.DURATION_SAVE },
    ];

    // Add combatants to duration options for EoT tracking.
    if (this.combat) {
      for (const c of this.combat.combatants) {
        durationOptions.push(TrackingHelper.getCombatantDuration(c));
        
        if (c.actor?.type === "Player Character") {
          playerCombatants.push(c);
        }
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
      playerCombatants: playerCombatants,
      defaultPlayerCombatant: this.combat?.combatant?.actor.type === "Player Character" ? this.combat?.combatant : "",
      conditions: conditionOptions,
      damageTypes: damageTypeOptions,
      tabs: this._prepareTabs("primary"),
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
      const combatant = this.combat?.combatants.find(c => c.tokenId === combatantName);
      return combatant?.id;
    }
  }
}