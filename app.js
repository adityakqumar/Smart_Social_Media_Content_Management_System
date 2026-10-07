// Pulse Studio Application Script with Dual Mode (API + Standalone Static / GitHub Pages)
const DEFAULT_PLATFORMS = [
  { id: 1, name: 'Instagram', slug: 'instagram', accent: '#f05f87', icon: 'ig', is_active: 1 },
  { id: 2, name: 'LinkedIn', slug: 'linkedin', accent: '#2367d1', icon: 'in', is_active: 1 },
  { id: 3, name: 'X', slug: 'x', accent: '#1c2630', icon: 'x', is_active: 1 },
  { id: 4, name: 'TikTok', slug: 'tiktok', accent: '#2acfc2', icon: 'tt', is_active: 1 }
];

const DEFAULT_POSTS = [
  {
    id: 1,
    title: 'Lumen: a brighter morning ritual',
    content: 'A little color therapy for the top of your feed. Meet Lumen, the everyday ritual made for slow mornings and bright ideas. Save this for your next reset. #Lumen #SkincareRoutine #StudioNotes',
    image_url: './assets/lumen-campaign.png',
    status: 'scheduled',
    schedule: [{
      platform_id: 1,
      platform_name: 'Instagram',
      platform_slug: 'instagram',
      scheduled_at: new Date(Date.now() + 21 * 3600 * 1000).toISOString(),
      status: 'scheduled'
    }],
    engagement: { likes: 0, comments: 0, shares: 0 }
  },
  {
    id: 2,
    title: 'Behind the scenes: packaging that keeps up',
    content: 'The smallest details can make the biggest difference. Here is how we chose packaging that looks sharp and works harder.',
    image_url: './assets/lumen-campaign.png',
    status: 'scheduled',
    schedule: [{
      platform_id: 2,
      platform_name: 'LinkedIn',
      platform_slug: 'linkedin',
      scheduled_at: new Date(Date.now() + 45 * 3600 * 1000).toISOString(),
      status: 'scheduled'
    }],
    engagement: { likes: 0, comments: 0, shares: 0 }
  },
  {
    id: 3,
    title: 'Three ways to make a product launch feel human',
    content: 'The best launch content starts with a point of view, not a template. Here are three small moves that made ours feel more like us.',
    image_url: './assets/lumen-campaign.png',
    status: 'published',
    schedule: [{
      platform_id: 2,
      platform_name: 'LinkedIn',
      platform_slug: 'linkedin',
      scheduled_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
      status: 'published'
    }],
    engagement: { likes: 842, comments: 68, shares: 91 }
  },
  {
    id: 4,
    title: 'Fall palette reveal: unboxing the new shades',
    content: 'Muted earth tones, bold accents. Taking a peek at the new collection before it goes live this Friday.',
    image_url: './assets/lumen-campaign.png',
    status: 'draft',
    schedule: [],
    engagement: { likes: 0, comments: 0, shares: 0 }
  }
];

const HOOKS = {
  witty: ['Plot twist:', 'Unpopular opinion:', 'Quick reminder:', 'Tell us we’re wrong:'],
  warm: ['A little note from the studio:', 'Saving this for later:', 'Made with extra care:', 'If you needed a nudge:'],
  bold: ['Stop scrolling.', 'This is your sign.', 'We went all in.', 'No half measures.'],
  calm: ['Soft drop:', 'Quiet flex:', 'In case you missed it:', 'A slower take:']
};

const ENDINGS = [
  'Save this for later.',
  'Drop a comment if this hits.',
  'Tag someone who needs this.',
  'Which version would you ship?',
  'We are listening — tell us your take.'
];

const state = {
  token: '',
  posts: [],
  platforms: [],
  view: 'overview',
  composeMode: 'schedule',
  isStandalone: false
};

