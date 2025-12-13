const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        avatar: {
            type: String,
            default: '',
        },
        timezone: {
            type: String,
            default: 'UTC',
        },
        language: {
            type: String,
            default: 'en',
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verificationToken: String,
        verificationTokenExpiry: Date,
        resetToken: String,
        resetTokenExpiry: Date,
        twoFactorSecret: {
            type: String,
            select: false,
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        teams: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate verification token
userSchema.methods.generateVerificationToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return token;
};

// Generate reset token
userSchema.methods.generateResetToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.resetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    return token;
};

module.exports = mongoose.model('User', userSchema);
