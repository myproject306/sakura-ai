/* 🌸 Sakura AI Assistant — ChatGPT Style with Sakura Theme */
(function () {
  'use strict';

  var API = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api' : '/api';
  var PAGE = location.pathname.split('/').pop() || 'index.html';
  var panelOpen = false, greeted = false, isListening = false, isSpeaking = false, rec = null;

  /* ── Greetings ── */
  var GREET = {
    'index.html':          { ar: 'هاي هاي! 😄 أنا ساكورا، مساعدتك الذكية من Sakura AI 🌸 كيف يمكنني مساعدتك اليوم؟', en: "Heyy! 😄 I'm Sakura, your AI assistant from Sakura AI 🌸 How can I help you today?" },
    'tools.html':          { ar: 'أهلاً! 🎉 أنا ساكورا 🌸 لدينا 50+ أداة ذكاء اصطناعي رهيبة! أي أداة تبي؟', en: "Hey! 🎉 I'm Sakura 🌸 We have 50+ amazing AI tools! Which one do you need?" },
    'pricing.html':        { ar: 'هاي! 😄 أنا ساكورا 🌸 تبي تعرف الأسعار؟ Starter بـ 9$، Pro بـ 29$، Team بـ 79$ شهرياً!', en: "Hey! 😄 I'm Sakura 🌸 Wanna know pricing? Starter $9, Pro $29, Team $79/month!" },
    'dashboard.html':      { ar: 'أهلاً بك في لوحتك! 🎊 أنا ساكورا 🌸 كيف يمكنني مساعدتك اليوم؟', en: "Welcome to your dashboard! 🎊 I'm Sakura 🌸 How can I help you today?" },
    'auth.html':           { ar: 'هاي! 😊 أنا ساكورا 🌸 تحتاج مساعدة في تسجيل الدخول؟', en: "Hey! 😊 I'm Sakura 🌸 Need help with logging in?" },
    'contact.html':        { ar: 'هاي! 🌸 أنا ساكورا! تبي تتواصل معنا؟ راسلنا على support@sakura.ai 😄', en: "Hey! 🌸 I'm Sakura! Wanna contact us? Email support@sakura.ai 😄" },
    'templates.html':      { ar: 'أهلاً! 🎨 أنا ساكورا 🌸 لدينا قوالب رهيبة! أي قالب يناسبك؟', en: "Hey! 🎨 I'm Sakura 🌸 We have amazing templates! Which one fits you?" },
    'tool-interface.html': { ar: 'هاي! 🌸 أنا ساكورا! جاهزة أساعدك في استخدام هذه الأداة 😄', en: "Hey! 🌸 I'm Sakura! Ready to help you use this tool 😄" },
    'faq.html':            { ar: 'هاي! 😄 أنا ساكورا 🌸 عندك أسئلة؟ أنا هنا للإجابة!', en: "Hey! 😄 I'm Sakura 🌸 Got questions? I'm here to answer!" },
    'default':             { ar: 'هاي! 😄 أنا ساكورا، مساعدتك الذكية من Sakura AI 🌸 كيف يمكنني مساعدتك؟', en: "Hey! 😄 I'm Sakura, your AI assistant from Sakura AI 🌸 How can I help you?" }
  };

  /* ── Smart Responses ── */
  var SR = {
    ar: [
      { k: ['سعر', 'خطة', 'خطط', 'اشتراك', 'تكلف', 'كم', 'دولار', 'باقة', 'باقات', 'تسعير'], r: 'لدينا ثلاث خطط 🎂\n• **Starter**: 9$/شهر — للمبتدئين\n• **Pro**: 29$/شهر — للمحترفين\n• **Team**: 79$/شهر — للفرق\nوكلها فيها تجربة مجانية 7 أيام! 🎉' },
      { k: ['أداة', 'ادوات', 'أدوات', 'كتابة', 'صورة', 'صور', 'كود', 'صوت', 'فيديو', 'ذكاء'], r: 'لدينا 50+ أداة ذكاء اصطناعي! 😍\n✍️ كتابة، 🎨 صور، 💻 كود، 🎧 صوت\n📊 بيانات، 📚 دراسة، 🧠 أعمال\nأي واحدة تبي؟' },
      { k: ['تسجيل', 'حساب', 'دخول', 'اشترك', 'انضم'], r: 'إنشاء حساب سهل وسريع! 🎉\nانقر على "Start Free Trial" وستحصل على 7 أيام مجانية بدون بطاقة ائتمان 😄' },
      { k: ['عربي', 'عربية', 'لغة'], r: 'أكيد! 🌍 Sakura AI يدعم العربية والإنجليزية بشكل كامل!' },
      { k: ['مساعدة', 'كيف', 'شرح', 'ماذا'], r: 'بكل سرور! 😄🌸 أنا هنا عشانك!\nيمكنني مساعدتك في اختيار الأداة، فهم الخطط، أو أي سؤال. اسألني!' },
      { k: ['شكر', 'شكراً', 'ممتاز', 'رائع', 'حلو'], r: 'يسعدني! 😄🌸 أنت الأحلى!\nهل في شيء ثاني تبيه؟ 😊' },
      { k: ['مرحبا', 'هلا', 'السلام', 'اهلا', 'هاي'], r: 'هاي! 😄🌸 أهلاً وسهلاً!\nأنا ساكورا، مساعدتك الذكية! كيف يمكنني مساعدتك؟' },
      { k: ['تجربة', 'مجاني', 'مجانية'], r: 'نعم! 🎉 7 أيام مجانية!\nلا تحتاج بطاقة ائتمان. فقط سجّل وابدأ! 😄' },
      { k: ['دعم', 'تواصل', 'بريد'], r: 'تواصل معنا على support@sakura.ai 📧\nنحن سريعون في الرد! 😄' }
    ],
    en: [
      { k: ['price', 'plan', 'cost', 'subscription', 'how much'], r: "We have 3 plans 🎂\n• **Starter**: $9/mo — for beginners\n• **Pro**: $29/mo — for pros\n• **Team**: $79/mo — for teams\nAll include a 7-day FREE trial! 🎉" },
      { k: ['tool', 'tools', 'writing', 'image', 'code', 'audio'], r: "We have 50+ amazing AI tools! 😍\n✍️ Writing, 🎨 Images, 💻 Code, 🎧 Audio\n📊 Data, 📚 Study, 🧠 Business\nWhich one do you want?" },
      { k: ['sign up', 'register', 'account', 'login', 'signup'], r: "Creating an account is super easy! 🎉\nClick 'Start Free Trial' and get 7 days FREE — no credit card needed 😄" },
      { k: ['arabic', 'language', 'bilingual'], r: "Of course! 🌍 Sakura AI fully supports Arabic and English!" },
      { k: ['help', 'how', 'explain', 'what', 'guide'], r: "With pleasure! 😄🌸 I'm here for you!\nI can help with choosing tools, understanding plans, or any question. Just ask!" },
      { k: ['thank', 'thanks', 'great', 'awesome', 'amazing'], r: "You're so sweet! 😄🌸 Always here to help. Anything else you need? 😊" },
      { k: ['hello', 'hi', 'hey', 'heyy'], r: "Hey! 😄🌸 Welcome!\nI'm Sakura, your AI assistant! How can I help you?" },
      { k: ['free', 'trial', 'demo'], r: "Yes! 🎉 7 days FREE!\nNo credit card needed. Just sign up and start! 😄" },
      { k: ['support', 'contact', 'email'], r: "Email us at support@sakura.ai 📧\nWe reply fast! 😄" }
    ]
  };

  function detectLang(t) { return /[\u0600-\u06FF]/.test(t) ? 'ar' : 'en'; }

  function smartReply(text) {
    var lang = detectLang(text), lower = text.toLowerCase(), list = SR[lang];
    for (var i = 0; i < list.length; i++) {
      if (list[i].k.some(function (kw) { return lower.indexOf(kw) > -1; })) return list[i].r;
    }
    var arFallbacks = [
      'سؤال ممتاز! 😄🌸 للحصول على إجابة دقيقة، سجّل الدخول واستخدم أدواتنا الذكية، أو تواصل معنا على support@sakura.ai',
      'سؤال رائع! 😍 تواصل مع فريقنا على support@sakura.ai وسنساعدك! 🌸',
      'لا أعرف الإجابة الآن، لكن تواصل معنا على support@sakura.ai وسنساعدك! 🌸😄'
    ];
    var enFallbacks = [
      "Great question! 😄🌸 For a detailed answer, log in and use our AI tools, or contact us at support@sakura.ai",
      "Good question! 😍 Our team can help! Email support@sakura.ai 📧",
      "I'm not sure about that, but contact us at support@sakura.ai and we'll help! 🌸😄"
    ];
    var fallbacks = lang === 'ar' ? arFallbacks : enFallbacks;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async function getReply(text) {
    var token = localStorage.getItem('sakura_token');
    if (!token) return smartReply(text);
    try {
      var r = await fetch(API + '/tools/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ toolId: 'general-assistant', inputs: { prompt: 'You are Sakura, a friendly female AI assistant for Sakura AI. Answer in the same language as the user. Be helpful and concise. User: ' + text } })
      });
      if (r.ok) { var d = await r.json(); return d.result || d.output || smartReply(text); }
    } catch (e) { }
    return smartReply(text);
  }

  /* ── TTS — Female Voice Only ── */
  function getFemaleVoice(lang) {
    var voices = window.speechSynthesis.getVoices();
    if (lang === 'ar') {
      var v = voices.find(function (v) { return v.name.indexOf('Hoda') > -1; });
      if (!v) v = voices.find(function (v) {
        var n = v.name.toLowerCase();
        return v.lang.startsWith('ar') && (n.indexOf('hoda') > -1 || n.indexOf('layla') > -1 || n.indexOf('sara') > -1 || n.indexOf('female') > -1);
      });
      if (!v) v = voices.find(function (v) { return v.lang.startsWith('ar') && v.name.toLowerCase().indexOf('google') > -1; });
      if (!v) v = voices.find(function (v) { return v.lang.startsWith('ar') && v.name.toLowerCase().indexOf('naayf') === -1; });
      if (!v) v = voices.find(function (v) { return v.lang.startsWith('ar'); });
      return v;
    } else {
      var femaleEn = ['zira', 'samantha', 'victoria', 'karen', 'moira', 'fiona', 'tessa', 'sara', 'hana', 'google', 'female', 'woman', 'girl', 'alice', 'anna', 'nora', 'siri', 'aria', 'jenny', 'michelle', 'monica'];
      var maleEn = ['david', 'mark', 'daniel', 'reed', 'thomas', 'alex', 'fred', 'junior', 'albert', 'bruce', 'ralph', 'naayf'];
      var v = voices.find(function (v) {
        var n = v.name.toLowerCase();
        return v.lang.startsWith('en') && femaleEn.some(function (k) { return n.indexOf(k) > -1; }) && !maleEn.some(function (k) { return n.indexOf(k) > -1; });
      });
      if (!v) v = voices.find(function (v) {
        var n = v.name.toLowerCase();
        return v.lang.startsWith('en-US') && !maleEn.some(function (k) { return n.indexOf(k) > -1; });
      });
      if (!v) v = voices.find(function (v) { return v.lang.startsWith('en'); });
      return v;
    }
  }

  function speak(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var clean = text.replace(/\*\*/g, '').replace(/[#*_~`]/g, '');
    var u = new SpeechSynthesisUtterance(clean);
    if (lang === 'ar') { u.lang = 'ar-SA'; u.rate = 0.92; u.pitch = 1.6; u.volume = 1; }
    else { u.lang = 'en-US'; u.rate = 1.05; u.pitch = 1.35; u.volume = 1; }
    var v = getFemaleVoice(lang);
    if (v) u.voice = v;
    u.onstart = function () { isSpeaking = true; waveOn(); };
    u.onend = function () { isSpeaking = false; waveOff(); };
    u.onerror = function () { isSpeaking = false; waveOff(); };
    window.speechSynthesis.speak(u);
  }

  function stopSpeak() { if (window.speechSynthesis) { window.speechSynthesis.cancel(); isSpeaking = false; waveOff(); } }

  /* ── STT ── */
  function initRec() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'ar-SA,en-US';
    r.onstart = function () { isListening = true; micOn(true); };
    r.onresult = function (e) {
      var t = Array.from(e.results).map(function (r) { return r[0].transcript; }).join('');
      var inp = document.getElementById('sk-inp');
      if (inp) inp.value = t;
      if (e.results[e.results.length - 1].isFinal) handleMsg(t);
    };
    r.onerror = function () { isListening = false; micOn(false); };
    r.onend = function () { isListening = false; micOn(false); };
    return r;
  }

  function toggleMic() {
    if (!rec) rec = initRec();
    if (!rec) { alert('Voice recognition not supported in this browser.'); return; }
    if (isListening) { rec.stop(); }
    else { stopSpeak(); try { rec.start(); } catch (e) { rec = initRec(); if (rec) rec.start(); } }
  }

  /* ── UI Helpers ── */
  function micOn(on) {
    var b = document.getElementById('sk-mic');
    if (!b) return;
    if (on) b.classList.add('listening'); else b.classList.remove('listening');
  }

  function waveOn() {
    var w = document.getElementById('sk-wave');
    if (w) { w.classList.add('on'); w.querySelectorAll('.sk-wbar').forEach(function (b) { b.classList.add('on'); }); }
  }

  function waveOff() {
    var w = document.getElementById('sk-wave');
    if (w) { w.classList.remove('on'); w.querySelectorAll('.sk-wbar').forEach(function (b) { b.classList.remove('on'); }); }
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function addMsg(text, who) {
    var box = document.getElementById('sk-msgs');
    if (!box) return;
    var isAr = detectLang(text) === 'ar';
    var row = document.createElement('div');
    row.className = 'sk-row ' + (who === 'sakura' ? 'sk-row-ai' : 'sk-row-user');

    if (who === 'sakura') {
      row.innerHTML =
        '<div class="sk-av-ai">🌸</div>' +
        '<div class="sk-bubble sk-bubble-ai" dir="' + (isAr ? 'rtl' : 'ltr') + '">' + formatText(text) + '</div>';
    } else {
      row.innerHTML =
        '<div class="sk-bubble sk-bubble-user" dir="' + (isAr ? 'rtl' : 'ltr') + '">' + formatText(text) + '</div>' +
        '<div class="sk-av-user">👤</div>';
    }

    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    requestAnimationFrame(function () { row.classList.add('vis'); });
  }

  function addTyping() {
    var box = document.getElementById('sk-msgs');
    if (!box) return;
    var row = document.createElement('div');
    row.className = 'sk-typing-row'; row.id = 'sk-typing';
    row.innerHTML = '<div class="sk-av-ai">🌸</div><div class="sk-typing-dots"><span class="sk-td"></span><span class="sk-td"></span><span class="sk-td"></span></div>';
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  function removeTyping() { var el = document.getElementById('sk-typing'); if (el) el.remove(); }

  async function handleMsg(text) {
    if (!text.trim()) return;
    var inp = document.getElementById('sk-inp');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
    addMsg(text, 'user');
    addTyping();
    var resp = await getReply(text);
    removeTyping();
    addMsg(resp, 'sakura');
    speak(resp, detectLang(resp));
  }

  /* ── Toggle Panel ── */
  function openPanel() {
    panelOpen = true;
    var panel = document.getElementById('sk-panel');
    var overlay = document.getElementById('sk-overlay');
    var fab = document.getElementById('sk-fab');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (fab) fab.style.opacity = '0'; if (fab) fab.style.pointerEvents = 'none';

    if (!greeted) {
      greeted = true;
      var ctx = GREET[PAGE] || GREET['default'];
      var lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
      var msg = ctx[lang] || ctx['en'];
      setTimeout(function () { addMsg(msg, 'sakura'); }, 350);
    }
  }

  function closePanel() {
    panelOpen = false;
    var panel = document.getElementById('sk-panel');
    var overlay = document.getElementById('sk-overlay');
    var fab = document.getElementById('sk-fab');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    // Show FAB again after close
    if (fab) { fab.style.opacity = '1'; fab.style.pointerEvents = 'auto'; }
    stopSpeak();
  }

  /* ── Build UI ── */
  function build() {
    /* Load CSS */
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (location.pathname.includes('/') ? location.pathname.replace(/\/[^/]*$/, '/') : '') + 'sakura-assistant.css';
    // Simpler: always relative
    link.href = 'sakura-assistant.css';
    document.head.appendChild(link);

    /* Overlay */
    var overlay = document.createElement('div');
    overlay.id = 'sk-overlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);

    /* Panel */
    var panel = document.createElement('div');
    panel.id = 'sk-panel';

    /* Header */
    var head = document.createElement('div');
    head.id = 'sk-head';
    head.innerHTML =
      '<div id="sk-head-av">🌸</div>' +
      '<div id="sk-head-info">' +
        '<h3>ساكورا · Sakura</h3>' +
        '<p><span class="sk-dot-online"></span> Online · مساعدتك الذكية</p>' +
      '</div>' +
      '<div id="sk-wave"><div class="sk-wbar"></div><div class="sk-wbar"></div><div class="sk-wbar"></div><div class="sk-wbar"></div><div class="sk-wbar"></div></div>' +
      '<button id="sk-close" title="Close">✕</button>';
    panel.appendChild(head);

    /* Messages */
    var msgs = document.createElement('div');
    msgs.id = 'sk-msgs';
    panel.appendChild(msgs);

    /* Input Area */
    var inputArea = document.createElement('div');
    inputArea.id = 'sk-input-area';

    var wrap = document.createElement('div');
    wrap.id = 'sk-input-wrap';

    /* Mic button INSIDE input */
    var mic = document.createElement('button');
    mic.id = 'sk-mic';
    mic.title = 'Voice input';
    mic.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
    mic.addEventListener('click', toggleMic);

    /* Text input */
    var inp = document.createElement('textarea');
    inp.id = 'sk-inp';
    inp.rows = 1;
    inp.placeholder = 'اكتب رسالتك... / Type a message...';
    inp.autocomplete = 'off';
    inp.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMsg(inp.value); }
    });

    /* Send button INSIDE input */
    var send = document.createElement('button');
    send.id = 'sk-send';
    send.title = 'Send';
    send.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>';
    send.addEventListener('click', function () { handleMsg(inp.value); });

    wrap.appendChild(mic);
    wrap.appendChild(inp);
    wrap.appendChild(send);
    inputArea.appendChild(wrap);
    panel.appendChild(inputArea);

    document.body.appendChild(panel);

    /* Close button event */
    head.querySelector('#sk-close').addEventListener('click', closePanel);

    /* FAB Button — hidden initially, appears after 1.5s delay */
    var fab = document.createElement('button');
    fab.id = 'sk-fab';
    fab.title = 'Sakura AI Assistant';
    fab.style.opacity = '0';
    fab.style.transform = 'scale(0.5)';
    fab.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    fab.addEventListener('click', openPanel);
    document.body.appendChild(fab);

    /* Show FAB after 1.5s — not immediately visible */
    setTimeout(function () {
      fab.style.opacity = '1';
      fab.style.transform = 'scale(1)';
    }, 1500);
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
