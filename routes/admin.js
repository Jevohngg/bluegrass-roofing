// routes/admin.js
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');

// Middleware to check if admin is authenticated
function checkAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  } else {
    return res.render('admin/login');
  }
}

// GET /admin - redirect to /admin/leads
router.get('/', checkAuth, (req, res) => {
  res.redirect('/admin/leads');
});

// GET /admin/leads - display leads dashboard
router.get('/leads', checkAuth, (req, res) => {
  Lead.find({}).sort({ submittedAt: -1 })
    .then(leads => {
      // Group leads by status; default to "new" if no status exists.
      const groupedLeads = { new: [], contacted: [], archived: [] };
      leads.forEach(lead => {
        let status = lead.status || 'new';
        if (!['new', 'contacted', 'archived'].includes(status)) {
          status = 'new';
        }
        groupedLeads[status].push(lead);
      });
      res.render('admin/dashboard', { groupedLeads, activeTab: 'leads' });
    })
    .catch(err => {
      console.error('Error fetching leads:', err);
      res.status(500).send('Server Error');
    });
});

// GET /admin/customers - display customers dashboard (placeholder)
router.get('/customers', checkAuth, (req, res) => {
  res.render('admin/customers', { activeTab: 'customers' });
});

// POST /admin/login - Process login form
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin/leads');
  } else {
    res.render('admin/login', { error: 'Incorrect password. Please try again.' });
  }
});

// GET /admin/logout - Log out and redirect to login
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// POST /admin/lead/:id/status - Update a lead's status (contacted or archived)
router.post('/lead/:id/status', checkAuth, (req, res) => {
  const leadId = req.params.id;
  const { status } = req.body;
  
  // Validate that the status is either 'contacted' or 'archived'
  if (!['contacted', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  
  Lead.findByIdAndUpdate(leadId, { status: status }, { new: true })
    .then(updatedLead => {
      if (updatedLead) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Lead not found.' });
      }
    })
    .catch(err => {
      console.error('Error updating lead status:', err);
      res.status(500).json({ success: false, message: 'Server error.' });
    });
});

// DELETE /admin/lead/:id - Delete a lead
router.delete('/lead/:id', checkAuth, (req, res) => {
  const leadId = req.params.id;
  Lead.findByIdAndDelete(leadId)
    .then(deletedLead => {
      if (deletedLead) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Lead not found.' });
      }
    })
    .catch(err => {
      console.error('Error deleting lead:', err);
      res.status(500).json({ success: false, message: 'Server error.' });
    });
});

module.exports = router;
