/* ============================================
   Sakura AI - Main JavaScript
   Production Version
   ============================================ */

// ── API Base ─────────────────────────────
const SAKURA_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

// ── Mobile Nav Toggle ──
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('mobile-open');
    hamburger.classList.toggle('active');
  });
}

// Close mobile nav on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('mobile-open');
    hamburger && hamburger.classList.remove('active');
  });
});

// ── Navbar scroll shadow ──
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.style.boxShadow = '0 4px 24px rgba(247,183,200,0.18)';
  } else {
    navbar.style.boxShadow = 'none';
  }
});

// ── Modal ──
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function switchModal(fromId, toId) {
  closeModal(fromId);
  setTimeout(() => openModal(toId), 150);
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
});

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ── FAQ Accordion ──
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // Close all
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));

    // Open clicked if it was closed
    if (!isOpen) item.classList.add('open');
  });
});

// ── Template / Tool Filter ──
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.templates-filter, .tools-filter');
    if (group) {
      group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    const cards  = document.querySelectorAll('[data-category]');

    cards.forEach(card => {
      if (filter === 'all' || card.dataset.category === filter) {
        card.style.display = '';
        card.style.animation = 'fadeUpIn 0.4s ease forwards';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// ── Scroll Fade-Up Animation ──
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

// ── Animated Counter ──
function animateCount(el, target, suffix = '') {
  let start = 0;
  const duration = 1800;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      el.textContent = target.toLocaleString() + suffix;
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(start).toLocaleString() + suffix;
    }
  }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        animateCount(el, target, suffix);
      });
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.hero-stats, .dash-stats').forEach(el => counterObserver.observe(el));

// ── Typing Effect (Hero) ──
function typeText(el, texts, speed = 50) {
  if (!el) return;
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function type() {
    const current = texts[textIndex];
    if (isDeleting) {
      el.textContent = current.substring(0, charIndex - 1);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex + 1);
      charIndex++;
    }

    if (!isDeleting && charIndex === current.length) {
      setTimeout(() => { isDeleting = true; }, 2000);
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      textIndex = (textIndex + 1) % texts.length;
    }

    setTimeout(type, isDeleting ? speed / 2 : speed);
  }
  type();
}

const typingEl = document.getElementById('typing-text');
if (typingEl) {
  typeText(typingEl, [
    'Write a professional blog post about AI trends...',
    'Generate a logo concept for my startup...',
    'Create a 30-second video script for Instagram...',
    'Analyze this CSV and summarize key insights...',
    'Fix the bug in my Python function...',
  ]);
}

// ── Contact Form ──
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    showToast('✅ Message sent! We\'ll get back to you soon.');
    contactForm.reset();
  });
}

// ── Auth Forms → redirect to auth page ──
document.querySelectorAll('.auth-form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const modal = form.closest('.modal-overlay');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    window.location.href = 'auth.html';
  });
});

// ── Try Tool → auth check ──
function tryTool(toolName) {
  const token = localStorage.getItem('sakura_token');
  if (!token) {
    window.location.href = 'auth.html?tab=signup';
  } else {
    window.location.href = 'tools.html';
  }
}

function copySubdomainUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ URL copied to clipboard!');
  }).catch(() => {
    showToast('📋 ' + url);
  });
}

function showCustomDomainInfo() {
  const info = document.getElementById('customDomainInfo');
  if (info) info.style.display = info.style.display === 'none' ? 'block' : 'none';
}

function linkCustomDomain() {
  const input = document.getElementById('customDomainInput');
  const domain = input ? input.value.trim() : '';
  if (!domain) { showToast('⚠️ Please enter a domain name'); return; }
  showToast(`🔗 Connecting ${domain}... DNS propagation may take up to 24 hours.`);
  localStorage.setItem('sakura_custom_domain', domain);
  if (input) input.value = '';
}

// ── Toast Notification ──
function showToast(message, duration = 3500) {
  let toast = document.getElementById('sakura-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sakura-toast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(80px);
      background: #2C2C2C; color: #fff; padding: 14px 28px; border-radius: 9999px;
      font-size: 14px; font-weight: 500; font-family: 'Poppins', sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2); z-index: 9999;
      transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease;
      opacity: 0; white-space: nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    toast.style.opacity = '0';
  }, duration);
}

// ── Sakura Petals ──
function createPetals(count = 8) {
  const container = document.querySelector('.hero, .page-hero');
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${8 + Math.random() * 10}px;
      height: ${8 + Math.random() * 10}px;
      animation-duration: ${6 + Math.random() * 8}s;
      animation-delay: ${Math.random() * 5}s;
      opacity: ${0.15 + Math.random() * 0.2};
    `;
    container.appendChild(petal);
  }
}
createPetals();

// ── Active Nav Link ──
(function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Page load fade-in ──
window.addEventListener('load', () => {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';
  requestAnimationFrame(() => {
    document.body.style.opacity = '1';
  });
});

console.log('🌸 Sakura AI loaded successfully!');
