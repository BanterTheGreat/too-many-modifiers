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
        console.log(tokenDocument);
        const notes = tokenDocument.getFlag("too-many-modifiers", "notes") || "";
        
        new Dialog({
            title: "Edit Notes",
            content: `
        <form>
          <div style="width: 100%; max-width: 800px;">
            <textarea id="bigTextArea" style="width: 100%; height: 500px;" placeholder="Enter your multi-line text here">${notes}</textarea>
          </div>
        </form>
      `,
        buttons: {
            save: {
                label: "Save",
                callback: (dialogHtml) => {
                    const inputValue = dialogHtml.find('#bigTextArea').val();
                    tokenDocument.setFlag("too-many-modifiers", "notes", inputValue);
                }
            },
            cancel: {
                label: "Close",
                callback: () => {
                }
            }
        },
        default: "save",
        }).render(true, { width: 700, height: 600 });
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
            const { desc, color, stroke } = { desc: token?.document.flags["too-many-modifiers"]?.notes ?? "", color: "#ffffff", stroke: "#000000" };
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
        } catch(err) {
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
}