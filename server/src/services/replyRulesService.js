const HttpError = require('../errors/HttpError');
const replyRulesRepository = require('../db/replyRulesRepository');
const { renderReply, selectRule } = require('../lib/replyRules');

const UNIQUE_VIOLATION = '23505';

function conflict() {
  return new HttpError(409, 'CONFLICT', 'A rule for this path pattern already exists');
}

async function listRules() {
  return replyRulesRepository.list();
}

async function createRule(rule) {
  try {
    return await replyRulesRepository.create(rule);
  } catch (err) {
    throw err.code === UNIQUE_VIOLATION ? conflict() : err;
  }
}

async function updateRule(id, rule) {
  let updated;
  try {
    updated = await replyRulesRepository.update(id, rule);
  } catch (err) {
    throw err.code === UNIQUE_VIOLATION ? conflict() : err;
  }
  if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Reply rule not found');
  return updated;
}

async function deleteRule(id) {
  const deleted = await replyRulesRepository.deleteById(id);
  if (!deleted) throw new HttpError(404, 'NOT_FOUND', 'Reply rule not found');
}

/** The reply for a captured request: the most specific matching rule, or the default. */
async function resolveReply(path, { id }) {
  const rules = await replyRulesRepository.list();
  return renderReply(selectRule(rules, path), { id, timestamp: new Date().toISOString() });
}

module.exports = { listRules, createRule, updateRule, deleteRule, resolveReply };
