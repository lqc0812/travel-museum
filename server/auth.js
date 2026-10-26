const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// 用 SHA-256 比较密码，避免明文比较，并使用 timingSafeEqual 防止时序攻击
function sha256(str) {
  return crypto.createHash('sha256').update(str || '', 'utf8').digest('hex');
}

function verifyPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(sha256(input));
  const b = Buffer.from(sha256(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken() {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign({ role: 'admin' }, secret, { expiresIn: '7d' });
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  try {
    const decoded = jwt.verify(token, secret);
    return decoded && decoded.role === 'admin';
  } catch {
    return false;
  }
}

module.exports = { verifyPassword, signToken, verifyToken };
