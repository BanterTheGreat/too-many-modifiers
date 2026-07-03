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
        width: 600,
      }
    };

    super(options);
    this.currentTab = 'modifiers';
    this.tokens = tokens;
    this.combat = game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === tokens[0].document.actor?.id));
    // Set initial origin to current combatant's token
    this.selectedOrigin = this.combat?.combatant?.tokenId || null;
    this._originChangeHandler = this._onOriginChange.bind(this);
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
    
    // Resolve duration based on radio button selection
    let duration = this._resolveDuration(data.duration, data.durationOverride);
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
      const existingNotes = TrackingHelper.getNoteFlags(tokenDoc);
      const verifiedNotes = Array.isArray(existingNotes) ? [...existingNotes.filter(note => !!note?.id)] : [];

      // Keep track of removed notes
      const notesToRemove = data.deleteNote != null ? verifiedNotes.filter((note) => data.deleteNote.includes(note.id)) : [];

      // Nothing was inputted, as such we don't need to add a note.
      if (note != null && note.duration != null) {
        verifiedNotes.push(note);
      }

      await TrackingHelper.setNoteFlags(tokenDoc, verifiedNotes);
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
    const originCombatants = this._buildOriginCombatants();
    const conditionOptions = this._getConditionOptions();
    const damageTypeOptions = this._getDamageTypeOptions();
    const defaultDuration = this._getDefaultDuration();

    return {
      notes: [...this.getNotes()],
      defaultDuration,
      playerCombatants: originCombatants,
      defaultPlayerCombatant: originCombatants.find(c => c.tokenId === this.combat?.combatant?.tokenId) || null,
      conditions: conditionOptions,
      damageTypes: damageTypeOptions,
      tabs: this._prepareTabs("primary"),
    };
  }

  _buildOriginCombatants() {
    const playerCombatants = [];
    const nonPlayerCombatants = [];

    // Add combatants for Effect Origin dropdown
    if (this.combat) {
      for (const c of this.combat.combatants) {
        if (c.actor?.type === "Player Character") {
          playerCombatants.push(c);
        } else {
          nonPlayerCombatants.push(c);
        }
      }
    }

    // Combine lists with PCs first, then add duplicate numbering
    const combinedCombatants = [...playerCombatants, ...nonPlayerCombatants];
    const nameCounts = new Map();
    const originCombatants = combinedCombatants.map(c => {
      const baseName = c.name;
      const count = nameCounts.get(baseName) || 0;
      nameCounts.set(baseName, count + 1);
      
      // Add numbering if there are duplicates
      const displayName = count > 0 ? `${baseName} (${count + 1})` : baseName;
      
      return {
        ...c,
        name: displayName,
        originalName: baseName
      };
    });

    // Go back and update the first occurrence if there were duplicates
    const finalOriginCombatants = originCombatants.map(c => {
      const totalCount = nameCounts.get(c.originalName);
      if (totalCount > 1 && !c.name.includes('(')) {
        return {
          ...c,
          name: `${c.originalName} (1)`
        };
      }
      return c;
    });

    return finalOriginCombatants;
  }

  _resolveDuration(durationType, customValue) {
    if (!durationType) return "";

    switch(durationType) {
      case "encounter":
        return Constants.DURATION_ENCOUNTER;
      case "round":
        return Constants.DURATION_ROUND;
      case "save":
        return Constants.DURATION_SAVE;
      case "eot-origin":
        // Use selected origin if available
        if (this.selectedOrigin && this.combat) {
          return `EoT ${this.selectedOrigin}`;
        }
        return "";
      case "eot-target":
        // Use the first token being edited
        if (this.tokens && this.tokens.length > 0) {
          return `EoT ${this.tokens[0].id}`;
        }
        return "";
      case "custom":
        // Use the custom value from the textfield
        return customValue || "";
      default:
        return durationType;
    }
  }

  _getConditionOptions() {
    const conditions = CONFIG.statusEffects || [];
    return conditions.map(condition => {
      const label = condition.label || condition.name || condition;
      const value = condition.name || condition.id || label;
      return { value, label };
    });
  }

  _getDamageTypeOptions() {
    const damageTypes = CONFIG.DND4E?.damageTypes || {};
    return Object.entries(damageTypes).map(([key, label]) => {
      return { value: key, label };
    });
  }

  _getDefaultDuration() {
    // Default to EoT Origin if we have a selected origin
    if (this.selectedOrigin) {
      return "eot-origin";
    }
    // Otherwise default to encounter
    return "encounter";
  }

  async _preparePartContext(partId, context) {
    const tab = context.tabs?.[partId];
    if (tab) {
      context.tab = { ...tab };
      // Set active class for initial tab
      if (partId === "modifiers" && this.currentTab === "modifiers") {
        context.tab.cssClass = "active";
      }
    }
    return context;
  }

  getNotes() {
    // Only include notes that are present on every selected token (match by text+duration)
    const primaryNotes = TrackingHelper.getNoteFlags(this.tokenDocuments[0]) || [];
    let notesArray = [];
    if (!Array.isArray(primaryNotes)) {
      ui.notifications.warn("Non-Array notes data found on primary token. Resetting notes.");
      notesArray = [];
    } else {
      notesArray = primaryNotes.filter(n => {
        return this.tokenDocuments.every(td => {
          if (td === this.tokenDocuments[0]) return true;
          const otherNotes = TrackingHelper.getNoteFlags(td);
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
    if (selectedTab === "ongoing") {
      // Set "save" radio button for ongoing effects
      const saveRadio = this.element.querySelector('[name="duration"][value="save"]');
      if (saveRadio) saveRadio.checked = true;
    } else {
      // Set "eot-origin" radio button for other tabs if we have a selected origin
      if (this.selectedOrigin) {
        const eotOriginRadio = this.element.querySelector('[name="duration"][value="eot-origin"]');
        if (eotOriginRadio) eotOriginRadio.checked = true;
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

  _onOriginChange(event) {
    this.selectedOrigin = event.target.value;
    // No need to re-render since radio buttons are static
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Add event listener for origin dropdown
    const originSelect = this.element.querySelector('#origin');
    if (originSelect) {
      // Remove old listener if it exists to prevent memory leaks
      originSelect.removeEventListener('change', this._originChangeHandler);
      // Add the listener
      originSelect.addEventListener('change', this._originChangeHandler);
    }

    // Auto-select custom radio button when custom textfield is focused or typed in
    const customField = this.element.querySelector('#durationOverride');
    const customRadio = this.element.querySelector('#customRadio');
    if (customField && customRadio) {
      customField.addEventListener('focus', () => {
        customRadio.checked = true;
      });
      customField.addEventListener('input', () => {
        customRadio.checked = true;
      });
    }

    // Add event listeners for modifier value spinner
    const increaseBtn = this.element.querySelector('#increaseModifier');
    const decreaseBtn = this.element.querySelector('#decreaseModifier');
    const numberValue = this.element.querySelector('#numberValue');

    if (increaseBtn && numberValue) {
      increaseBtn.addEventListener('click', () => {
        const currentValue = Number.parseInt(numberValue.value) || 0;
        numberValue.value = currentValue + 1;
      });
    }

    if (decreaseBtn && numberValue) {
      decreaseBtn.addEventListener('click', () => {
        const currentValue = Number.parseInt(numberValue.value) || 0;
        numberValue.value = currentValue - 1;
      });
    }

    // Add event listeners for quick ability buttons
    const quickAbilityButtons = this.element.querySelectorAll('.quick-ability');
    quickAbilityButtons.forEach(button => {
      button.addEventListener('click', () => {
        const ability = button.dataset.ability;
        const sign = button.dataset.sign;
        
        // Get the origin combatant
        const originSelect = this.element.querySelector('#origin');
        const originTokenId = originSelect?.value;
        
        if (!originTokenId || !this.combat) {
          ui.notifications.warn("Please select an origin combatant first");
          return;
        }
        
        const originCombatant = this.combat.combatants.find(c => c.tokenId === originTokenId);
        if (!originCombatant?.actor) {
          ui.notifications.error("Selected origin combatant not found");
          return;
        }
        
        // Get the ability modifier value
        const abilityValue = originCombatant.actor.system.abilities[ability]?.mod || 0;
        
        // Set the value (hardset, not add)
        const numberValue = this.element.querySelector('#numberValue');
        if (numberValue) {
          numberValue.value = sign === '+' ? Math.abs(abilityValue) : -Math.abs(abilityValue);
        }
      });
    });
  }
}