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
      game.notesDisplay._editNotes(token.document);
    })
  }

  _editNotes(tokenDocument) {
    // Get the combat the token is in
    const combat = game.combats.find(c => c.combatants.some(combatant => combatant.actor?.id === tokenDocument.actor?.id));
    const combatantNames = combat?.combatants.map(c => c.name);
    // console.log("Combat:", combat);
    // console.log("Combatant Names:", combatantNames);

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
          callback: (dialogHtml) => {
            const textValue = dialogHtml.find('#noteText').val();
            const durationValue = dialogHtml.find('#duration').val();
            const durationOverwrite = dialogHtml.find('#durationOverwrite').val();

            // Use overwrite if present, otherwise use dropdown value
            const finalDuration = durationOverwrite || durationValue;

            // Find combatantId if duration is an EonT option
            let combatantId = null;

            if (finalDuration?.startsWith("EonT ")) {
              const combatantName = finalDuration.replace("EonT ", "");
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
            if (textValue.trim()) {
              const newNote = {
                text: textValue,
                duration: finalDuration,
                combatantId: combatantId,
                round: combat?.round
              };

              updatedNotesArray.push(newNote);
            }

            // Set the flag with the array
            tokenDocument.setFlag("too-many-modifiers", "notes", updatedNotesArray);
          }
        },
        cancel: {
          label: "Close",
          callback: () => {
          }
        }
      },
      default: "save",
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
        desc: "DISABLED!", // token?.document.flags["too-many-modifiers"]?.notes ?? "", 
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

  _generateNotesDialogHtml(combat, notesArray) {
    // Generate duration dropdown options from combatants
    const durationOptions = `
        <option value="Encounter">Encounter</option>
        <option value="Round">Round</option>
        ${combat?.combatants.map(c => `<option value="EonT ${c.name}">EonT ${c.name}</option>`).join('') || ''}`;

    // Generate table rows for existing notes
    const notesTableRows = notesArray.map((note, index) => `
          <tr>
            <td style="padding: 5px; border: 1px solid #ccc; width: 30px;">
              <input type="checkbox" id="note-${index}" style="cursor: pointer;">
            </td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.text}</td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.duration}</td>
            <td style="padding: 5px; border: 1px solid #ccc;">${note.round ?? '-'}</td>
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
            <label>Text:</label>
            <input type="text" id="noteText" style="width: 100%; padding: 5px;" placeholder="Enter text">
          </div>
          <div style="margin-bottom: 15px; display: flex; gap: 10px;">
            <div style="width: 50%;">
              <label>Duration:</label>
              <select id="duration" style="width: 100%; padding: 5px;">
                <option value="">Select duration...</option>
                ${durationOptions}
              </select>
            </div>
            <div style="width: 50%;">
              <label>Duration Overwrite:</label>
              <input type="text" id="durationOverwrite" style="width: 100%; padding: 5px;" placeholder="Enter custom duration">
            </div>
          </div>
        </div>
      </form>
    `;
  }
}