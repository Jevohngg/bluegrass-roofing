const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendUserSignupEmail, sendPasswordResetCodeEmail } = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ================
// = EXISTING AUTH=
// ================

// GET /signup
// Renders the sign-up page, optionally capturing a "package" query parameter
router.get('/signup', (req, res) => {
  const { package: selectedPackage } = req.query;
  if (selectedPackage) {
    req.session.selectedPackage = selectedPackage;
  }
  return res.render('auth/signup', { currentPage: 'signup', pageTitle: 'Signup | BlueGrass Roofing' });
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
     const redirectTo = req.session.returnTo || '/portal';
     delete req.session.returnTo;
     return res.redirect(redirectTo);
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

// GET /login
router.get('/login', (req, res) => {
  // Optional success message (e.g., after password reset)
  const successMessage = req.session.successMessage || '';
  delete req.session.successMessage; // Clear it after use

  return res.render('auth/login', {
    currentPage: 'login',
    error: null,
    success: successMessage,
    formData: {},
    pageTitle: 'Login | BlueGrass Roofing'
  });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).render('auth/login', {
        currentPage: 'login',
        error: 'Please enter both email and password.',
        success: null,
        formData: { email }
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).render('auth/login', {
        currentPage: 'login',
        error: 'Invalid email or password.',
        success: null,
        formData: { email }
      });
    }

    // Compare password with hashed password in DB
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).render('auth/login', {
        currentPage: 'login',
        error: 'Invalid email or password.',
        success: null,
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
  const redirectTo = req.session.returnTo || '/portal';
  delete req.session.returnTo;
   return res.redirect(redirectTo);
  } catch (err) {
    console.error('Error logging in user:', err);
    return res.status(500).render('auth/login', {
      currentPage: 'login',
      error: 'Server error. Please try again later.',
      success: null,
      formData: {}
    });
  }
});

// =============================
// = NEW FORGOT PASSWORD FLOW =
// =============================

/**
 * Step 1: GET /forgot-password
 * - Renders a form asking the user for their email address.
 */
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgotPassword_email', {
    error: null,
    success: null,
    formData: {}
  });
});

/**
 * Step 2: POST /forgot-password
 * - Receives the email from the user.
 * - Generates a code, saves it to the user's record, and emails them.
 * - Redirects to /forgot-password/code to prompt user for that code.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).render('auth/forgotPassword_email', {
        error: 'Please enter your email address.',
        success: null,
        formData: {}
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security, do NOT reveal if the email isn't found
      return res.render('auth/forgotPassword_email', {
        error: 'If an account with that email exists, a code has been sent.',
        success: null,
        formData: { email }
      });
    }

    // Generate a 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    // Code expires in 1 hour
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
    await user.save();

    // Send the code via email
    await sendPasswordResetCodeEmail(user, resetCode);

    // Render success message and direct the user to code submission
    return res.render('auth/forgotPassword_code', {
      error: null,
      success: 'A verification code has been sent to your email.',
      formData: { email }
    });
  } catch (err) {
    console.error('Error generating reset code:', err);
    return res.status(500).render('auth/forgotPassword_email', {
      error: 'An unexpected error occurred. Please try again.',
      success: null,
      formData: {}
    });
  }
});

/**
 * Step 3: GET /forgot-password/code
 * - Renders a form for the user to enter the verification code
 *   (If you prefer a direct redirect from the previous step, you can skip this GET 
 *    and rely on the POST /forgot-password to render the code form. 
 *    Shown here for a complete multi-step flow.)
 */
router.get('/forgot-password/code', (req, res) => {
  res.render('auth/forgotPassword_code', {
    error: null,
    success: null,
    formData: {}
  });
});

/**
 * Step 4: POST /forgot-password/code
 * - Validates the code and expiration against the user record.
 * - If valid, store user._id in session, then redirect to the reset form.
 */
router.post('/forgot-password/code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).render('auth/forgotPassword_code', {
        error: 'Email and code are required.',
        success: null,
        formData: { email }
      });
    }

    const user = await User.findOne({ email });
    if (
      !user ||
      user.resetPasswordCode !== code ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < Date.now()
    ) {
      return res.status(400).render('auth/forgotPassword_code', {
        error: 'Invalid or expired code.',
        success: null,
        formData: { email }
      });
    }

    // If code is valid, store userId in session
    req.session.resetUserId = user._id;

    // Redirect to the reset form
    return res.redirect('/forgot-password/reset');
  } catch (err) {
    console.error('Error verifying code:', err);
    return res.status(500).render('auth/forgotPassword_code', {
      error: 'An unexpected error occurred. Please try again.',
      success: null,
      formData: {}
    });
  }
});

/**
 * Step 5: GET /forgot-password/reset
 * - Renders a form for the new password
 */
router.get('/forgot-password/reset', (req, res) => {
  // Check if we have a valid session user
  if (!req.session.resetUserId) {
    return res.redirect('/forgot-password');
  }
  res.render('auth/forgotPassword_reset', {
    error: null,
    success: null
  });
});

/**
 * Step 6: POST /forgot-password/reset
 * - Updates the user's password, clears the code, and redirects to /login
 */
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    if (!req.session.resetUserId) {
      return res.redirect('/forgot-password');
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).render('auth/forgotPassword_reset', {
        error: 'Please fill out both password fields.',
        success: null
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render('auth/forgotPassword_reset', {
        error: 'Passwords do not match.',
        success: null
      });
    }

    // Optional: add checks for password length or complexity
    if (newPassword.length < 6) {
      return res.render('auth/forgotPassword_reset', {
        error: 'New password must be at least 6 characters long.',
        success: null
      });
    }

    // Find user by ID
    const user = await User.findById(req.session.resetUserId);
    if (!user) {
      return res.redirect('/forgot-password');
    }

    // Update password
    user.password = newPassword; // Will be hashed in pre-save hook
    // Clear out code & expiration
    user.resetPasswordCode = '';
    user.resetPasswordExpires = undefined;
    await user.save();

    // Clear session
    delete req.session.resetUserId;

    // Set success message in session to display on login
    req.session.successMessage = 'Password reset successfully. You may now log in.';

    return res.redirect('/login');
  } catch (err) {
    console.error('Error resetting password:', err);
    return res.status(500).render('auth/forgotPassword_reset', {
      error: 'An unexpected error occurred. Please try again.',
      success: null
    });
  }
});

module.exports = router;