// Storage helper for standalone demo mode
const storage = {
  getPosts: () => {
    try {
      const data = localStorage.getItem('pulse_posts');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setPosts: (posts) => {
    try {
      localStorage.setItem('pulse_posts', JSON.stringify(posts));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }
};

const escapeHtml = (value) =>
  String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

const formatDate = (value) => {
  if (!value) return '';
  const dateObj = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return isNaN(dateObj.getTime())
    ? String(value)
    : dateObj.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const scheduled = () => state.posts.filter((post) => post.status === 'scheduled');
const published = () => state.posts.filter((post) => post.status === 'published');
const totalEngagement = () =>
  published().reduce((total, post) => total + (post.engagement?.likes || 0) + (post.engagement?.comments || 0) + (post.engagement?.shares || 0), 0);

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

function postPlatform(post) {
  return post.schedule?.[0]?.platform_name || 'Draft';
}

function platformClass(post) {
  return post.schedule?.[0]?.platform_slug || 'draft';
}

function postCard(post, compact = false) {
  const slot = post.schedule?.[0];
  const imgPath = post.image_url || './assets/lumen-campaign.png';
  return `<article class="post-row ${compact ? 'compact' : ''}">
    <div class="post-thumb">
      ${post.image_url ? `<img src="${imgPath}" alt="" />` : '<span>PS</span>'}
    </div>
    <div class="post-copy">
      <div class="post-meta">
        <span class="platform ${platformClass(post)}">${escapeHtml(postPlatform(post))}</span>
        <span>${post.status}</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.content)}</p>
    </div>
    <div class="post-time">
      ${slot ? `<strong>${formatDate(slot.scheduled_at)}</strong><small>${slot.status === 'published' ? 'Published' : 'Scheduled'}</small>` : '<strong>Not scheduled</strong><small>Draft</small>'}
    </div>
  </article>`;
}

function renderOverview() {
  const root = document.querySelector('#view-root');
  const next = scheduled()[0];
  const channelsCount = state.platforms.filter((item) => item.is_active).length || 4;

  root.innerHTML = `
    <section class="page-intro">
      <div>
        <p class="eyebrow">Workspace overview</p>
        <h1>Make the feed feel <em>alive.</em></h1>
        <p class="intro-copy">One calm place to shape the story, schedule the work, and see what lands.</p>
      </div>
      <div class="date-switcher">
        <button aria-label="Previous week">&larr;</button>
        <span>01 - 07 October</span>
        <button aria-label="Next week">&rarr;</button>
      </div>
    </section>

    <section class="metrics">
      <article>
        <span>Scheduled</span>
        <strong>${scheduled().length}</strong>
        <small>posts in the queue</small>
        <i class="blue-bar"></i>
      </article>
      <article>
        <span>Published</span>
        <strong>${published().length}</strong>
        <small>this month</small>
        <i class="lime-bar"></i>
      </article>
      <article>
        <span>Engagement</span>
        <strong>${totalEngagement().toLocaleString()}</strong>
        <small>actions tracked</small>
        <i class="coral-bar"></i>
      </article>
      <article>
        <span>Channels</span>
        <strong>${channelsCount}</strong>
        <small>connected profiles</small>
        <i class="ink-bar"></i>
      </article>
    </section>

    <section class="dashboard-grid">
      <div class="panel schedule-panel">
        <div class="panel-title">
          <div>
            <p class="eyebrow">Your timeline</p>
            <h2>Coming up next</h2>
          </div>
          <button class="text-button" data-view-target="calendar">Open calendar &rarr;</button>
        </div>
        ${next ? `
          <div class="feature-post">
            <img src="${next.image_url || './assets/lumen-campaign.png'}" alt="" />
            <div>
              <span class="platform ${platformClass(next)}">${postPlatform(next)}</span>
              <h3>${escapeHtml(next.title)}</h3>
              <p>${escapeHtml(next.content)}</p>
              <strong>${formatDate(next.schedule?.[0]?.scheduled_at)}</strong>
            </div>
          </div>
        ` : '<div class="empty-state">Your schedule is clear. Make something worth seeing.</div>'}
        <div class="week-strip">
          <span>Mon<small>30</small></span>
          <span class="today">Tue<small>01</small></span>
          <span>Wed<small>02</small></span>
          <span>Thu<small>03</small></span>
          <span>Fri<small>04</small></span>
          <span>Sat<small>05</small></span>
          <span>Sun<small>06</small></span>
        </div>
      </div>

      <aside class="panel ai-panel">
        <div class="ai-orb">AI</div>
        <p class="eyebrow">Pulse Assist</p>
        <h2>A little spark for your next caption.</h2>
        <p>Give the generator a topic, choose a tone, and keep the parts that sound like you.</p>
        <button class="dark-button" id="open-ai">Start with AI <span>&rarr;</span></button>
        <div class="recommendation">
          <span>Best window</span>
          <strong>Wed, 9:40 AM</strong>
          <small>Instagram is most active then</small>
        </div>
      </aside>
    </section>

    <section class="panel performance-panel">
      <div class="panel-title">
        <div>
          <p class="eyebrow">Performance pulse</p>
          <h2>What your audience is leaning into</h2>
        </div>
        <button class="text-button" data-view-target="analytics">View analytics &rarr;</button>
      </div>
      <div class="performance-layout">
        <div class="chart">
          <div class="chart-label">
            <strong>1,482</strong>
            <span>Engagements in the last 30 days <b>+18.4%</b></span>
          </div>
          <div class="bars">
            <i style="height:31%"></i>
            <i style="height:47%"></i>
            <i style="height:42%"></i>
            <i style="height:65%"></i>
            <i style="height:54%"></i>
            <i style="height:82%"></i>
            <i style="height:72%"></i>
            <i style="height:94%"></i>
            <i style="height:76%"></i>
            <i style="height:88%"></i>
          </div>
          <div class="chart-days">
            <span>Sep 01</span>
            <span>Sep 10</span>
            <span>Sep 20</span>
            <span>Today</span>
          </div>
        </div>
        <div class="signal-list">
          <div>
            <span class="signal-number">01</span>
            <p><strong>Carousels are carrying.</strong> Educational posts saved 2.4x more than single images.</p>
          </div>
          <div>
            <span class="signal-number">02</span>
            <p><strong>Your most active pocket is early.</strong> Followers are responding before the workday starts.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCalendar() {
  const posts = scheduled();
  const root = document.querySelector('#view-root');
  root.innerHTML = `
    <section class="page-intro compact-title">
      <div>
        <p class="eyebrow">Planning view</p>
        <h1>Your October <em>calendar.</em></h1>
      </div>
      <button class="primary-button" id="calendar-new">New post <span>+</span></button>
    </section>
    <section class="calendar-layout">
      <div class="panel calendar-grid">
        <div class="calendar-head">
          <h2>October 2026</h2>
          <span>Week 40</span>
        </div>
        <div class="calendar-days">
          ${['Mon 29','Tue 30','Wed 01','Thu 02','Fri 03','Sat 04','Sun 05'].map((day, index) => `
            <div class="calendar-day ${index === 2 ? 'current-day' : ''}">
              <span>${day}</span>
              ${posts.filter((post) => index === 2 || (index === 4 && post === posts[1])).slice(0, 1).map((post) => `
                <button class="calendar-post ${platformClass(post)}" title="${escapeHtml(post.title)}">
                  ${escapeHtml(post.title)}
                </button>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
      <aside class="panel agenda">
        <p class="eyebrow">Tuesday, 01 October</p>
        <h2>Today's pulse</h2>
        ${posts.length ? posts.slice(0, 3).map((post) => postCard(post, true)).join('') : '<div class="empty-state">Nothing scheduled today.</div>'}
      </aside>
    </section>
  `;
}

function renderContent() {
  const drafts = state.posts.filter((post) => post.status === 'draft');
  const queue = scheduled();
  const live = published();

  const column = (title, items, label) => `
    <section class="content-column">
      <div class="column-head">
        <span>${label}</span>
        <h2>${title}</h2>
        <b>${items.length}</b>
      </div>
      ${items.length ? items.map((post) => `
        <article class="content-item">
          <div class="post-thumb">
            ${post.image_url ? `<img src="${post.image_url}" alt="" />` : 'PS'}
          </div>
          <div>
            <span class="platform ${platformClass(post)}">${postPlatform(post)}</span>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${post.status === 'draft' ? 'Ready for your next move' : formatDate(post.schedule?.[0]?.scheduled_at)}</p>
          </div>
        </article>
      `).join('') : '<div class="empty-state">Nothing here just yet.</div>'}
    </section>
  `;

  document.querySelector('#view-root').innerHTML = `
    <section class="page-intro compact-title">
      <div>
        <p class="eyebrow">Content library</p>
        <h1>From rough thought to <em>real reach.</em></h1>
      </div>
      <button class="primary-button" id="content-new">New post <span>+</span></button>
    </section>
    <section class="content-board">
      ${column('In the studio', drafts, 'Drafts')}
      ${column('Ready to go', queue, 'Scheduled')}
      ${column('Out in the world', live, 'Published')}
    </section>
  `;
}

function renderAnalytics() {
  document.querySelector('#view-root').innerHTML = `
    <section class="page-intro compact-title">
      <div>
        <p class="eyebrow">Analytics</p>
        <h1>Find the pattern. <em>Follow it.</em></h1>
      </div>
      <div class="period-picker">
        <button class="active">30 days</button>
        <button>90 days</button>
        <button>Year</button>
      </div>
    </section>
    <section class="analytics-grid">
      <section class="panel reach-panel">
        <div class="panel-title">
          <div>
            <p class="eyebrow">Audience reach</p>
            <h2>31.8K impressions</h2>
          </div>
          <span class="trend">+12.8%</span>
        </div>
        <div class="line-area">
          <svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Impressions trend">
            <path d="M0,183 C45,175 60,143 104,158 S170,119 205,133 S270,95 303,111 S350,75 390,93 S445,122 480,75 S535,47 565,66 S630,30 700,39 L700,220 L0,220 Z" fill="#d7f448"></path>
            <path d="M0,183 C45,175 60,143 104,158 S170,119 205,133 S270,95 303,111 S350,75 390,93 S445,122 480,75 S535,47 565,66 S630,30 700,39" fill="none" stroke="#172324" stroke-width="4"></path>
          </svg>
        </div>
        <div class="chart-days">
          <span>Sep 01</span>
          <span>Sep 10</span>
          <span>Sep 20</span>
          <span>Today</span>
        </div>
      </section>
      <section class="panel channel-panel">
        <p class="eyebrow">Channel balance</p>
        <h2>Where the attention is</h2>
        <div class="channel-row"><span>Instagram</span><i><b style="width:82%"></b></i><strong>52%</strong></div>
        <div class="channel-row"><span>LinkedIn</span><i><b style="width:58%"></b></i><strong>31%</strong></div>
        <div class="channel-row"><span>TikTok</span><i><b style="width:29%"></b></i><strong>17%</strong></div>
      </section>
      <section class="panel best-post">
        <p class="eyebrow">Top performer</p>
        <img src="./assets/lumen-campaign.png" alt="Lumen campaign" />
        <div>
          <span class="platform linkedin">LinkedIn</span>
          <h2>Three ways to make a product launch feel human</h2>
          <strong>1,001 actions</strong>
        </div>
      </section>
    </section>
  `;
}

function renderTeam() {
  document.querySelector('#view-root').innerHTML = `
    <section class="page-intro compact-title">
      <div>
        <p class="eyebrow">Your people</p>
        <h1>A small team with <em>big taste.</em></h1>
      </div>
      <button class="outline-button" id="team-invite">Invite teammate</button>
    </section>
    <section class="team-list panel">
      <div class="team-row header">
        <span>Member</span>
        <span>Role</span>
        <span>Focus</span>
        <span>Status</span>
      </div>
      <div class="team-row">
        <div class="member">
          <span class="avatar">MC</span>
          <div><strong>Maya Chen</strong><small>maya@pulse.studio</small></div>
        </div>
        <span>Administrator</span>
        <span>Strategy and approvals</span>
        <span class="online">Online</span>
      </div>
      <div class="team-row">
        <div class="member">
          <span class="avatar coral">TB</span>
          <div><strong>Theo Brooks</strong><small>theo@pulse.studio</small></div>
        </div>
        <span>Creator</span>
        <span>Concepts and copy</span>
        <span class="online">Online</span>
      </div>
      <div class="team-row">
        <div class="member">
          <span class="avatar lime">NP</span>
          <div><strong>Nia Patel</strong><small>nia@pulse.studio</small></div>
        </div>
        <span>Manager</span>
        <span>Calendar and reporting</span>
        <span class="away">Away</span>
      </div>
    </section>
    <section class="approval-banner">
      <div>
        <span class="eyebrow">Approval queue</span>
        <h2>Two posts are waiting for a final look.</h2>
      </div>
      <button class="dark-button" id="open-approval">Review posts &rarr;</button>
    </section>
  `;
}

function render() {
  const views = {
    overview: renderOverview,
    calendar: renderCalendar,
    content: renderContent,
    analytics: renderAnalytics,
    team: renderTeam
  };
  (views[state.view] || renderOverview)();
  bindViewActions();
}

function bindViewActions() {
  document.querySelectorAll('[data-view-target]').forEach((button) =>
    button.addEventListener('click', () => setView(button.dataset.viewTarget))
  );
  document.querySelectorAll('#calendar-new, #content-new').forEach((button) =>
    button?.addEventListener('click', openComposer)
  );
  document.querySelector('#open-ai')?.addEventListener('click', () => {
    openComposer();
    const topic = document.querySelector('#ai-topic');
    if (topic) topic.focus();
  });
  document.querySelectorAll('#team-invite, #invite').forEach((button) =>
    button?.addEventListener('click', () => showToast('Invite link copied to your clipboard.'))
  );
  document.querySelector('#open-approval')?.addEventListener('click', () => {
    setView('content');
    showToast('Your approval queue is ready.');
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-link').forEach((item) =>
    item.classList.toggle('active', item.dataset.view === view)
  );
  render();
}

function openComposer() {
  document.querySelector('#composer-modal').classList.remove('hidden');
}

function closeComposer() {
  document.querySelector('#composer-modal').classList.add('hidden');
}

// Client-side AI caption generator for standalone mode
function generateLocalCaption({ topic, platform, tone }) {
  const t = String(topic || '').trim();
  if (!t) return { error: 'Add a topic or product name to generate a caption.' };

  const style = HOOKS[tone] ? tone : 'warm';
  const hook = HOOKS[style][Math.floor(Math.random() * HOOKS[style].length)];
  const ending = ENDINGS[Math.floor(Math.random() * ENDINGS.length)];
  const slug = t.replace(/\s+/g, '');
  const handle = platform ? `#${String(platform).replace(/\s+/g, '')}` : '#PulseStudio';

  const body = `${hook} ${t} is having a moment — and the feed is about to notice. We kept the craft tight, the story human, and the call-to-action honest.`;
  const hashtags = [`#${slug.slice(0, 24)}`, handle, '#ContentStudio', '#CreatorLife'].join(' ');

  return {
    caption: `${body}\n\n${ending}\n\n${hashtags}`,
    tone: style
  };
}

// Unified API caller with automatic fallback to standalone demo mode
const api = async (path, options = {}) => {
  if (state.isStandalone) {
    throw new Error('Standalone mode');
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

function setupPlatformSelect() {
  const select = document.querySelector('#post-platform');
  if (!select) return;
  select.innerHTML = state.platforms
    .filter((platform) => platform.is_active)
    .map((platform) => `<option value="${platform.id}">${platform.name}</option>`)
    .join('');
}

async function refreshData() {
  if (!state.isStandalone) {
    try {
      const [posts, platforms] = await Promise.all([api('/posts'), api('/platforms')]);
      state.posts = posts.posts;
      state.platforms = platforms.platforms;
    } catch {
      activateStandaloneMode();
    }
  }
  setupPlatformSelect();
  render();
}

function activateStandaloneMode() {
  state.isStandalone = true;
  const statusText = document.querySelector('#engine-status-text');
  if (statusText) statusText.textContent = 'Workspace online (Demo)';

  const savedPosts = storage.getPosts();
  state.posts = savedPosts && savedPosts.length ? savedPosts : DEFAULT_POSTS;
  state.platforms = DEFAULT_PLATFORMS;
  setupPlatformSelect();
  render();
}

async function init() {
  // If we are hosted on github.io or static file, activate standalone mode directly
  const isGitHubPages = location.hostname.includes('github.io') || location.protocol === 'file:';

  if (isGitHubPages) {
    activateStandaloneMode();
    return;
  }

  try {
    const auth = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maya@pulse.studio', password: 'demo1234' })
    });
    state.token = auth.token;
    await refreshData();
  } catch (error) {
    // Graceful fallback to standalone demo mode if backend is not running
    console.info('Backend unavailable, using standalone interactive demo mode.');
    activateStandaloneMode();
  }
}

// Navigation and Modal handlers
document.querySelectorAll('.nav-link').forEach((button) =>
  button.addEventListener('click', () => setView(button.dataset.view))
);
document.querySelector('#open-composer').addEventListener('click', openComposer);
document.querySelector('#close-composer').addEventListener('click', closeComposer);
document.querySelector('#notifications').addEventListener('click', () =>
  showToast('3 updates: one post is ready for review, two posts publish this week.')
);

// AI Caption Generation
document.querySelector('#generate-caption').addEventListener('click', async () => {
  const topic = document.querySelector('#ai-topic').value.trim();
  const message = document.querySelector('#composer-message');
  if (!topic) {
    message.textContent = 'Add a topic first, then I can make a caption.';
    return;
  }

  const tone = document.querySelector('#ai-tone').value;
  const platform = document.querySelector('#post-platform option:checked')?.textContent;

  try {
    message.textContent = 'Making a fresh angle...';
    let result;
    if (state.isStandalone) {
      result = generateLocalCaption({ topic, platform, tone });
    } else {
      try {
        result = await api('/posts/captions/generate', {
          method: 'POST',
          body: JSON.stringify({ topic, tone, platform })
        });
      } catch {
        result = generateLocalCaption({ topic, platform, tone });
      }
    }
    document.querySelector('#post-content').value = result.caption;
    if (!document.querySelector('#post-title').value) {
      document.querySelector('#post-title').value = topic;
    }
    message.textContent = 'Caption ready. Make it yours.';
  } catch (error) {
    message.textContent = error.message;
  }
});

// Composer form submit
document.querySelector('#save-draft').addEventListener('click', () => {
  state.composeMode = 'draft';
  document.querySelector('#composer-form').requestSubmit();
});

document.querySelector('#composer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#composer-message');
  const title = document.querySelector('#post-title').value.trim();
  const content = document.querySelector('#post-content').value.trim();
  const savingDraft = state.composeMode === 'draft';
  const platformId = Number(document.querySelector('#post-platform').value);
  const platformObj = state.platforms.find((p) => p.id === platformId) || state.platforms[0];
  const scheduledAt = document.querySelector('#post-date').value;

  try {
    message.textContent = 'Saving your post...';
    if (state.isStandalone) {
      const newPost = {
        id: Date.now(),
        title,
        content,
        image_url: './assets/lumen-campaign.png',
        status: savingDraft ? 'draft' : 'scheduled',
        schedule: savingDraft ? [] : [{
          platform_id: platformId,
          platform_name: platformObj.name,
          platform_slug: platformObj.slug,
          scheduled_at: scheduledAt,
          status: 'scheduled'
        }],
        engagement: { likes: 0, comments: 0, shares: 0 }
      };
      state.posts = [newPost, ...state.posts];
      storage.setPosts(state.posts);
    } else {
      const result = await api('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, content, image_url: './assets/lumen-campaign.png' })
      });
      if (!savingDraft) {
        await api(`/posts/${result.post.id}/schedule`, {
          method: 'POST',
          body: JSON.stringify({ platform_id: platformId, scheduled_at: scheduledAt })
        });
      }
    }

    state.composeMode = 'schedule';
    event.target.reset();
    closeComposer();
    if (state.isStandalone) {
      render();
    } else {
      await refreshData();
    }
    showToast(savingDraft ? 'Draft saved.' : 'Post added to your calendar.');
  } catch (error) {
    state.composeMode = 'schedule';
    message.textContent = error.message;
  }
});

// Default datetime initialization
const defaultDate = new Date(Date.now() + 86400000);
defaultDate.setMinutes(0, 0, 0);
const dateInput = document.querySelector('#post-date');
if (dateInput) {
  dateInput.value = defaultDate.toISOString().slice(0, 16);
}

// Update topbar date to today
const dateElem = document.querySelector('#topbar-date');
if (dateElem) {
  dateElem.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

// Boot application
init();
