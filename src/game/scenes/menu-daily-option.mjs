// CS04 D5 — menu daily-challenge option overlay (frontend flag-gated).
//
// When `flags.dailyChallenge === 'on'`, the menu scene renders a "PRESS D
// FOR DAILY CHALLENGE" prompt and routes a KeyD press to onDaily(). When
// the flag is off, both the prompt and the input route are inert so the
// CS03 menu behaves exactly as before.
//
// This module is composed by row-10 integration: main.mjs decides flag
// state, then menu.mjs (or its caller) wires the daily option via these
// helpers. Keeping the option behind a separate module lets row 4 ship +
// be tested without editing menu.mjs (row 10's responsibility).

import { isDailyChallengeEnabled } from '../flags.mjs';

export const DAILY_OPTION_LABEL = 'PRESS D FOR DAILY CHALLENGE';

export function createDailyMenuOption({ flags, onDaily } = {}) {
  const enabled = isDailyChallengeEnabled(flags) && typeof onDaily === 'function';

  return {
    enabled,

    handleInput(input) {
      if (!enabled) return false;
      if (input?.pressed?.('KeyD')) {
        onDaily();
        return true;
      }
      return false;
    },

    promptText() {
      return enabled ? DAILY_OPTION_LABEL : null;
    },
  };
}
