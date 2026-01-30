export class TrackingHelper {
  static _removeConditionEffect(token, note) {
    if (!token?.actor) return;

    const conditionName = note.text;
    const actor = token.actor;
    const effect = actor.effects.find(e => e.name === conditionName);

    if (effect) {
      effect.delete();
    }
  }

  static async _removeModifierBonus(token, note) {
    if (!token?.actor) return;

    const actor = token.actor;
    const modifierType = note.modifierType;
    const bonusName = `too-many-modifiers: ${note.text}`;

    if (!modifierType) return;

    switch (modifierType) {
      case 'AC':
        const acBonus = actor.system.defences.ac.bonus || [];
        const updatedAcBonus = acBonus.filter(b => b.name !== bonusName);

        console.log(acBonus);
        console.log(updatedAcBonus);
        await actor.update({ 'system.defences.ac.bonus': updatedAcBonus });
        break;
      case 'Speed':
        const speedBonus = actor.system.movement.base.bonus || [];
        const updatedSpeedBonus = speedBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.movement.base.bonus': updatedSpeedBonus });
        break;
      case 'Damage':
        const damageBonus = actor.system.modifiers.damage.bonus || [];
        const updatedDamageBonus = damageBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.modifiers.damage.bonus': updatedDamageBonus });
        break;
      case 'Saving Throws':
        const saveBonus = actor.system.details.saves.bonus || [];
        const updatedSaveBonus = saveBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.details.saves.bonus': updatedSaveBonus });
        break;
      case 'Attacks':
        const attackBonus = actor.system.modifiers.attack.bonus || [];
        const updatedAttackBonus = attackBonus.filter(b => b.name !== bonusName);
        await actor.update({ 'system.modifiers.attack.bonus': updatedAttackBonus });
        break;
      default:
        ui.notifications.warn(`Modifier type "${modifierType}" is not supported yet.`);
        break;
    }
  }

  static async _removeResistanceBonus(token, note) {
    if (!token?.actor) return;

    const actor = token.actor;
    const resistanceType = note.resistanceType;
    const bonusName = `too-many-modifiers: ${note.text}`;

    if (!resistanceType) return;

    const resistancePath = `system.resistances.${resistanceType}.bonus`;
    const resistanceBonus = getProperty(actor, resistancePath) || [];
    const updatedResistanceBonus = resistanceBonus.filter(b => b.name !== bonusName);
    await actor.update({ [resistancePath]: updatedResistanceBonus });
  }

  /// Cleans up all effects related to a note to prevent any weird leftovers.
  static async removeAdditionalNoteEffects(token, note) {
    TrackingHelper._removeConditionEffect(token, note);
    await TrackingHelper._removeModifierBonus(token, note);
    await TrackingHelper._removeResistanceBonus(token, note);
  }
}