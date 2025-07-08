// routes/adminCatalog.js
const express     = require('express');
const router      = express.Router();
const CatalogItem = require('../models/CatalogItem');
const checkAuth   = require('../middleware/checkAuth');

/* ───────────── List ───────────── */
router.get('/', checkAuth, async (req, res) => {
  const items = await CatalogItem.find().sort({ updatedAt: -1 }).lean();
  res.render('admin/catalogList', {
    pageTitle: 'Catalog • Admin',
    activeTab: 'catalog',
    items
  });
});

/* ───────────── New Form ───────────── */
router.get('/new', checkAuth, (req, res) => {
  res.render('admin/catalogForm', {
    pageTitle: 'Add Catalog Item',
    activeTab: 'catalog',
    item: {},       // empty object for defaults
    isEdit: false
  });
});

/* ───────────── Edit Form ───────────── */
router.get('/:id/edit', checkAuth, async (req, res) => {
  const item = await CatalogItem.findById(req.params.id).lean();
  if (!item) return res.status(404).render('admin/notFound');
  res.render('admin/catalogForm', {
    pageTitle: `Edit • ${item.name}`,
    activeTab: 'catalog',
    item,
    isEdit: true
  });
});

/* ───────────── Create/Update ───────────── */
router.post('/', checkAuth, async (req, res) => {
  const data = (({ name, description, type, color, builderCost, retailCost }) => ({
    name, description, type, color, builderCost, retailCost
  }))(req.body);

  if (req.body.id) {
    await CatalogItem.findByIdAndUpdate(req.body.id, data, { runValidators: true });
  } else {
    await CatalogItem.create(data);
  }
  res.redirect('/admin/catalog');
});

/* ───────────── Delete ───────────── */
router.delete('/:id', checkAuth, async (req, res) => {
  await CatalogItem.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
