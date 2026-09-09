# Banter 4e Modifications

Foundry VTT v13 module. It targets the DnD4e system's legacy [`0.7.14` source](https://github.com/EndlesNights/dnd4eBeta/tree/0.7.14); do not assume current upstream APIs or behavior apply without checking this tag.

## Layout

- `main.js` registers Foundry hooks and opens the token HUD dialog.
- `tracking-dialog.js` renders the V2 Handlebars form; `parts/` contains its templates and `styles/` its CSS.
- `handlers/` creates and cleans each note type; `tracking-helper.js` stores notes and `tracking-overlay.js` renders them.
- `combat-manager.js` advances and removes notes during combat; `constants.js` holds shared identifiers and durations.

## Architecture

- Notes are module flags named `too-many-modifiers.notes`: store them on linked actors, otherwise on token documents.
- Each note has an `id`, `type`, `text`, and duration data. Handler-created Active Effects use the note ID so cleanup can remove both the effect and its note.
- Add note types through a handler with `create()` and `clean()`, then register it in `TrackingDialog` and `TrackingHelper`.

## Working conventions

- Use ES modules, Foundry hooks, and the DnD4e system API; preserve v12 compatibility unless intentionally upgrading it.
- Use braced, multiline `if` blocks. Document methods with JSDoc, using multiline JSDoc blocks whenever practical.
- Prefer Foundry APIs (`foundry.utils`, document flags, embedded documents) and keep asynchronous document changes awaited.
- Keep UI markup in Handlebars parts and presentation rules in the dialog stylesheet.
- Changes that affect initial hooks or the manifest should be tested by reloading Foundry and checking the browser console. There is no automated test or build setup.
