const modalBackdrop = document.querySelector('[data-modal-backdrop]');
const menuButton = document.querySelector('[data-menu-button]');
const mainNav = document.querySelector('.main-nav');
const paymentBackdrop = document.querySelector('[data-payment-backdrop]');
const chatPanel = document.querySelector('[data-chat-panel]');
const paymentCopy = document.querySelector('[data-payment-copy]');
const utrForm = document.querySelector('[data-utr-form]');
const utrInput = document.querySelector('[data-utr-input]');
const utrStatus = document.querySelector('[data-utr-status]');
const paymentScreenshot = document.querySelector('[data-payment-screenshot]');
const signupForm = document.querySelector('[data-signup-form]');
const loginForm = document.querySelector('[data-login-form]');
const modalTitle = document.querySelector('[data-modal-title]');
const modalCopy = document.querySelector('[data-modal-copy]');
const modalEyebrow = document.querySelector('[data-modal-eyebrow]');
const profileHome = document.querySelector('[data-profile-home]');
const profileChip = document.querySelector('[data-profile-chip]');
const profileName = document.querySelector('[data-profile-name]');
const summaryEmail = document.querySelector('[data-summary-email]');
const summaryInterest = document.querySelector('[data-summary-interest]');
const profileAvatar = document.querySelector('[data-summary-avatar]');
const profileLabel = document.querySelector('[data-profile-label]');
const profilePhotoInput = document.querySelector('[data-profile-photo]');
const photoPreview = document.querySelector('[data-photo-preview]');
const summaryPhoto = document.querySelector('[data-summary-photo]');
const memberSearch = document.querySelector('[data-member-search]');
const searchCount = document.querySelector('[data-search-count]');
const profileGrid = document.querySelector('.profile-grid');
const signupTriggers = document.querySelectorAll('[data-open-modal="signup"]');
const notificationsPopover = document.querySelector('[data-notifications-popover]');
const messagesPopover = document.querySelector('[data-messages-popover]');
const inboxBackdrop = document.querySelector('[data-inbox-backdrop]');
const conversationList = document.querySelector('[data-conversation-list]');
const threadName = document.querySelector('[data-thread-name]');
const threadLabel = document.querySelector('[data-thread-label]');
const threadAvatar = document.querySelector('[data-thread-avatar]');
const threadMessages = document.querySelector('[data-thread-messages]');
const threadForm = document.querySelector('[data-thread-form]');
const threadInput = document.querySelector('[data-thread-input]');
const profileDetailBackdrop = document.querySelector('[data-profile-detail-backdrop]');
const profileDetailImage = document.querySelector('[data-profile-detail-image]');
const profileDetailName = document.querySelector('[data-profile-detail-name]');
const profileDetailMeta = document.querySelector('[data-profile-detail-meta]');
const profileDetailBio = document.querySelector('[data-profile-detail-bio]');
const profileMessageButton = document.querySelector('[data-profile-message]');
const profileVideoButton = document.querySelector('[data-profile-video]');
const profileLikeButton = document.querySelector('[data-profile-like]');
const notificationList = document.querySelector('[data-notification-list]');
const notificationCount = document.querySelector('[data-notification-count]');
let selectedPhoto = '';
let selectedProfileName = '';
let selectedPaymentType = 'Milan Plus';
let selectedCompanion = { name: 'Isha', interest: 'painting and meaningful conversations' };

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Server request failed.');
  return data;
}

function addNotification(name, text) {
  const savedNotifications = JSON.parse(localStorage.getItem('milan-notifications') || '[]');
  savedNotifications.unshift({ name, text });
  localStorage.setItem('milan-notifications', JSON.stringify(savedNotifications.slice(0, 10)));
  const item = document.createElement('button');
  item.className = 'activity-item';
  item.type = 'button';
  item.innerHTML = `<span class="activity-avatar">${name.charAt(0)}</span><span><strong>${name}</strong> ${text}<small>Just now</small></span>`;
  notificationList.prepend(item);
  const count = notificationList.querySelectorAll('.activity-item').length;
  notificationCount.textContent = `${count} new`;
}

function hasApprovedPayment(type) {
  const payment = JSON.parse(localStorage.getItem('milan-payment') || 'null');
  return payment?.status === 'approved' && payment.type === type;
}

