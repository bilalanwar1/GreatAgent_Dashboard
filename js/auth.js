/**
 * GreatAgen Auth (localStorage demo)
 * Swap storage helpers later for a real API / database without changing page call sites.
 */
(function (global) {
  const USERS_KEY = 'greatagen_users';
  const SESSION_KEY = 'greatagen_session';
  const PREFILL_KEY = 'greatagen_login_prefill';

  const PATHS = {
    dashboard: 'index.html',
    signup: 'signup.html',
    login: 'login.html',
    forgotPassword: 'forgot-password.html'
  };

  function readUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company || '',
      avatar: user.avatar || '',
      createdAt: user.createdAt
    };
  }

  function setSession(user) {
    const session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      company: user.company || '',
      avatar: user.avatar || '',
      loggedInAt: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId || !session.email) return null;
      return session;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const user = readUsers().find((u) => u.id === session.userId || normalizeEmail(u.email) === normalizeEmail(session.email));
    if (user) return publicUser(user);
    return {
      id: session.userId,
      name: session.name,
      email: session.email,
      company: session.company || '',
      avatar: session.avatar || ''
    };
  }

  function findCurrentUserIndex(users) {
    const session = getSession();
    if (!session) return -1;
    return users.findIndex((u) => u.id === session.userId || normalizeEmail(u.email) === normalizeEmail(session.email));
  }

  function updateProfile({ name, email, company }) {
    const users = readUsers();
    const idx = findCurrentUserIndex(users);
    if (idx < 0) return { ok: false, error: 'Not logged in' };

    const trimmedName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const trimmedCompany = String(company || '').trim();

    if (!trimmedName) return { ok: false, error: 'Enter your name' };
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: 'Enter a valid email' };
    }
    const emailTaken = users.some((u, i) => i !== idx && normalizeEmail(u.email) === normalizedEmail);
    if (emailTaken) return { ok: false, error: 'That email is already in use' };

    users[idx].name = trimmedName;
    users[idx].email = normalizedEmail;
    users[idx].company = trimmedCompany;
    writeUsers(users);
    setSession(users[idx]);
    return { ok: true, user: publicUser(users[idx]) };
  }

  function changePassword({ currentPassword, newPassword, confirmPassword }) {
    const users = readUsers();
    const idx = findCurrentUserIndex(users);
    if (idx < 0) return { ok: false, error: 'Not logged in' };

    const current = String(currentPassword || '');
    const next = String(newPassword || '');
    const confirm = String(confirmPassword || '');

    if (users[idx].password !== current) return { ok: false, error: 'Current password is incorrect' };
    if (next.length < 6) return { ok: false, error: 'New password must be at least 6 characters' };
    if (next !== confirm) return { ok: false, error: 'New passwords do not match' };

    users[idx].password = next;
    writeUsers(users);
    return { ok: true };
  }

  function updateAvatar(dataUrl) {
    const users = readUsers();
    const idx = findCurrentUserIndex(users);
    if (idx < 0) return { ok: false, error: 'Not logged in' };
    if (dataUrl && dataUrl.length > 900000) {
      return { ok: false, error: 'Image is too large — try a smaller photo' };
    }
    users[idx].avatar = dataUrl || '';
    writeUsers(users);
    setSession(users[idx]);
    return { ok: true, user: publicUser(users[idx]) };
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function signup({ name, email, password, confirmPassword }) {
    const trimmedName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const pass = String(password || '');
    const confirm = String(confirmPassword || '');

    if (!trimmedName) return { ok: false, error: 'Enter your name' };
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: 'Enter a valid email' };
    }
    if (pass.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
    if (pass !== confirm) return { ok: false, error: 'Passwords do not match' };

    const users = readUsers();
    if (users.some((u) => normalizeEmail(u.email) === normalizedEmail)) {
      return { ok: false, error: 'An account with this email already exists' };
    }

    const user = {
      id: 'usr_' + Math.random().toString(36).slice(2, 10),
      name: trimmedName,
      email: normalizedEmail,
      // Demo only — replace with hashed server-side auth later
      password: pass,
      createdAt: Date.now()
    };
    users.push(user);
    writeUsers(users);
    // Do not auto-login — send credentials to login page for the user to confirm
    setLoginPrefill({ email: normalizedEmail, password: pass, name: trimmedName });
    return { ok: true, user: publicUser(user) };
  }

  function setLoginPrefill({ email, password, name }) {
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
        email: normalizeEmail(email),
        password: String(password || ''),
        name: String(name || '').trim()
      }));
    } catch (e) {}
  }

  function consumeLoginPrefill() {
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY);
      sessionStorage.removeItem(PREFILL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const pass = String(password || '');
    if (!normalizedEmail || !pass) return { ok: false, error: 'Enter email and password' };

    const user = readUsers().find((u) => normalizeEmail(u.email) === normalizedEmail);
    if (!user || user.password !== pass) {
      return { ok: false, error: 'Invalid email or password' };
    }
    const session = setSession(user);
    return { ok: true, user: publicUser(user), session };
  }

  function resetPassword({ email, newPassword, confirmPassword }) {
    const normalizedEmail = normalizeEmail(email);
    const next = String(newPassword || '');
    const confirm = String(confirmPassword || '');

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: 'Enter a valid email' };
    }
    const users = readUsers();
    const idx = users.findIndex((u) => normalizeEmail(u.email) === normalizedEmail);
    if (idx < 0) return { ok: false, error: 'No account found with that email' };
    if (next.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
    if (next !== confirm) return { ok: false, error: 'Passwords do not match' };

    users[idx].password = next;
    writeUsers(users);
    setLoginPrefill({
      email: normalizedEmail,
      password: next,
      name: users[idx].name
    });
    return { ok: true, user: publicUser(users[idx]) };
  }

  const EYE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.82 21.82 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function passwordToggleMarkup(visible) {
    return visible ? EYE_OFF_ICON : EYE_ICON;
  }

  function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = passwordToggleMarkup(show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('title', show ? 'Hide password' : 'Show password');
    }
  }

  function logout() {
    clearSession();
  }

  function requireAuth(redirectTo) {
    if (!isLoggedIn()) {
      location.replace(redirectTo || PATHS.signup);
      return false;
    }
    return true;
  }

  function redirectIfAuthenticated(redirectTo) {
    if (isLoggedIn()) {
      location.replace(redirectTo || PATHS.dashboard);
      return true;
    }
    return false;
  }

  function firstName(fullName) {
    const n = String(fullName || '').trim();
    if (!n) return 'there';
    return n.split(/\s+/)[0];
  }

  function initials(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  global.Auth = {
    PATHS,
    getSession,
    getCurrentUser,
    isLoggedIn,
    signup,
    login,
    logout,
    resetPassword,
    updateProfile,
    changePassword,
    updateAvatar,
    requireAuth,
    redirectIfAuthenticated,
    setLoginPrefill,
    consumeLoginPrefill,
    togglePassword,
    firstName,
    initials
  };
})(window);
