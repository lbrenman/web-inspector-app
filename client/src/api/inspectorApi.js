import { request } from './http.js';

export function getInfo() {
  return request('/info');
}

export function listRequests({ limit = 50, before } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before !== undefined) {
    params.set('before', String(before));
  }
  return request(`/requests?${params}`);
}

export function getRequest(id) {
  return request(`/requests/${id}`);
}

export function deleteRequest(id) {
  return request(`/requests/${id}`, { method: 'DELETE' });
}

export function clearRequests() {
  return request('/requests', { method: 'DELETE' });
}

export function listPatterns() {
  return request('/patterns');
}

export function getPatternTable(hash) {
  return request(`/patterns/${hash}/table`);
}

function jsonRequest(method, data) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export function listReplyRules() {
  return request('/reply-rules');
}

export function createReplyRule(rule) {
  return request('/reply-rules', jsonRequest('POST', rule));
}

export function updateReplyRule(id, rule) {
  return request(`/reply-rules/${id}`, jsonRequest('PUT', rule));
}

export function deleteReplyRule(id) {
  return request(`/reply-rules/${id}`, { method: 'DELETE' });
}
