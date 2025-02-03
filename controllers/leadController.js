// controllers/leadController.js
const Lead = require('../models/Lead');
const { sendUserConfirmationEmail, sendInternalNotificationEmail } = require('../utils/sendEmail');

exports.createLead = async (req, res) => {
  try {
    // Basic server-side validation
    const { formType, fullName, emailAddress, phoneNumber, message } = req.body;
    if (!formType || !fullName || !emailAddress) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Create and save the lead
    const lead = new Lead({ formType, fullName, emailAddress, phoneNumber, message });
    await lead.save();

    // Send emails concurrently
    await Promise.all([
      sendUserConfirmationEmail(lead),
      sendInternalNotificationEmail(lead)
    ]);

    return res.status(200).json({ success: true, message: 'Submission successful.' });
  } catch (error) {
    console.error('Error in createLead:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};
