import {NotesDisplay} from "./notes-display.js";
// Notes
Hooks.on("setup", () => {
    game.notesDisplay = new NotesDisplay();
})

Hooks.on("refreshToken", NotesDisplay.refreshToken);
Hooks.on("updateActor", NotesDisplay.onUpdateActor);
Hooks.on("canvasReady", NotesDisplay.onCanvasReady);
Hooks.on("updateToken", NotesDisplay.onUpdateToken);
Hooks.on("renderTokenHUD", NotesDisplay.onRenderTokenHUD);