import { Constants } from "./constants.js";

export class NotesDisplay {

  static refreshToken(token, flags) {
    game.notesDisplay._handleOverlay(token, token.hover);
  }

  static onCanvasReady() {
    canvas.tokens?.placeables.forEach((token) => {
      game.notesDisplay._handleOverlay(token, true);
    });
  }

  static onUpdateActor(actor, data, options, userId) {
    // Get all the tokens because there can be two tokens of the same linked actor.
    const tokens = canvas.tokens?.placeables.filter((token) => token?.actor?.id === actor.id);
    // Call the _handleOverlay method for each token.
    tokens?.forEach((token) => game.notesDisplay._handleOverlay(token, true));
  }

  static onUpdateToken(token, data, options, userId) {
    if (data?.flags && data.flags["too-many-modifiers"]) {
      // Get all the tokens because there can be two tokens of the same linked actor.
      const tokens = canvas.tokens?.placeables.filter((canvasToken) => canvasToken?.actor?.id === token.actorId);
      // Call the _handleOverlay method for each token.
      tokens?.forEach((canvasToken) => game.notesDisplay._handleOverlay(canvasToken));
    }
  }

  static onRenderTokenHUD(app, html) {
    if (!game.user.isGM) {
      return;
    }
    const token = app.object;
    const colRight = $(html).find(".right")
    const button = $(`
            <div class="control-icon" id="toggle-token-notes">
                <img src="icons/svg/book.svg" width="36" height="36" title="Edit Notes">
            </div>
        `)
    colRight.append(button);
    button.on("click", (e) => {
      game.notesDisplay._editNotes(token);
    })
  }

