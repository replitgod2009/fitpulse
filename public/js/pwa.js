document.documentElement.classList.add('fitpulse-ready');

function initMobileExperience() {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');
  if (!sidebar || !main || document.querySelector('.mobile-nav')) return;

  const links = [...sidebar.querySelectorAll('nav a')];
  const primaryLinks = links.slice(0, 4);
  const secondaryLinks = links.slice(4);

  function cloneNavLink(link, className) {
    const clone = link.cloneNode(true);
    const parts = link.textContent.trim().split(/\s+/);
    const icon = document.createElement('span');
    const label = document.createElement('span');
    icon.className = 'mobile-nav-icon';
    label.className = 'mobile-nav-label';
    icon.textContent = parts.shift() || '';
    label.textContent = parts.join(' ');
    clone.textContent = '';
    clone.append(icon, label);
    clone.className = className;
    return clone;
  }

  const mobileBrand = document.createElement('div');
  mobileBrand.className = 'mobile-brand';
  mobileBrand.innerHTML = '<a href="/dashboard.html"><img class="mobile-brand-mark" src="/assets/fitpulse-mark.png" alt="" /><span>FitPulse</span></a><span class="mobile-brand-status">YOUR MOMENTUM</span>';
  main.prepend(mobileBrand);

  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.setAttribute('aria-label', 'Mobile navigation');

  primaryLinks.forEach((link) => {
    const clone = cloneNavLink(link, 'mobile-nav-link');
    if (link.classList.contains('active')) clone.setAttribute('aria-current', 'page');
    mobileNav.appendChild(clone);
  });

  const more = document.createElement('div');
  more.className = 'mobile-more';
  const moreButton = document.createElement('button');
  moreButton.className = 'mobile-nav-link mobile-nav-more';
  moreButton.type = 'button';
  moreButton.setAttribute('aria-expanded', 'false');
  moreButton.innerHTML = '<span class="mobile-nav-icon">•••</span><span>More</span>';

  const morePanel = document.createElement('div');
  morePanel.className = 'mobile-more-panel';
  morePanel.setAttribute('aria-hidden', 'true');
  secondaryLinks.forEach((link) => {
    const clone = cloneNavLink(link, 'mobile-more-link');
    if (link.classList.contains('active')) clone.setAttribute('aria-current', 'page');
    morePanel.appendChild(clone);
  });

  const mobileLogout = document.createElement('button');
  mobileLogout.className = 'mobile-more-link mobile-more-logout';
  mobileLogout.type = 'button';
  mobileLogout.textContent = '↪ Log out';
  mobileLogout.addEventListener('click', () => {
    if (typeof api !== 'undefined') api.clearAuth();
    else {
      localStorage.removeItem('fp_token');
      localStorage.removeItem('fp_user');
    }
    window.location.href = '/login.html';
  });
  morePanel.appendChild(mobileLogout);

  moreButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = more.classList.toggle('open');
    moreButton.setAttribute('aria-expanded', String(open));
    morePanel.setAttribute('aria-hidden', String(!open));
  });

  more.append(moreButton, morePanel);
  mobileNav.appendChild(more);
  document.body.appendChild(mobileNav);

  document.addEventListener('click', (event) => {
    if (!more.contains(event.target)) {
      more.classList.remove('open');
      moreButton.setAttribute('aria-expanded', 'false');
      morePanel.setAttribute('aria-hidden', 'true');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileExperience);
} else {
  initMobileExperience();
}
