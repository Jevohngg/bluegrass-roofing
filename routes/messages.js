// routes/messages.js
const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const User = require('../models/User');
const { sendNewMessageEmail } = require('../utils/sendEmail'); // your email utility

// Middleware to ensure Admin is logged in
function checkAdminAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.redirect('/admin'); // your admin login page
}

// —————————————————————————————————————————————
// 0) Autocomplete users by email
// GET /admin/messages/users/search?q=foo
router.get('/users/search', checkAdminAuth, async (req, res) => {
  try {
    const q = req.query.q || '';
    const regex = new RegExp('^' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
    const users = await User.find({ email: regex })
      .limit(5)
      .select('firstName lastName email');
    res.json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json([]);
  }
});

// —————————————————————————————————————————————
// 1) Compose New Message page
// GET /admin/messages/new
router.get('/new', checkAdminAuth, async (req, res) => {
  try {
    const threads = await Thread.find({})
      .populate('userId', 'firstName lastName email')
      .sort({ lastMessageAt: -1 });
    res.render('admin/messages/thread', {
      thread: null,
      threads,
      compose: true,
      pageTitle: 'New Message',
      activeTab: 'messages'
    });
  } catch (err) {
    console.error('Error loading compose page:', err);
    res.status(500).send('Server Error');
  }
});

// —————————————————————————————————————————————
// 2) Initiate a new thread & send initial message
// POST /admin/messages/initiate
router.post('/initiate', checkAdminAuth, async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId) return res.status(400).send('Recipient is required');
    if (!text)   return res.status(400).send('Message text is required');

    const user = await User.findById(userId);
    if (!user) return res.status(404).send('User not found');

    let thread = await Thread.findOne({ userId: user._id });
    if (!thread) {
      thread = new Thread({ userId: user._id });
    }

    thread.messages.push({
      sender: 'admin',
      text,
      createdAt: new Date(),
      read: false
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    await sendNewMessageEmail({
      recipientEmail: user.email,
      fromAdmin: true,
      messageText: text,
      link: `${process.env.BASE_URL}/portal/messages`
    });

    const io = req.app.get('io');
    io.to(user._id.toString()).emit('newMessage', {
      threadId: thread._id,
      sender: 'admin',
      text,
      createdAt: new Date().toISOString()
    });

    res.redirect(`/admin/messages/${thread._id}`);
  } catch (err) {
    console.error('Error initiating thread:', err);
    res.status(500).send('Server Error');
  }
});

// —————————————————————————————————————————————
// 3) Legacy: start or reuse a thread via email
// POST /admin/messages/start
router.post('/start', checkAdminAuth, async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail) return res.status(400).send('User email is required');

    const user = await User.findOne({ email: userEmail.trim().toLowerCase() });
    if (!user) return res.status(404).send('No user found with that email');

    let thread = await Thread.findOne({ userId: user._id });
    if (!thread) {
      thread = new Thread({ userId: user._id });
      await thread.save();
    }
    res.redirect(`/admin/messages/${thread._id}`);
  } catch (err) {
    console.error('Error starting thread:', err);
    res.status(500).send('Server Error');
  }
});

// —————————————————————————————————————————————
// 4) List all threads
// GET /admin/messages
router.get('/', checkAdminAuth, async (req, res) => {
  const threads = await Thread.find({})
    .populate('userId','firstName lastName email')
    .sort({ lastMessageAt: -1 });
  res.render('admin/messages/thread', {
    threads,
    thread: null,         // no thread loaded
    compose: false,       // not the “new” screen
    pageTitle: 'Admin Messages',
    activeTab: 'messages'
  });
});

// —————————————————————————————————————————————
// 5) View a specific thread
// GET /admin/messages/:threadId
router.get('/:threadId', checkAdminAuth, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId).populate('userId');
    if (!thread) return res.status(404).send('Thread not found');

    thread.messages.forEach(m => { if (m.sender !== 'admin') m.read = true });
    await thread.save();

    const threads = await Thread.find({})
      .populate('userId', 'firstName lastName email')
      .sort({ lastMessageAt: -1 });

    res.render('admin/messages/thread', {
      thread,
      threads,
      pageTitle: `Chat with ${thread.userId.firstName} ${thread.userId.lastName}`,
      activeTab: 'messages'
    });
  } catch (err) {
    console.error('Error fetching thread:', err);
    res.status(500).send('Server Error');
  }
});

// —————————————————————————————————————————————
// 6) Send message in existing thread
// POST /admin/messages/:threadId/send
router.post('/:threadId/send', checkAdminAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).send('Message text required');

    const thread = await Thread.findById(req.params.threadId).populate('userId');
    if (!thread) return res.status(404).send('Thread not found');

    thread.messages.push({
      sender: 'admin',
      text,
      createdAt: new Date(),
      read: false
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    await sendNewMessageEmail({
      recipientEmail: thread.userId.email,
      fromAdmin: true,
      messageText: text,
      link: `${process.env.BASE_URL}/portal/messages`
    });

    const io = req.app.get('io');
    io.to(thread.userId._id.toString()).emit('newMessage', {
      threadId: thread._id,
      sender: 'admin',
      text,
      createdAt: new Date().toISOString()
    });

    res.redirect(`/admin/messages/${thread._id}`);
  } catch (err) {
    console.error('Error sending message as admin:', err);
    res.status(500).send('Server Error');
  }
});

// —————————————————————————————————————————————
// 7) Delete a thread
// DELETE /admin/messages/:threadId
router.delete('/:threadId', checkAdminAuth, async (req, res) => {
  try {
    const thread = await Thread.findByIdAndDelete(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting thread:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
