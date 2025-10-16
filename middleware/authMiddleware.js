const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const protect = async (req, res, next) => {
  let token;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id }});
      if (!user) return res.status(401).json({ message: 'Not authorized' });
      req.user = { id: user.id, role: user.role };
      return next();
    }
    return res.status(401).json({ message: 'Not authorized, no token' });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden: insufficient role' });
    next();
  };
};

module.exports = { protect, requireRole };