function openPayment(type, copy) {
  selectedPaymentType = type;
  paymentCopy.textContent = copy;
  utrForm.reset();
  utrStatus.textContent = '';
  utrStatus.classList.remove('is-visible');
  paymentScreenshot.disabled = false;
  utrInput.disabled = false;
  utrForm.querySelector('button[type="submit"]').disabled = false;
  paymentBackdrop.classList.add('is-open');
  paymentBackdrop.setAttribute('aria-hidden', 'false');
}

const savedNotifications = JSON.parse(localStorage.getItem('milan-notifications') || '[]');
savedNotifications.reverse().forEach(({ name, text }) => {
  const item = document.createElement('button');
  item.className = 'activity-item';
  item.type = 'button';
  item.innerHTML = `<span class="activity-avatar">${name.charAt(0)}</span><span><strong>${name}</strong> ${text}<small>Earlier</small></span>`;
  notificationList.prepend(item);
});

function togglePopover(popover, otherPopover) {
  const shouldOpen = popover.hidden;
  otherPopover.hidden = true;
  popover.hidden = !shouldOpen;
}

document.querySelector('[data-notifications-toggle]').addEventListener('click', () => togglePopover(notificationsPopover, messagesPopover));
document.querySelector('[data-messages-toggle]').addEventListener('click', () => togglePopover(messagesPopover, notificationsPopover));
document.querySelector('[data-open-all-messages]').addEventListener('click', () => {
  messagesPopover.hidden = true;
  inboxBackdrop.classList.add('is-open');
  inboxBackdrop.setAttribute('aria-hidden', 'false');
});
document.querySelectorAll('[data-message-from]').forEach((item) => {
  item.addEventListener('click', () => {
    messagesPopover.hidden = true;
    openInbox(item.dataset.messageFrom);
  });
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.social-popover') && !event.target.closest('.header-icon')) {
    notificationsPopover.hidden = true;
    messagesPopover.hidden = true;
  }
});

function showProfile(profile) {
  const name = profile.name || profile.email.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Milan member';
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  profileHome.hidden = false;
  profileChip.hidden = false;
  signupTriggers.forEach((trigger) => {
    trigger.hidden = true;
  });
  profileName.textContent = displayName;
  summaryEmail.textContent = profile.email;
  summaryInterest.textContent = profile.interest;
  profileAvatar.textContent = displayName.charAt(0).toUpperCase();
  profileLabel.textContent = displayName;
  if (profile.photo) {
    summaryPhoto.src = profile.photo;
    summaryPhoto.hidden = false;
    profileAvatar.hidden = true;
  }
}

const savedProfile = localStorage.getItem('milan-profile');
if (savedProfile) {
  try {
    showProfile(JSON.parse(savedProfile));
  } catch {
    localStorage.removeItem('milan-profile');
  }
}

function renderUserProfiles() {
  const profiles = JSON.parse(localStorage.getItem('milan-profiles') || '[]');
  profiles.forEach((profile) => {
    if (profileGrid.querySelector(`[data-user-email="${CSS.escape(profile.email)}"]`)) return;
    const card = document.createElement('article');
    card.className = 'member-card user-profile-card';
    card.dataset.tags = 'all nearby online';
    card.dataset.userEmail = profile.email;
    card.innerHTML = `<div class="member-photo"><div class="user-profile-avatar">${profile.name.charAt(0).toUpperCase()}</div><span class="online-dot">Online</span></div><div class="member-meta"><div><h3></h3><p></p></div><span class="interest"></span></div>`;
    card.querySelector('h3').textContent = `${profile.name}, ${profile.age}`;
    card.querySelector('.member-meta p').textContent = `${profile.location} · Milan member`;
    card.querySelector('.interest').textContent = profile.interest;
    profileGrid.prepend(card);
    card.addEventListener('click', () => openProfileDetails(card));
  });
}

function addThreadBubble(text, className) {
  const bubble = document.createElement('div');
  bubble.className = `thread-bubble ${className}`;
  bubble.textContent = text;
  threadMessages.appendChild(bubble);
  threadMessages.scrollTop = threadMessages.scrollHeight;
}

