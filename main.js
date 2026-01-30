import { CombatManager } from "./combat-manager.js";
import {NotesDisplay as TrackingDisplay} from "./notes-display.js";

Hooks.on("setup", () => {
    game.trackingDisplay = new TrackingDisplay();
    game.combatManager = new CombatManager();
})

Hooks.on("refreshToken", TrackingDisplay.refreshToken);
Hooks.on("updateActor", TrackingDisplay.onUpdateActor);
Hooks.on("canvasReady", TrackingDisplay.onCanvasReady);
Hooks.on("updateToken", TrackingDisplay.onUpdateToken);
Hooks.on("renderTokenHUD", TrackingDisplay.onRenderTokenHUD);

Hooks.on("combatRound", CombatManager.onCombatRound);
Hooks.on("combatTurnChange", CombatManager.onCombatTurnChange);
Hooks.on("deleteCombat", CombatManager.onDeleteCombat);