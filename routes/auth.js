// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendUserSignupEmail } = require('../utils/sendEmail');

// GET /signup
// Renders the sign-up page, optionally capturing a "package" query parameter
router.get('/signup', (req, res) => {
  // If a package was passed in the query (e.g. /signup?package=Hassle-Free)
  // store it in session so we remember it after they sign up
  const { package: selectedPackage } = req.query;
  if (selectedPackage) {
    req.session.selectedPackage = selectedPackage;
  }
  return res.render('auth/signup', { currentPage: 'signup' });
});

// POST /signup
// Handles creating a new user, hashing password, sending email, setting session, redirecting to portal
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).render('auth/signup', {
        currentPage: 'signup',
        error: 'Please fill out all required fields.',
        formData: { firstName, lastName, email }
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.status(400).render('auth/signup', {
        currentPage: 'signup',
        error: 'Passwords do not match.',
        formData: { firstName, lastName, email }
      });
    }

    // Optionally check password length or complexity
    if (password.length < 6) {
      return res.status(400).render('auth/signup', {
        currentPage: 'signup',
        error: 'Password must be at least 6 characters long.',
        formData: { firstName, lastName, email }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('auth/signup', {
        currentPage: 'signup',
        error: 'Email already in use. Please log in or use a different email.',
        formData: { firstName, lastName }
      });
    }

    // Retrieve the selected package from session if it exists
    const selectedPackage = req.session.selectedPackage || '';

    // Create a new user document
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      selectedPackage
    });

    // Save the user (this triggers the password hashing in the pre-save hook)
    await newUser.save();

    // Send a signup confirmation email using SendGrid
    await sendUserSignupEmail(newUser);

    // Set session (log in the user)
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
      selectedPackage: newUser.selectedPackage
    };

    // Redirect to the client portal
    return res.redirect('/portal');
  } catch (err) {
    console.error('Error creating user:', err);
    return res.status(500).render('auth/signup', {
      currentPage: 'signup',
      error: 'An unexpected error occurred. Please try again.',
      formData: {}
    });
  }
});


  
  

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/'); // Go back to home page
    });
  });
  



// 1) GET /login
router.get('/login', (req, res) => {
    return res.render('auth/login', {
      currentPage: 'login'
    });
  });
  
  // 2) POST /login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).render('auth/login', {
          currentPage: 'login',
          error: 'Please enter both email and password.',
          formData: { email }
        });
      }
  
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).render('auth/login', {
          currentPage: 'login',
          error: 'Invalid email or password.',
          formData: { email }
        });
      }
  
      // Compare password with hashed password in DB
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).render('auth/login', {
          currentPage: 'login',
          error: 'Invalid email or password.',
          formData: { email }
        });
      }
  
      // If match, set session
      req.session.user = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        selectedPackage: user.selectedPackage
      };
  
      // Redirect to portal
      return res.redirect('/portal');
    } catch (err) {
      console.error('Error logging in user:', err);
      return res.status(500).render('auth/login', {
        currentPage: 'login',
        error: 'Server error. Please try again later.',
        formData: {}
      });
    }
  });
  

module.exports = router;