async function answerCompanion(text) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        persona: selectedCompanion.name,
        context: `The profile is an AI companion. Interests: ${selectedCompanion.interest}.`,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI companion unavailable.');
    addThreadBubble(data.reply, 'received ai-message');
  } catch (error) {
    addThreadBubble(`Sorry, I could not reply right now. ${error.message}`, 'received ai-message');
  }
}

renderUserProfiles();

if (!localStorage.getItem('milan-authenticated')) {
  signupForm.hidden = false;
  loginForm.hidden = true;
  modalEyebrow.textContent = 'Join Milan';
  modalTitle.innerHTML = 'Start with<br><em>something real.</em>';
  modalCopy.textContent = 'Create your profile with an email and password to enter the Milan community.';
  setModal(true);
}

profilePhotoInput.addEventListener('change', () => {
  const file = profilePhotoInput.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    profilePhotoInput.value = '';
    photoPreview.hidden = false;
    photoPreview.textContent = 'Please choose an image smaller than 3 MB.';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    selectedPhoto = reader.result;
    photoPreview.hidden = false;
    photoPreview.style.backgroundImage = `url("${selectedPhoto}")`;
    photoPreview.textContent = '';
  });
  reader.readAsDataURL(file);
});

function setModal(open) {
  modalBackdrop.classList.toggle('is-open', open);
  modalBackdrop.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.openModal === 'plans') {
      if (button.dataset.plan === 'video') {
        openPayment('Video Connect', 'Scan the QR code with any UPI app, then send ₹399 to activate Video Connect with 1:1 video calls.');
      } else {
        openPayment('Milan Plus', 'Scan the QR code with any UPI app, then send ₹149 to activate Milan Plus.');
      }
    } else {
      const isLogin = button.dataset.openModal === 'login';
      signupForm.hidden = isLogin;
      loginForm.hidden = !isLogin;
      modalEyebrow.textContent = isLogin ? 'Welcome back' : 'Welcome to Milan';
      modalTitle.innerHTML = isLogin ? 'Good to<br><em>see you again.</em>' : 'Make room for<br><em>something real.</em>';
      modalCopy.textContent = isLogin ? 'Log in to continue your conversations and discover new connections.' : 'Create your free profile and start meeting people who are looking for the same thing.';
      setModal(true);
    }
  });
});

document.querySelector('[data-close-modal]').addEventListener('click', () => setModal(false));
modalBackdrop.addEventListener('click', (event) => {
  if (event.target === modalBackdrop) setModal(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setModal(false);
  if (event.key === 'Escape') paymentBackdrop.classList.remove('is-open');
});

document.querySelector('[data-close-payment]').addEventListener('click', () => paymentBackdrop.classList.remove('is-open'));
paymentBackdrop.addEventListener('click', (event) => {
  if (event.target === paymentBackdrop) paymentBackdrop.classList.remove('is-open');
});
document.querySelector('[data-copy-upi]').addEventListener('click', async (event) => {
  await navigator.clipboard.writeText('mohd92810-2@oksbi');
  event.currentTarget.textContent = 'Copied ✓';
});
utrForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const utr = utrInput.value.trim();
  const screenshot = paymentScreenshot.files[0];
  if (!screenshot || !utr) return;
  if (screenshot.size > 3 * 1024 * 1024) {
    utrStatus.textContent = 'Please choose a payment screenshot smaller than 3 MB.';
    utrStatus.classList.add('is-visible');
    return;
  }
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  const reader = new FileReader();
  submitButton.disabled = true;
  reader.addEventListener('load', async () => {
    const profile = JSON.parse(localStorage.getItem('milan-profile') || 'null');
    try {
      await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          email: profile?.email || '',
          planType: selectedPaymentType,
          utr,
          screenshot: reader.result,
        }),
      });
      localStorage.setItem('milan-pending-payment', JSON.stringify({
        type: selectedPaymentType,
        utr,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      }));
      utrStatus.textContent = 'Payment submitted for admin approval. Access will unlock after verification.';
      utrStatus.classList.add('is-visible');
      paymentScreenshot.disabled = true;
      utrInput.disabled = true;
    } catch (error) {
      utrStatus.textContent = error.message;
      utrStatus.classList.add('is-visible');
      submitButton.disabled = false;
    }
  });
  reader.readAsDataURL(screenshot);
});

