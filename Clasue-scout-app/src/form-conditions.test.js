import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAnswer, visibleQuestions, visibleAnswers, validateConditions } from './form-conditions.js';
const source = { id: 'a', type: 'number' };
const dependent = (operator, value, extra = {}) => ({ id: 'b', visibility: { mode: 'all', rules: [{ questionId: 'a', operator, value }] }, ...extra });
test('zero and false are answers; blank and invalid numbers are not', () => {
  for (const value of [0, false, 'No']) assert.equal(hasAnswer(value), true);
  for (const value of ['', '  ', undefined, null, NaN]) assert.equal(hasAnswer(value), false);
});
test('numeric rules compare values numerically and do not match unanswered inputs', () => {
  for (const [operator, value] of [['equals', '10'], ['gte', 10], ['gt', 9], ['lte', 10], ['lt', 11], ['notEquals', 11]]) {
    const qs = [source, dependent(operator, value)];
    assert.equal(visibleQuestions(qs, { a: 10 }).length, 2);
    assert.equal(visibleQuestions(qs, {}).length, 1);
  }
});
test('answered, unanswered, text, and choice rules', () => {
  assert.equal(visibleQuestions([source, dependent('answered')], { a: 0 }).length, 2);
  assert.equal(visibleQuestions([source, dependent('unanswered')], {}).length, 2);
  assert.equal(visibleQuestions([{ ...source, type: 'text' }, dependent('contains', 'climb')], { a: 'Can CLIMB' }).length, 2);
  assert.equal(visibleQuestions([{ ...source, type: 'boolean' }, dependent('equals', 'No')], { a: 'No' }).length, 2);
});
test('hidden answers cannot trigger descendants and are omitted from submissions', () => {
  const qs = [source, dependent('gt', 5), { id: 'c', visibility: { rules: [{ questionId: 'b', operator: 'unanswered' }] } }];
  assert.deepEqual(visibleQuestions(qs, { a: 0, b: 'old' }).map(q => q.id), ['a']);
  assert.deepEqual(visibleAnswers(qs, { a: 0, b: 'old', c: 'stale' }), { a: 0 });
});
test('any/all groups and existing unconditional forms', () => {
  const b = dependent('equals', 5);
  b.visibility.rules.push({ questionId: 'a', operator: 'equals', value: 7 });
  assert.equal(visibleQuestions([source, b], { a: 5 }).length, 1);
  b.visibility.mode = 'any';
  assert.equal(visibleQuestions([source, b], { a: 5 }).length, 2);
  assert.equal(visibleQuestions([source, { id: 'legacy' }], {}).length, 2);
});
test('deleting, moving, or changing a source cannot silently break saved rules', () => {
  assert.equal(validateConditions([source, dependent('gt', '2')]), null);
  assert.ok(validateConditions([dependent('gt', 2), source]));
  assert.ok(validateConditions([dependent('gt', 2)]));
  assert.ok(validateConditions([{ ...source, type: 'photo' }, dependent('gt', 2)]));
  assert.ok(validateConditions([{ ...source, type: 'select', options: ['A'] }, dependent('equals', 'Removed')]));
});
test('media presence and multi-level branches work in order', () => {
  for (const type of ['photo', 'draw']) {
    const qs = [{ ...source, type }, dependent('answered', '', {type:'number'}),
      { id:'c', visibility:{rules:[{questionId:'b',operator:'gt',value:0}]} }];
    assert.deepEqual(visibleQuestions(qs, {a:'data:image/png;base64,example',b:2}).map(q=>q.id), ['a','b','c']);
    assert.deepEqual(visibleAnswers(qs, {a:null,b:2,c:'old'}), {});
  }
});
