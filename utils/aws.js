// utils/aws.js
require('dotenv').config();
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Create an S3 instance
const s3 = new aws.S3();

// Create a Multer upload middleware for claim files
const uploadClaim = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME, // e.g. "bluegrass-roofing-bucket"
    acl: 'public-read', // or 'private' if you prefer
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const fileName = `claims/${Date.now().toString()}-${file.originalname}`;
      cb(null, fileName);
    }
  })
});

module.exports = { uploadClaim };
