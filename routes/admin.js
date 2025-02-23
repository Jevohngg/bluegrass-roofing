const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');

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
      res.render('admin/dashboard', { groupedLeads, activeTab: 'leads', pageTitle: 'BlueGrass Roofing | Admin Dashboard'});
    })
    .catch(err => {
      console.error('Error fetching leads:', err);
      res.status(500).send('Server Error');
    });
});



// GET /admin/documents - display documents page (placeholder)
router.get('/documents', checkAuth, (req, res) => {
  res.render('admin/documents', { activeTab: 'documents' });
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

// ADD/UPDATE: GET /admin/customers - display customers dashboard
router.get('/customers', checkAuth, async (req, res) => {
  try {
    // Retrieve all users
    const allUsers = await User.find({}).sort({ createdAt: -1 });
    // Separate into active vs. archived
    const activeUsers = allUsers.filter(user => user.status !== 'archived');
    const archivedUsers = allUsers.filter(user => user.status === 'archived');

    return res.render('admin/customers', {
      activeUsers,
      archivedUsers,
      activeTab: 'customers',
      pageTitle: 'BlueGrass Roofing | Admin Dashboard'
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    return res.status(500).send('Server Error');
  }
});

// ADD/UPDATE: POST /admin/customer/:id/status - archive/unarchive a user
router.post('/customer/:id/status', checkAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body; // expected 'archived' or 'active'

    if (!['archived', 'active'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating user status:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
