const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename: user-id-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user._id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// @desc    Upload avatar
// @route   POST /api/upload/avatar
// @access  Private
exports.uploadAvatar = [
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Please upload a file' });
            }

            // Construct public URL
            // Assuming server serves 'uploads' directory at /uploads
            const protocol = req.protocol;
            const host = req.get('host');
            const avatarUrl = `${protocol}://${host}/uploads/avatars/${req.file.filename}`;

            res.status(200).json({
                success: true,
                avatarUrl: avatarUrl
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ success: false, message: 'Server error during upload' });
        }
    }
];
