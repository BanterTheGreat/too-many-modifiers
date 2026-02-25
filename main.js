import { CombatManager } from "./combat-manager.js";
import { TrackingOverlay } from "./tracking-overlay.js";
import { TrackingDialog } from "./tracking-dialog.js";

export const MODULE_ID = "too-many-modifiers";

Hooks.on("canvasReady", TrackingOverlay.onCanvasReady);
Hooks.on("refreshToken", TrackingOverlay.refreshToken);
Hooks.on("updateToken", TrackingOverlay.onUpdateToken);
Hooks.on("updateActor", TrackingOverlay.onUpdateActor);

Hooks.on("combatRound", CombatManager.onCombatRound);
Hooks.on("combatTurnChange", CombatManager.onCombatTurnChange);
Hooks.on("deleteCombat", CombatManager.onDeleteCombat);

Hooks.on("renderTokenHUD", (app, html) => {
  if (!game.user.isGM) {
    return;
  }

  const colRight = $(html).find(".right")
  const button = $(`
            <div class="control-icon" id="toggle-token-notes">
                <img src="icons/svg/book.svg" width="36" height="36" title="Edit Notes">
            </div>
        `)
  colRight.append(button);
  button.on("click", (e) => {
    const selected = canvas.tokens.controlled && canvas.tokens.controlled.length ? canvas.tokens.controlled : [];
    if (selected.length === 0) return;

    console.error(selected);

    const trackingDialog = new TrackingDialog(selected);
    trackingDialog.render(true);
  })
});
