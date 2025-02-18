/****************************************
 * app.js
 ****************************************/
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

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

// Session middleware configuration
const session = require('express-session');
app.use(session({
  secret: '2025RoofingBlueGrassAdminSecret!', // Replace with a secure, random secret in production
  resave: false,
  saveUninitialized: false,
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

// Admin Route for the internal dashboard (completely separate from the main platform)
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);




// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
