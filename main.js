import { CombatManager } from "./combat-manager.js";
import {NotesDisplay} from "./notes-display.js";

Hooks.on("setup", () => {
    game.notesDisplay = new NotesDisplay();
    game.combatManager = new CombatManager();
})

Hooks.on("refreshToken", NotesDisplay.refreshToken);
Hooks.on("updateActor", NotesDisplay.onUpdateActor);
Hooks.on("canvasReady", NotesDisplay.onCanvasReady);
Hooks.on("updateToken", NotesDisplay.onUpdateToken);
Hooks.on("renderTokenHUD", NotesDisplay.onRenderTokenHUD);

Hooks.on("combatRound", CombatManager.onCombatRound);
Hooks.on("combatTurnChange", CombatManager.onCombatTurnChange);