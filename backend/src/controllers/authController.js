const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

const prisma = new PrismaClient();

const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: passwordHash }
    });

    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, email: user.email, balance: user.balance } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.twoFactorEnabled) {
      return res.json({ twoFactorRequired: true, userId: user.id });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, balance: user.balance } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verify2FA = async (req, res) => {
  const { userId, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) return res.status(401).json({ message: 'Invalid 2FA code' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, balance: user.balance } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generate2FA = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'ApexTrading', secret);
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret }
    });

    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    res.json({ qrCodeUrl, secret });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const enable2FA = async (req, res) => {
  const { code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isValid = authenticator.check(code, user.twoFactorSecret);
    
    if (!isValid) return res.status(400).json({ message: 'Invalid verification code' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true }
    });

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const googleCallback = async (req, res) => {
  // Passport handles the strategy, we just need to redirect with token
  const user = req.user;
  const token = generateToken(user);
  
  // In production, use a more secure way to pass the token to frontend
  // Redirect to frontend with token in query param
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/success?token=${token}&email=${user.email}&id=${user.id}`);
};

module.exports = { register, login, verify2FA, generate2FA, enable2FA, googleCallback };
