const loginView = document.querySelector('[data-login-view]');
const dashboardView = document.querySelector('[data-dashboard-view]');
const loginForm = document.querySelector('[data-admin-login]');
const loginStatus = document.querySelector('[data-login-status]');
const dashboardStatus = document.querySelector('[data-dashboard-status]');
const usersBody = document.querySelector('[data-users-body]');
const paymentsBody = document.querySelector('[data-payments-body]');
let csrfToken = '';

function setStatus(element, message, isError = false) {
  element.textContent = message || '';
  element.classList.toggle('is-error', isError);
  element.classList.toggle('is-visible', Boolean(message));
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function cell(textValue, className) {
  const element = document.createElement('td');
  element.textContent = textValue == null ? '—' : String(textValue);
  if (className) element.className = className;
  return element;
}

function renderUsers(users) {
  usersBody.replaceChildren();
  if (!users.length) {
    const row = document.createElement('tr');
    const empty = cell('No users have been tracked yet.');
    empty.colSpan = 6;
    row.appendChild(empty);
    usersBody.appendChild(row);
    return;
  }
  users.forEach((user) => {
    const row = document.createElement('tr');
    row.append(cell(user.name), cell(user.email), cell(user.age), cell(user.location), cell(user.interest), cell(formatDate(user.last_seen_at)));
    usersBody.appendChild(row);
  });
}

function renderPayment(payment) {
  const row = document.createElement('tr');
  row.append(cell(payment.user_email), cell(payment.plan_type), cell(payment.utr, 'utr'));
  const screenshotCell = document.createElement('td');
  if (payment.screenshot_data) {
    const image = document.createElement('img');
    image.className = 'screenshot-thumb';
    image.src = payment.screenshot_data;
    image.alt = `Payment screenshot for ${payment.user_email}`;
    image.addEventListener('click', () => window.open(payment.screenshot_data, '_blank', 'noopener,noreferrer'));
    screenshotCell.appendChild(image);
  } else {
    screenshotCell.textContent = 'Not provided';
  }
  row.appendChild(screenshotCell);
  const status = cell(payment.status);
  status.classList.add(`status-${payment.status}`);
  row.append(status, cell(formatDate(payment.submitted_at)));
  const action = document.createElement('td');
  action.className = 'payment-actions';
  if (payment.status === 'pending') {
    const approve = document.createElement('button');
    approve.className = 'action-button approve';
    approve.type = 'button';
    approve.textContent = 'Approve';
    approve.addEventListener('click', () => reviewPayment(payment.id, 'approved', approve));
    const reject = document.createElement('button');
    reject.className = 'action-button reject';
    reject.type = 'button';
    reject.textContent = 'Reject';
    reject.addEventListener('click', () => {
      const reason = window.prompt('Optional rejection reason:', 'Payment could not be verified.');
      if (reason !== null) reviewPayment(payment.id, 'rejected', reject, reason);
    });
    action.append(approve, reject);
  } else {
    action.textContent = payment.reviewed_by ? `Reviewed by ${payment.reviewed_by}` : 'Reviewed';
  }
  row.appendChild(action);
  return row;
}

function renderPayments(payments) {
  paymentsBody.replaceChildren();
  if (!payments.length) {
    const row = document.createElement('tr');
    const empty = cell('No payment submissions yet.');
    empty.colSpan = 7;
    row.appendChild(empty);
    paymentsBody.appendChild(row);
    return;
  }
  payments.forEach((payment) => paymentsBody.appendChild(renderPayment(payment)));
}

async function loadDashboard() {
  setStatus(dashboardStatus, 'Loading latest data…');
  try {
    const data = await api('/api/admin/dashboard');
    Object.entries(data.counts || {}).forEach(([key, value]) => {
      const target = document.querySelector(`[data-count="${key}"]`);
      if (target) target.textContent = value;
    });
    renderUsers(data.users || []);
    renderPayments(data.payments || []);
    document.querySelector('[data-admin-identity]').textContent = data.admin?.email || '';
    setStatus(dashboardStatus, '');
  } catch (error) {
    setStatus(dashboardStatus, error.message, true);
  }
}

async function reviewPayment(id, status, button, reason) {
  button.disabled = true;
  try {
    await api(`/api/admin/payments/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, reason: reason || '' }),
    });
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    setStatus(dashboardStatus, error.message, true);
  }
}

function showDashboard(csrf) {
  csrfToken = csrf || csrfToken;
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadDashboard();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus(loginStatus, 'Signing in…');
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: loginForm.elements.email.value,
        password: loginForm.elements.password.value,
      }),
    });
    loginForm.reset();
    showDashboard(data.csrfToken);
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('[data-refresh]').addEventListener('click', loadDashboard);
document.querySelector('[data-logout]').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    csrfToken = '';
    dashboardView.hidden = true;
    loginView.hidden = false;
    setStatus(loginStatus, 'You have been signed out.');
  }
});

(async function restoreSession() {
  try {
    const session = await api('/api/admin/session');
    showDashboard(session.csrfToken);
  } catch {
    loginView.hidden = false;
    dashboardView.hidden = true;
  }
}());
