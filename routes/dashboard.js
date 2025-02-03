// // routes/dashboard.js
// const express = require('express');
// const router = express.Router();
// const Lead = require('../models/Lead');

// // Simple middleware for basic password protection
// router.use((req, res, next) => {
//   const password = req.query.password || req.body.password;
//   if (password === process.env.DASHBOARD_PASSWORD) {
//     next();
//   } else {
//     return res.status(401).send('Unauthorized: Incorrect password');
//   }
// });

// // GET dashboard – display all leads grouped by formType
// router.get('/', async (req, res) => {
//   try {
//     const leads = await Lead.find({}).sort({ submittedAt: -1 });
//     // Group leads by formType
//     const groupedLeads = leads.reduce((groups, lead) => {
//       groups[lead.formType] = groups[lead.formType] || [];
//       groups[lead.formType].push(lead);
//       return groups;
//     }, {});
//     res.render('leads/dashboard', { groupedLeads });
//   } catch (error) {
//     console.error('Error fetching leads:', error);
//     res.status(500).send('Server Error');
//   }
// });

// module.exports = router;