function getProfileDetails(card) {
  const heading = card.querySelector('h3');
  const image = card.querySelector('img');
  const meta = card.querySelector('.member-meta p, .featured-woman p');
  const online = card.querySelector('.online-dot');
  const name = heading ? heading.textContent.replace('✓', '').trim() : image.alt;
  const details = meta ? meta.textContent.split('·').map((part) => part.trim()) : [];
  return {
    name,
    location: details[0] || 'Nearby',
    interest: details.slice(1).join(' · ') || 'Good conversations',
    status: online ? online.textContent : 'Recently active',
    image: image ? image.src : '',
  };
}

function openProfileDetails(card) {
  const profile = getProfileDetails(card);
  selectedProfileName = profile.name;
  profileDetailImage.src = profile.image;
  profileDetailImage.alt = profile.name;
  profileDetailName.textContent = profile.name;
  profileDetailMeta.textContent = `${profile.location} · ${profile.status}`;
  profileDetailBio.textContent = `${profile.name.split(',')[0]} is into ${profile.interest.toLowerCase()} and open to a genuine connection.`;
  profileLikeButton.classList.remove('is-liked');
  profileLikeButton.textContent = '♡ Like';
  profileDetailBackdrop.classList.add('is-open');
  profileDetailBackdrop.setAttribute('aria-hidden', 'false');
}

function closeProfileDetails() {
  profileDetailBackdrop.classList.remove('is-open');
  profileDetailBackdrop.setAttribute('aria-hidden', 'true');
}

const conversationMessages = {
  Isha: ['Hey! Your profile looks interesting ✦', 'What kind of conversations do you enjoy?'],
  Tara: ['Hi, how is your day going?'],
  Naina: ['Would love to hear about your travels'],
};

function openInbox(name = 'Isha') {
  inboxBackdrop.classList.add('is-open');
  inboxBackdrop.setAttribute('aria-hidden', 'false');
  inboxBackdrop.querySelector('.inbox-modal').classList.remove('thread-open');
  selectConversation(name);
}

function selectConversation(name) {
  inboxBackdrop.querySelector('.inbox-modal').classList.add('thread-open');
  threadName.textContent = name;
  threadAvatar.textContent = name.charAt(0);
  selectedCompanion = {
    name,
    interest: conversationMessages[name]?.[0] || 'meaningful conversations',
  };
  threadLabel.textContent = 'AI companion · online now';
  conversationList.querySelectorAll('.conversation').forEach((item) => {
    item.classList.toggle('active', item.dataset.conversation === name);
  });
  threadMessages.innerHTML = '<div class="thread-date">Today</div>';
  (conversationMessages[name] || []).forEach((text) => {
    const bubble = document.createElement('div');
    bubble.className = 'thread-bubble received';
    bubble.textContent = text;
    threadMessages.appendChild(bubble);
  });
  window.setTimeout(() => {
    if (inboxBackdrop.classList.contains('is-open') && threadName.textContent === name) {
      addThreadBubble(`Hi, I’m ${name}'s AI companion. Tell me what’s on your mind ✦`, 'received ai-message');
    }
  }, 1200);
}

function closeInbox() {
  inboxBackdrop.classList.remove('is-open');
  inboxBackdrop.setAttribute('aria-hidden', 'true');
}

document.querySelector('[data-close-inbox]').addEventListener('click', closeInbox);
inboxBackdrop.addEventListener('click', (event) => {
  if (event.target === inboxBackdrop) closeInbox();
});
conversationList.querySelectorAll('.conversation').forEach((item) => {
  item.addEventListener('click', () => selectConversation(item.dataset.conversation));
});
document.querySelector('[data-inbox-search]').addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase();
  conversationList.querySelectorAll('.conversation').forEach((item) => {
    item.hidden = !item.dataset.conversation.toLowerCase().includes(query);
  });
});
threadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = threadInput.value.trim();
  if (!text) return;
  if (!hasApprovedPayment('Milan Plus')) {
    closeInbox();
    openPayment('Milan Plus', 'Subscribe to Milan Plus for ₹149 to send messages and unlock AI companion replies.');
    threadInput.value = '';
    return;
  }
  addThreadBubble(text, 'sent');
  threadInput.value = '';
  answerCompanion(text);
});
document.querySelector('[data-thread-video]').addEventListener('click', () => {
  closeInbox();
  openPayment('Video Connect', `Pay ₹399 for Video Connect to request a private 1:1 video call with ${threadName.textContent}.`);
});

