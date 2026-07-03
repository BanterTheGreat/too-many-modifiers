# Too Much To Track - Development Guidelines

## Project Overview

This is a FoundryVTT module that allows GMs to easily add and automatically track various status modifiers, conditions, resistances, and ongoing effects on tokens. The module integrates with FoundryVTT's combat and token systems.

## Architecture

### Core Components

- **TrackingDialog** (`tracking-dialog.js`): Main UI dialog for managing token effects
- **TrackingOverlay** (`tracking-overlay.js`): Canvas overlay system for displaying status on tokens
- **CombatManager** (`combat-manager.js`): Handles combat round/turn progression and effect duration
- **TrackingHelper** (`tracking-helper.js`): Shared utility functions

### Handler System

The `handlers/` directory contains specialized handlers for different effect types:
- `base.js`: Abstract base class for all handlers
- `condition.js`: Status conditions (stunned, prone, etc.)
- `modifier.js`: Numeric modifiers to stats
- `manual.js`: Custom user-defined effects
- `ongoing.js`: Ongoing damage/healing effects
- `resistance.js`: Damage resistances and vulnerabilities

Each handler extends the base handler and implements specific UI rendering and data management logic.

### Templates

Handlebars templates in `parts/` define UI sections for the tracking dialog. Each section corresponds to a handler type (e.g., `modifier-section.hbs` for modifiers).

## Code Conventions

### FoundryVTT Integration

- Use `game.user.isGM` to check GM permissions
- Access selected tokens via `canvas.tokens.controlled`
- Store module data on actor flags: `actor.getFlag(MODULE_ID, key)` and `actor.setFlag(MODULE_ID, key, value)`
- Use FoundryVTT Hooks for lifecycle events: `Hooks.on("eventName", handler)`

### Module ID

Always reference the module ID from `constants.js`:
```javascript
import { MODULE_ID } from "./constants.js";
```

### Data Storage

Token tracking data is stored on the actor's flags under the module namespace. Each effect type has its own data structure defined by its handler.

## Build and Test

This module runs directly in FoundryVTT without a build step. To test:
1. Place module in FoundryVTT's `Data/modules/` directory
2. Enable module in FoundryVTT world settings
3. Test with GM user account and tokens on a scene

## Key Dependencies

- FoundryVTT API (version 13+)
- jQuery (included with FoundryVTT)
- Handlebars (included with FoundryVTT)

## Development Notes

- The module is GM-only by design (check `game.user.isGM` before rendering UI)
- Effects are tied to actors, not tokens, so they persist across scenes
- Combat integration automatically handles duration tracking when effects have turn/round durations
- The overlay system refreshes on token updates to display current status visually on the canvas
