// routes/apiCatalog.js
const express     = require('express');
const router      = express.Router();
const CatalogItem = require('../models/CatalogItem');

// GET /api/catalog/search?q=shingle
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const items = await CatalogItem.find({
    name: { $regex: q, $options: 'i' }
  })
    .select('name description retailCost builderCost color')   // extra fields
    .limit(10)
    .lean();
  res.json(items);
});

module.exports = router;
