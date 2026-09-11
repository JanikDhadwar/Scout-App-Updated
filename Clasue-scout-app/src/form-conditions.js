export const hasAnswer = value => value !== undefined && value !== null &&
  (typeof value !== 'string' || value.trim() !== '') &&
  (typeof value !== 'number' || Number.isFinite(value));

export function conditionOperators(type) {
  const common = [['answered', 'is answered'], ['unanswered', 'is not answered']];
  if (['photo', 'draw'].includes(type)) return common;
  const equality = [['equals', 'equals'], ['notEquals', 'does not equal']];
  if (['number', 'scale'].includes(type)) return [...common, ...equality,
    ['gt', 'is greater than'], ['gte', 'is at least'], ['lt', 'is less than'], ['lte', 'is at most']];
  return [...common, ...equality, ...(type === 'text' ? [['contains', 'contains']] : [])];
}

function matches(rule, source, answer) {
  if (rule.operator === 'answered') return hasAnswer(answer);
  if (rule.operator === 'unanswered') return !hasAnswer(answer);
  if (!hasAnswer(answer) || !hasAnswer(rule.value)) return false;
  const numeric = ['number', 'scale'].includes(source.type);
  const normalize = v => numeric ? Number(v) : String(v).trim().toLowerCase();
  const actual = normalize(answer), expected = normalize(rule.value);
  if (numeric && (!Number.isFinite(actual) || !Number.isFinite(expected))) return false;
  switch (rule.operator) {
    case 'equals': return actual === expected;
    case 'notEquals': return actual !== expected;
    case 'contains': return actual.includes(expected);
    case 'gt': return actual > expected;
    case 'gte': return actual >= expected;
    case 'lt': return actual < expected;
    case 'lte': return actual <= expected;
    default: return false;
  }
}

// Only earlier, visible questions can trigger a dependent question. This also
// prevents hidden answers from opening later branches and rules from cycling.
export function visibleQuestions(questions, answers) {
  const visible = new Map();
  for (const question of questions) {
    const rules = question.visibility?.rules || [];
    const results = rules.map(rule => {
      const source = visible.get(rule.questionId);
      return !!source && matches(rule, source, answers[source.id]);
    });
    if (!rules.length || (question.visibility.mode === 'any' ? results.some(Boolean) : results.every(Boolean))) {
      visible.set(question.id, question);
    }
  }
  return [...visible.values()];
}

export function visibleAnswers(questions, answers) {
  return Object.fromEntries(visibleQuestions(questions, answers)
    .filter(q => hasAnswer(answers[q.id])).map(q => [q.id, answers[q.id]]));
}

export function validateConditions(questions) {
  for (let i = 0; i < questions.length; i++) {
    for (const rule of questions[i].visibility?.rules || []) {
      const source = questions.slice(0, i).find(q => q.id === rule.questionId);
      const prefix = `Question ${i + 1}: `;
      if (!source) return prefix + 'a visibility rule must refer to a question above it. Update the rule or reorder the questions.';
      if (!conditionOperators(source.type).some(([id]) => id === rule.operator)) return prefix + 'update the rule to match the source question type.';
      if (['answered', 'unanswered'].includes(rule.operator)) continue;
      if (!hasAnswer(rule.value)) return prefix + 'enter a value for the visibility rule.';
      if (['number', 'scale'].includes(source.type) && !Number.isFinite(Number(rule.value))) return prefix + 'the rule needs a valid number.';
      if (source.type === 'boolean' && !['Yes', 'No'].includes(rule.value)) return prefix + 'choose Yes or No.';
      if (source.type === 'select' && !(source.options || []).includes(rule.value)) return prefix + 'choose an existing answer option.';
    }
  }
  return null;
}
