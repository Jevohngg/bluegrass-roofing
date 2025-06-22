/****************************************
 * app.js
 ****************************************/
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const morgan = require('morgan');
require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');

const app = express();

// Connect to MongoDB (optional, if you have a URI)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bluegrass-roofing';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Set up Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Parse incoming JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const session = require('express-session');
const MongoStore = require('connect-mongo');

app.set('trust proxy', 1);

// Session middleware configuration
app.use(session({
  secret: process.env.SESSION_SECRET || '2025RoofingBlueGrassAdminSecret!',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    // expire sessions after 24h
    ttl: 24 * 60 * 60,
    touchAfter: 60 * 60
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    // in prod, serve secure cookies only over HTTPS
    secure: process.env.NODE_ENV === 'production',
    // protect against CSRF on cross-site navigations
    sameSite: 'lax'
  }
}));

// HOME ROUTE
const homeRoutes = require('./routes/home');
app.use('/', homeRoutes);

// NEW ROUTES
const authRoutes = require('./routes/auth');
app.use(authRoutes);

const servicesRoutes = require('./routes/services');
app.use('/services', servicesRoutes);

const claimsRoutes = require('./routes/claims');
app.use('/claims', claimsRoutes);

const contactRoutes = require('./routes/contact');
app.use('/contact', contactRoutes);

const guaranteeRoutes = require('./routes/guarantee');
app.use('/guarantee', guaranteeRoutes);

const portalRoutes = require('./routes/portal');
app.use(portalRoutes);

const quoteRoutes = require('./routes/quote');
app.use('/quote', quoteRoutes);

// === Onboarding Route (New) ===
const onboardingRoutes = require('./routes/onboarding');
app.use('/onboarding', onboardingRoutes);

// Admin Route for the internal dashboard (completely separate from the main platform)
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// Admin Messaging Routes (new chat system)
const messagingRoutes = require('./routes/messages');
app.use('/admin/messages', messagingRoutes);

const adminCalendarRoutes = require('./routes/adminCalendar');
app.use('/admin/calendar', adminCalendarRoutes);

// Create HTTP server and initialize Socket.io
const server = http.createServer(app);
const io = socketIO(server, {
  // optional config
});

// Make io accessible inside routes/controllers
app.set('io', io);

// Socket.io connection events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('joinCalendarRoom', () => socket.join('calendarRoom'));

  // Admin can join a dedicated admin room
  socket.on('joinAdminRoom', () => {
    socket.join('admin-room');
    console.log(`Socket ${socket.id} joined admin-room`);
  });

  // Clients can join their own room named by userId
  socket.on('joinUserRoom', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room for user ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
