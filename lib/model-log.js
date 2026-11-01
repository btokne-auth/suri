// lib/model-log.js
// One plain line per real model call, for the server log (terminal / Vercel
// logs). Names the provider and model ID, the task and the time taken.
// Never logs document text, prompts, answers or keys.
// Example: [suri] meta · muse-spark-1.3 · read valid_id · 5.8s · ok

function logModelCall({ provider, model, task, ms, ok, status }) {
  const secs = typeof ms === 'number' ? (ms / 1000).toFixed(1) + 's' : '?';
  const end = ok ? 'ok' : 'error' + (status ? ' ' + status : '');
  const line = ['[suri]', String(provider || '?'), '·', String(model || '?'), '·', String(task || 'call').slice(0, 60), '·', secs, '·', end].join(' ');
  console.log(line);
  return line;
}

// Short note added to a work-log message so the page can show which model
// did the work: " | model=muse-spark-1.3 | 5.8s". Empty when unknown.
function callNote(call) {
  if (!call || !call.model || typeof call.ms !== 'number') return '';
  return ' | model=' + String(call.model).slice(0, 60) + ' | ' + (call.ms / 1000).toFixed(1) + 's';
}

module.exports = { logModelCall, callNote };
