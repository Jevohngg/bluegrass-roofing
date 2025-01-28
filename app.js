/****************************************
 * app.js
 ****************************************/
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

// If you have environment variables, load them
// require('dotenv').config();

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

// HOME ROUTE
const homeRoutes = require('./routes/home');
app.use('/', homeRoutes);

// NEW ROUTES
const servicesRoutes = require('./routes/services');
app.use('/services', servicesRoutes);

const claimsRoutes = require('./routes/claims');
app.use('/claims', claimsRoutes);

const contactRoutes = require('./routes/contact');
app.use('/contact', contactRoutes);

const guaranteeRoutes = require('./routes/guarantee');
app.use('/guarantee', guaranteeRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


