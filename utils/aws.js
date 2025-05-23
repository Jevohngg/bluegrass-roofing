// utils/aws.js
require('dotenv').config();


const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const multerS3 = require('multer-s3');

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET_NAME;

// 1) S3 client
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 2) Your existing claim-file uploader
const uploadClaim = multer({
  storage: multerS3({
    s3:     s3Client,
    bucket: BUCKET,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key:      (req, file, cb) => {
      const fileName = `claims/${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
});

// 3) Upload any Buffer to S3
async function uploadBuffer(buffer, key, contentType = 'application/pdf') {
  await s3Client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    ACL:         'private'
  }));
  return key; // you can return the key or ignore it
}

// 4) Generate a time-limited download URL
async function getSignedUrlForKey(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key:    key
  });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}

module.exports = {
  s3Client,
  uploadClaim,
  uploadBuffer,
  getSignedUrlForKey
};
