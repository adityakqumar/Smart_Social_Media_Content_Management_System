const HOOKS = {
  witty: ['Plot twist:', 'Unpopular opinion:', 'Quick reminder:', 'Tell us we’re wrong:'],
  warm: ['A little note from the studio:', 'Saving this for later:', 'Made with extra care:', 'If you needed a nudge:'],
  bold: ['Stop scrolling.', 'This is your sign.', 'We went all in.', 'No half measures.'],
  calm: ['Soft drop:', 'Quiet flex:', 'In case you missed it:', 'A slower take:'],
};

const ENDINGS = [
  'Save this for later.',
  'Drop a comment if this hits.',
  'Tag someone who needs this.',
  'Which version would you ship?',
  'We are listening — tell us your take.',
];

function generateCaption({ topic, platform, tone }) {
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
    tone: style,
  };
}

module.exports = { generateCaption };