document.querySelectorAll('.member-card, .featured-woman').forEach((card) => {
  card.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input')) return;
    openProfileDetails(card);
  });
  card.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
      event.preventDefault();
      openProfileDetails(card);
    }
  });
});

document.querySelector('[data-close-profile]').addEventListener('click', closeProfileDetails);
profileDetailBackdrop.addEventListener('click', (event) => {
  if (event.target === profileDetailBackdrop) closeProfileDetails();
});
profileLikeButton.addEventListener('click', () => {
  profileLikeButton.classList.toggle('is-liked');
  profileLikeButton.textContent = profileLikeButton.classList.contains('is-liked') ? '♥ Liked' : '♡ Like';
  if (profileLikeButton.classList.contains('is-liked')) {
    addNotification(selectedProfileName, 'liked your profile');
  }
});
profileMessageButton.addEventListener('click', () => {
  if (hasApprovedPayment('Milan Plus')) {
    openInbox(selectedProfileName.split(',')[0]);
    return;
  }
  closeProfileDetails();
  openPayment('Milan Plus', `Subscribe to Milan Plus for ₹149 to message ${selectedProfileName} and unlock unlimited 1:1 chats.`);
});
profileVideoButton.addEventListener('click', () => {
  if (hasApprovedPayment('Video Connect')) {
    openInbox(selectedProfileName.split(',')[0]);
    return;
  }
  closeProfileDetails();
  openPayment('Video Connect', `Pay ₹399 for Video Connect to request a private 1:1 video call with ${selectedProfileName}.`);
});

const chatMessages = document.querySelector('[data-chat-messages]');
const chatInput = document.querySelector('[data-chat-input]');
function addChatMessage(text, className) {
  const message = document.createElement('div');
  message.className = className;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
async function answerBot(text) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Chat service unavailable.');
    addChatMessage(data.reply, 'bot-message');
  } catch (error) {
    addChatMessage(`Sorry, I could not connect right now. ${error.message}`, 'bot-message');
  }
}
document.querySelector('[data-chat-toggle]').addEventListener('click', () => chatPanel.classList.toggle('is-open'));
document.querySelector('[data-chat-close]').addEventListener('click', () => chatPanel.classList.remove('is-open'));
document.querySelectorAll('[data-quick]').forEach((button) => button.addEventListener('click', () => { addChatMessage(button.dataset.quick, 'user-message'); answerBot(button.dataset.quick); }));
document.querySelector('[data-chat-form]').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMessage(text, 'user-message');
  chatInput.value = '';
  answerBot(text);
});

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  mainNav.classList.toggle('mobile-open', !isOpen);
});

document.querySelectorAll('.filter').forEach((filter) => {
  filter.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'));
    filter.classList.add('active');
    const selected = filter.dataset.filter;
    document.querySelectorAll('.member-card').forEach((card) => {
      card.hidden = selected !== 'all' && !card.dataset.tags.split(' ').includes(selected);
    });
  });
});