  _editNotes(token) {
    var tokenDocument = token.document;

    // Get the combat the token is in
    const combat = game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === tokenDocument.actor?.id));
    const combatantNames = combat?.combatants.map(c => c.name);
    console.log(token);
    console.log(tokenDocument);

    let notesArray = tokenDocument.getFlag("too-many-modifiers", "notes") || [];

    if (!Array.isArray(notesArray)) {
      ui.notifications.warn("Non-Array notes data found. Resetting notes.");
      notesArray = [];
    }

    // Generate HTML elements
    const dialogContent = this._generateNotesDialogHtml(combat, notesArray);

    new Dialog({
      title: "Edit Notes",
      content: dialogContent,
      buttons: {
        save: {
          label: "Save",
          callback: async (dialogHtml) => {
            const noteType = dialogHtml.find('#noteType').val();
            
            // The text we show.
            let noteText = '';
            // The duration of the note.
            let finalDuration = '';
            // The combatantId if applicable for EoT durations.
            let combatantId = null;

            // Duration Exclusive
            let isCondition = false;
            let systemCondition = '';

            let isOngoing = false;
            let finalOngoingType = '';
            let finalOngoingDamage = 0;

            console.error(noteType);

            switch (noteType) {
              case 'ongoing':
                const ongoingType = dialogHtml.find('#ongoingType').val();
                const ongoingDamage = dialogHtml.find('#ongoingDamage').val();
                const ongoingDuration = dialogHtml.find('#ongoingDuration').val();
                const ongoingDurationOverwrite = dialogHtml.find('#ongoingDurationOverwrite').val();

                if (!ongoingType || !ongoingDamage) return;

                noteText = `Ongoing ${ongoingDamage} ${ongoingType}`;
                finalDuration = ongoingDurationOverwrite || ongoingDuration;
                finalOngoingType = ongoingType;
                finalOngoingDamage = ongoingDamage;
                isOngoing = true;
                break;
              case 'condition':
                const conditionValue = dialogHtml.find('#condition').val();
                const durationValue = dialogHtml.find('#duration').val();

                if (!conditionValue || !durationValue) return;
                
                console.error(conditionValue);
                console.error(durationValue);
                noteText = conditionValue;
                finalDuration = durationValue;
                systemCondition = conditionValue;
                isCondition = true;
                break;
              case 'modifier':
                break;
              case 'manual':
                const manualCondition = dialogHtml.find('#manualCondition').val();
                const manualDuration = dialogHtml.find('#manualDuration').val();

                if (!manualCondition || !manualDuration) return;

                noteText = manualCondition;
                finalDuration = manualDuration;
                break;
              default:
                return;
            }

            // Find combatantId if duration is an EoT option
            if (finalDuration?.startsWith("EoT ")) {
              const combatantName = finalDuration.replace("EoT ", "");
              const combatant = combat?.combatants.find(c => c.name === combatantName);
              combatantId = combatant?.id;
            }

            // Get existing notes array or create new one
            const existingNotes = tokenDocument.getFlag("too-many-modifiers", "notes") || [];
            let updatedNotesArray = Array.isArray(existingNotes) ? [...existingNotes] : [];

            // Get checked note indices to remove
            const checkedIndices = new Set();
            dialogHtml.find('input[type="checkbox"][id^="note-"]').each(function () {
              if ($(this).is(':checked')) {
                const index = parseInt($(this).attr('id').replace('note-', ''));
                checkedIndices.add(index);
              }
            });

            // Remove checked notes (iterate backwards to avoid index issues)
            for (let i = updatedNotesArray.length - 1; i >= 0; i--) {
              if (checkedIndices.has(i)) {
                updatedNotesArray.splice(i, 1);
              }
            }

            // Add new note if text was entered
            if (noteText.trim()) {
              const newNote = {
                text: noteText,
                duration: finalDuration,
                condition: systemCondition || null,
                combatantId: combatantId,
                round: combat?.round,
                turn: combat?.turn,
                ongoingType: isOngoing ? finalOngoingType : null,
                ongoingDamage: isOngoing ? finalOngoingDamage : null,
              };

              updatedNotesArray.push(newNote);

              // Apply condition if selected (but not for Ongoing)
              if (isCondition && tokenDocument.actor) {
                const actor = tokenDocument.actor;
                const conditionEffect = CONFIG.statusEffects.find(e => e.name === systemCondition);
                if (conditionEffect) {
                  await actor.createEmbeddedDocuments("ActiveEffect", [{
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
              }
            }

            // Set the flag with the array
            await tokenDocument.setFlag("too-many-modifiers", "notes", updatedNotesArray);
          }
        },
        cancel: {
          label: "Close",
          callback: () => {
          }
        }
      },
      default: "save",
      render: (html) => {
        // Show/hide sections based on note type selection
        const noteTypeSelect = html.find('#noteType');
        const conditionSection = html.find('#conditionSection');
        const ongoingSection = html.find('#ongoingSection');
        const modifierSection = html.find('#modifierSection');
        const manualSection = html.find('#manualSection');
        const dialog = html.parents('.app');

        // Set default to condition and show it
        noteTypeSelect.val('condition');
        conditionSection.show();

        const resizeDialog = () => {
          // Get the dialog application instance
          const app = ui.windows[Object.keys(ui.windows).find(key => ui.windows[key].element?.get(0) === dialog.get(0))];

          if (app) {
            // Calculate height based on content
            const contentHeight = html.find('.window-content').prop('scrollHeight');
            // Add some padding for buttons and margins
            const totalHeight = contentHeight + 60;

            // Use setPosition to resize
            app.setPosition({
              height: totalHeight
            });
          }
        };

        noteTypeSelect.on('change', function () {
          const selectedType = $(this).val();

          conditionSection.hide();
          ongoingSection.hide();
          modifierSection.hide();
          manualSection.hide();

          if (selectedType === 'condition') {
            conditionSection.show();
          } else if (selectedType === 'ongoing') {
            ongoingSection.show();
          } else if (selectedType === 'modifier') {
            modifierSection.show();
          } else if (selectedType === 'manual') {
            manualSection.show();
          }

          resizeDialog();
        });
      }
    }).render(true, { width: 400 });
  }

  get gridScale() {
    return canvas.scene.dimensions.size / 100;
  }

  get fontSize() {
    return 18;
  }

  get scaledFontSize() {
    return (this.fontSize * this.gridScale) * 4;
  }

  _handleOverlay(token, hovering = false) {
    // Create PIXI
    try {
      // We hide the note while hovering over a token.
      const { desc, color, stroke } = {
        desc: this._formatNotesForDisplay(token?.document.flags["too-many-modifiers"]?.notes ?? []),
        color: "#ffffff",
        stroke: "#000000"
      };
      if (desc !== undefined && color && stroke) {
        const { width } = token.getSize();
        const y = -2 + (35 * this.gridScale); // 25 = this.height;
        const position = 2;
        const x = (width / 2) * position;
        const config = { desc, color, stroke, width, x, y };
        if (!token.notesDisplay?._texture) {
          this._createNotesDisplay(token, config, hovering);
        } else {
          this._updateNotesDisplay(token, config, hovering);
        }
      }
    } catch (err) {
      console.error(
        `Notes Display | Error on function _handleOverlay(). Token Name: "${token.name}". ID: "${token.id}". Type: "${token.document.actor.type}".`,
        err
      );
    }
  }

  _createNotesDisplay(token, config = {}, hovering = false) {
    const { desc, color, stroke, width, x, y } = config;
    const padding = 5;
    const style = {
      // Multiply font size to increase resolution quality
      fontSize: this.scaledFontSize,
      fontFamily: "Signika",
      fill: color,
      stroke: stroke,
      strokeThickness: 12,
      padding: padding,
      align: "center",
      dropShadow: true,
      dropShadowColor: "black",
      lineJoin: "round",
    };

    token.notesDisplay = token.addChild(new PIXI.Text(desc, style));
    token.notesDisplay.scale.set(0.25);
    token.notesDisplay.anchor.set(0.5, 1);

    var lineCount = desc.split("\n").length - 1;
    token.notesDisplay.position.set(width / 2, x + y + (lineCount * ((this.fontSize * this.gridScale) + padding)) + (hovering ? 24 : 0));
  }

  _updateNotesDisplay(token, config = {}, hovering = false) {
    const { desc, color, stroke, width, x, y } = config;
    const padding = 5;
    token.notesDisplay.style.fontSize = this.scaledFontSize;
    token.notesDisplay.text = desc;
    token.notesDisplay.style.fill = color;
    token.notesDisplay.style.stroke = stroke;
    token.notesDisplay.visible = true;

    var lineCount = desc.split("\n").length - 1;
    token.notesDisplay.position.set(width / 2, x + y + (lineCount * ((this.fontSize * this.gridScale) + padding)) + (hovering ? 24 : 0));
  }

  _formatNotesForDisplay(notes) {
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

  _generateNotesDialogHtml(combat, notesArray) {
    // Generate duration dropdown options from combatants
    const durationOptions = `
        <option value="${Constants.DURATION_ENCOUNTER}">${Constants.DURATION_ENCOUNTER}</option>
        <option value="${Constants.DURATION_ROUND}">${Constants.DURATION_ROUND}</option>
        <option value="${Constants.DURATION_SAVE}">${Constants.DURATION_SAVE}</option>
        ${combat?.combatants.map(c => `<option value="EoT ${c.name}">EoT ${c.name}</option>`).join('') || ''}`;

    // Generate condition dropdown options
    const conditions = CONFIG.statusEffects || [];
    const conditionOptions = conditions.map(condition => {
      const label = condition.label || condition.name || condition;
      const value = condition.name || condition.id || label;
      return `<option value="${value}">${label}</option>`;
    }).join('');

    // Add Ongoing option
    const conditionOptionsWithOngoing = `
      ${conditionOptions}
      <option value="Ongoing">Ongoing Damage</option>
    `;

    // Generate damage type options
    const damageTypes = CONFIG.DND4E?.damageTypes || {};
    const damageTypeOptions = Object.entries(damageTypes).map(([key, label]) => {
      return `<option value="${key}">${label}</option>`;
    }).join('');

    // Generate table rows for existing notes
    const notesTableRows = notesArray.map((note, index) => `
          <tr>
            <td style="padding: 5px; border: 1px solid #ccc; width: 30px;">
              <input type="checkbox" id="note-${index}" style="cursor: pointer;">
            </td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.text}</td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.duration}</td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.round ?? '-'}</td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.turn ?? '-'}</td>
          </tr>
        `).join('');

    const notesTableHtml = notesArray.length > 0 ? `
          <div style="margin-bottom: 15px;">
            <h3>Existing notes</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="padding: 5px; border: 1px solid #ccc; text-align: left; width: 30px;">Delete?</th>
                  <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Text</th>
                  <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Duration</th>
                  <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Round</th>
                  <th style="padding: 5px; border: 1px solid #ccc; text-align: left;">Turn</th>
                </tr>
              </thead>
              <tbody>
                ${notesTableRows}
              </tbody>
            </table>
          </div>
        ` : '';

    return `
      <form>
        ${notesTableHtml}
        <h3>Add new note</h3>
        <div style="width: 100%; max-width: 400px;">
          <div style="margin-bottom: 15px;">
            <label>Note Type:</label>
            <select id="noteType" style="width: 100%; padding: 5px;">
              <option value="">Select type...</option>
              <option value="condition">Condition</option>
              <option value="ongoing">Ongoing</option>
              <option value="modifier">Modifier</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div id="conditionSection" style="display: none;">
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
              <div style="width: 50%;">
                <label>Condition:</label>
                <select id="condition" style="width: 100%; padding: 5px;">
                  <option value="">Select condition...</option>
                  ${conditionOptions}
                </select>
              </div>
              <div style="width: 50%;">
                <label>Duration:</label>
                <select id="duration" style="width: 100%; padding: 5px;">
                  <option value="">Select duration...</option>
                  ${durationOptions}
                </select>
              </div>
            </div>
          </div>

          <div id="ongoingSection" style="display: none;">
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
              <div style="width: 50%;">
                <label>Type:</label>
                <select id="ongoingType" style="width: 100%; padding: 5px;">
                  <option value="">Select type...</option>
                  ${damageTypeOptions}
                </select>
              </div>
              <div style="width: 50%;">
                <label>Damage:</label>
                <input type="number" id="ongoingDamage" style="width: 100%; padding: 5px;" placeholder="Enter damage amount">
              </div>
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
              <div style="width: 50%;">
                <label>Duration:</label>
                <select id="ongoingDuration" style="width: 100%; padding: 5px;">
                  <option value="">Select duration...</option>
                  ${durationOptions}
                </select>
              </div>
              <div style="width: 50%;">
                <label>Duration Overwrite:</label>
                <input type="text" id="ongoingDurationOverwrite" style="width: 100%; padding: 5px;" placeholder="Enter custom duration">
              </div>
            </div>
          </div>

          <div id="modifierSection" style="display: none;">
            <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-radius: 4px;">
              <p>Modifier section placeholder</p>
            </div>
          </div>

          <div id="manualSection" style="display: none;">
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
              <div style="width: 50%;">
                <label>Manual Condition:</label>
                <input type="text" id="manualCondition" style="width: 100%; padding: 5px;" placeholder="Enter condition text">
              </div>
              <div style="width: 50%;">
                <label>Manual Duration:</label>
                <input type="text" id="manualDuration" style="width: 100%; padding: 5px;" placeholder="Enter duration">
              </div>
            </div>
          </div>
        </div>
      </form>
    `;
  }
}