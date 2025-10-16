const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ====== SIGNUP ======
exports.signup = async (req, res, next) => {
  try {
    const { name, email, phoneNumber, password, role } = req.body;

    // Basic validation
    if (!email || !password || !role)
      return res.status(400).json({ message: 'Email, password and role required' });

    // Optional phone number format validation (E.164)
    if (phoneNumber) {
        const phoneRegex = /^\+[1-9]\d{1,3}\d{6,12}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
            message: 'Invalid phone number format. Must start with country code (+) and have 8–15 digits total.'
            });
        }
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail)
      return res.status(400).json({ message: 'User with this email already exists' });

    // Check if phone number already exists (if provided)
    if (phoneNumber) {
      const existingPhone = await prisma.user.findUnique({ where: { phoneNumber } });
      if (existingPhone)
        return res.status(400).json({ message: 'Phone number already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: { name, email, phoneNumber, passwordHash, role },
    });

    res.status(201).json({
      token: genToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ====== LOGIN ======
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email & password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      token: genToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ====== GET USER PROFILE ======
exports.getProfile = async (req, res, next) => {
  try {
    // req.user is set by the `protect` middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        // Exclude passwordHash for security
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// ====== LOGOUT ======
exports.logout = (req, res) => {
  // In a JWT-only system, we can't invalidate the token server-side.
  // So we just tell the client to delete it.
  res.status(200).json({ message: 'Logged out successfully' });
};

