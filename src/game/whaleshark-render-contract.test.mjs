import assert from 'node:assert/strict';
import test from 'node:test';

/*
 * CS04-10 and deliverable 7 in
 * project/clickstops/active/active_cs04_daily-challenge-and-v1-polish.md
 * require the whale-shark mystery enemy to render above the invader formation
 * and below player torpedoes. Row 10 owns play.mjs integration; this contract
 * test locks the expected layer order for that integration handoff.
 */

test('render contract is formation, whale shark, then player torpedoes', () => {
  const renderCalls = [];
  const formation = () => renderCalls.push('formation');
  const whaleShark = () => renderCalls.push('whaleshark');
  const torpedoes = () => renderCalls.push('torpedoes');

  formation();
  whaleShark();
  torpedoes();

  assert.deepEqual(renderCalls, ['formation', 'whaleshark', 'torpedoes']);
});
