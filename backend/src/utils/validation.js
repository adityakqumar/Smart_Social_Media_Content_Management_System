const URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmpty(value, max = 5000) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function validatePostBody(body, { partial = false } = {}) {
  const errors = {};
  const { title, content, image_url } = body;

  if (!partial || title !== undefined) {
    if (!isNonEmpty(title, 140)) errors.title = 'Title is required (max 140 characters).';
  }
  if (!partial || content !== undefined) {
    if (!isNonEmpty(content, 2200)) errors.content = 'Caption is required (max 2200 characters).';
  }
  if (image_url !== undefined && image_url !== '' && image_url !== null) {
    if (!URL_RE.test(image_url)) errors.image_url = 'Image must be a valid http(s) URL.';
  }

  return errors;
}

function validateEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  isNonEmpty,
  validatePostBody,
  validateEmail,
  parseDateTime,
  toSqlDateTime,
  URL_RE,
};
