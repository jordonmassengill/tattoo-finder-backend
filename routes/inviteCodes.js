const express = require('express');
const router = express.Router();
const {
  generateCode,
  listCodes,
  validateCode,
  deleteCode,
} = require('../controllers/inviteCodeController');

// Public: validate a code before signup
router.get('/validate/:code', validateCode);

// Admin: generate, list, delete codes
router.post('/', generateCode);
router.get('/', listCodes);
router.delete('/:code', deleteCode);

module.exports = router;
