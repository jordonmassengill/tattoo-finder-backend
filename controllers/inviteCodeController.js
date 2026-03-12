const crypto = require('crypto');
const InviteCode = require('../models/InviteCode');

// Admin middleware check (used inline in routes)
const checkAdminSecret = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// POST /api/invite-codes  — generate a new invite code (admin only)
exports.generateCode = [
  checkAdminSecret,
  async (req, res) => {
    try {
      const { userType, note, expiresInDays } = req.body;

      if (!userType || !['artist', 'shop'].includes(userType)) {
        return res.status(400).json({ message: 'userType must be "artist" or "shop"' });
      }

      const code = crypto.randomBytes(16).toString('hex');

      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
        : null;

      const invite = new InviteCode({ code, userType, note: note || '', expiresAt });
      await invite.save();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const signupLink = `${frontendUrl}/signup?code=${code}`;

      res.status(201).json({
        code,
        userType,
        signupLink,
        expiresAt,
        note: invite.note,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },
];

// GET /api/invite-codes  — list all codes (admin only)
exports.listCodes = [
  checkAdminSecret,
  async (req, res) => {
    try {
      const codes = await InviteCode.find()
        .populate('usedBy', 'username email userType')
        .sort({ createdAt: -1 });
      res.json(codes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },
];

// GET /api/invite-codes/validate/:code  — check if a code is valid (public, used by frontend)
exports.validateCode = async (req, res) => {
  try {
    const invite = await InviteCode.findOne({ code: req.params.code });

    if (!invite) {
      return res.status(404).json({ valid: false, message: 'Invalid invite code' });
    }

    if (invite.used) {
      return res.status(400).json({ valid: false, message: 'This invite code has already been used' });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, message: 'This invite code has expired' });
    }

    res.json({ valid: true, userType: invite.userType });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/invite-codes/:code  — delete / revoke a code (admin only)
exports.deleteCode = [
  checkAdminSecret,
  async (req, res) => {
    try {
      const deleted = await InviteCode.findOneAndDelete({ code: req.params.code });
      if (!deleted) {
        return res.status(404).json({ message: 'Code not found' });
      }
      res.json({ message: 'Code deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },
];
