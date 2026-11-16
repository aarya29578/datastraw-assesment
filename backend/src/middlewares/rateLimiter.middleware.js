/**
 * In-memory Sliding Window Rate Limiter Middleware
 * Protects endpoints from denial-of-service and brute-force spamming.
 */

const ipRequestMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 250; // 250 requests per minute per IP

export const rateLimiterMiddleware = (req, res, next) => {
  // Allow health checks without rate limiting
  if (req.path === '/api/health' || req.path === '/') {
    return next();
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const record = ipRequestMap.get(ip) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + WINDOW_MS;
  } else {
    record.count++;
  }

  ipRequestMap.set(ip, record);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      code: 'TOO_MANY_REQUESTS',
      suggestion: 'Please wait a few seconds before submitting more requests.',
    });
  }

  next();
};

// Periodic garbage collection for expired IP entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestMap.entries()) {
    if (now > record.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
