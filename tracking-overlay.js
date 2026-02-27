import { MODULE_ID } from "./constants.js";
import { TrackingHelper } from "./tracking-helper.js";

export class TrackingOverlay {
  static get gridScale() {
    return canvas.scene.dimensions.size / 100;
  }

  static get fontSize() {
    return 18;
  }

  static get scaledFontSize() {
    return (TrackingOverlay.fontSize * TrackingOverlay.gridScale) * 4;
  }

  static refreshToken(token, flags) {
    TrackingOverlay.handleOverlay(token, token.hover);
  }

  static onCanvasReady() {
    canvas.tokens?.placeables.forEach((token) => {
      TrackingOverlay.handleOverlay(token, true);
    });
  }

  static onUpdateActor(actor, data, options, userId) {
    // Get all the tokens because there can be two tokens of the same linked actor.
    const tokens = canvas.tokens?.placeables.filter((token) => token?.actor?.id === actor.id);
    // Call the _handleOverlay method for each token.
    tokens?.forEach((token) => TrackingOverlay.handleOverlay(token, true));
  }

  static onUpdateToken(token, data, options, userId) {
    if (data?.flags && data.flags[MODULE_ID]) {
      // Get all the tokens because there can be two tokens of the same linked actor.
      const tokens = canvas.tokens?.placeables.filter((canvasToken) => canvasToken?.actor?.id === token.actorId);
      // Call the _handleOverlay method for each token.
      tokens?.forEach((canvasToken) => TrackingOverlay.handleOverlay(canvasToken));
    }
  }

  static handleOverlay(token, hovering = false) {
    // Create PIXI
    try {
      // We hide the note while hovering over a token.
      const flags = TrackingHelper.getNoteFlags(token.document);
      const { desc, color, stroke } = {
        desc: TrackingHelper.formatNotesForDisplay(flags),
        color: "#ffffff",
        stroke: "#000000"
      };
      if (desc !== undefined && color && stroke) {
        const { width } = token.document.getSize();
        const y = -2 + (35 * TrackingOverlay.gridScale); // 25 = this.height;
        const position = 2;
        const x = (width / 2) * position;
        const config = { desc, color, stroke, width, x, y };
        if (!token.notesDisplay?._texture) {
          TrackingOverlay.createNotesDisplay(token, config, hovering);
        } else {
          TrackingOverlay.updateNotesDisplay(token, config, hovering);
        }
      }
    } catch (err) {
      console.error(
        `Notes Display | Error on function _handleOverlay(). Token Name: "${token.name}". ID: "${token.id}". Type: "${token.document.actor.type}".`,
        err
      );
    }
  }

  static createNotesDisplay(token, config = {}, hovering = false) {
    const { desc, color, stroke, width, x, y } = config;
    const padding = 5;
    const style = {
      // Multiply font size to increase resolution quality
      fontSize: TrackingOverlay.scaledFontSize,
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
    token.notesDisplay.position.set(width / 2, x + y + (lineCount * ((TrackingOverlay.fontSize * TrackingOverlay.gridScale) + padding)) + (hovering ? 24 : 0));
  }

  static updateNotesDisplay(token, config = {}, hovering = false) {
    const { desc, color, stroke, width, x, y } = config;
    const padding = 5;
    token.notesDisplay.style.fontSize = TrackingOverlay.scaledFontSize;
    token.notesDisplay.text = desc;
    token.notesDisplay.style.fill = color;
    token.notesDisplay.style.stroke = stroke;
    token.notesDisplay.visible = true;

    var lineCount = desc.split("\n").length - 1;
    token.notesDisplay.position.set(width / 2, x + y + (lineCount * ((TrackingOverlay.fontSize * TrackingOverlay.gridScale) + padding)) + (hovering ? 24 : 0));
  }
}