document.querySelectorAll('.save-profile').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '♥' : '♡';
  });

  document.querySelectorAll('.featured-woman').forEach((card) => {
    if (card.querySelector('.featured-actions')) return;
    const name = card.querySelector('h3').textContent.replace('✓', '').trim();
    const actions = document.createElement('div');
    actions.className = 'featured-actions';
    actions.innerHTML = `<button class="profile-action chat-action" type="button">Message</button><button class="profile-action like-action" type="button">♡ <span>Like</span></button><button class="profile-action comment-action" type="button">Comment</button>`;
    const commentBox = document.createElement('div');
    commentBox.className = 'comment-box';
    commentBox.hidden = true;
    commentBox.innerHTML = '<input type="text" placeholder="Write a comment..." maxlength="120"><button type="button">Post</button><div class="comment-list"></div>';
    card.append(actions, commentBox);

    actions.querySelector('.chat-action').addEventListener('click', () => {
      openPayment('Milan Plus', `Subscribe to Milan Plus for ₹149 to message ${name} and unlock unlimited 1:1 chats.`);
    });
    actions.querySelector('.like-action').addEventListener('click', (event) => {
      const button = event.currentTarget;
      button.classList.toggle('is-liked');
      button.innerHTML = button.classList.contains('is-liked') ? '♥ <span>Liked</span>' : '♡ <span>Like</span>';
      if (button.classList.contains('is-liked')) {
        addNotification(name, 'liked your profile');
      }
    });
    actions.querySelector('.comment-action').addEventListener('click', () => {
      commentBox.hidden = !commentBox.hidden;
      if (!commentBox.hidden) commentBox.querySelector('input').focus();
    });
    commentBox.querySelector('button').addEventListener('click', () => {
      const input = commentBox.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      const comment = document.createElement('p');
      comment.textContent = text;
      commentBox.querySelector('.comment-list').appendChild(comment);
      input.value = '';
    });
  });

  document.querySelector('[data-load-more]').addEventListener('click', (event) => {
    document.querySelector('[data-filter="nearby"]').click();
    event.currentTarget.textContent = 'Showing all nearby profiles ✓';
    event.currentTarget.disabled = true;
  });
});

signupForm.querySelector('select').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    signupForm.requestSubmit();
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = event.currentTarget.querySelector('[data-login-status]');
  const submit = event.currentTarget.querySelector('.modal-submit');
  submit.disabled = true;
  const email = loginForm.querySelector('input[type="email"]').value.trim();
  try {
    const profile = JSON.parse(localStorage.getItem('milan-profile') || 'null');
    if (profile?.email?.toLowerCase() === email.toLowerCase()) {
      await apiRequest('/api/users/track', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
    }
    localStorage.setItem('milan-authenticated', 'true');
    submit.innerHTML = 'Logged in <span>✓</span>';
    status.textContent = 'Welcome back. Your activity has been saved securely.';
    status.classList.add('is-visible');
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('is-visible');
    submit.disabled = false;
  }
});
signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = signupForm.querySelector('input[type="email"]').value.trim();
  const password = signupForm.querySelector('input[type="password"]').value;
  const name = signupForm.querySelector('input[type="text"]').value.trim();
  const age = signupForm.querySelector('input[type="number"]').value;
  const location = signupForm.querySelectorAll('input[type="text"]')[1].value.trim();
  const interest = signupForm.querySelector('select').value;
  const profile = { email, interest, name, age, location };
  profile.photo = selectedPhoto;
  profile.passwordSet = Boolean(password);
  const profiles = JSON.parse(localStorage.getItem('milan-profiles') || '[]');
  const existingIndex = profiles.findIndex((item) => item.email.toLowerCase() === email.toLowerCase());
  if (existingIndex >= 0) profiles[existingIndex] = profile;
  else profiles.push(profile);
  const submit = event.currentTarget.querySelector('.modal-submit');
  const status = event.currentTarget.querySelector('[data-signup-status]');
  submit.disabled = true;
  apiRequest('/api/users/track', {
    method: 'POST',
    body: JSON.stringify({ email, name, age, location, interest }),
  }).then(() => {
    localStorage.setItem('milan-profiles', JSON.stringify(profiles));
    localStorage.setItem('milan-profile', JSON.stringify(profile));
    localStorage.setItem('milan-authenticated', 'true');
    showProfile(profile);
    renderUserProfiles();
    submit.innerHTML = 'You’re on the list <span>✓</span>';
    status.textContent = 'Profile started successfully! Your activity is now securely tracked.';
    status.classList.add('is-visible');
    window.setTimeout(() => {
      setModal(false);
      window.location.hash = '#home';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 700);
  }).catch((error) => {
    status.textContent = error.message;
    status.classList.add('is-visible');
    submit.disabled = false;
  });
});

memberSearch.addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  let matches = 0;
  document.querySelectorAll('.member-card').forEach((card) => {
    const isMatch = !query || card.textContent.toLowerCase().includes(query);
    card.hidden = !isMatch;
    if (isMatch) matches += 1;
  });
  searchCount.textContent = query ? `${matches} found` : '';
});
