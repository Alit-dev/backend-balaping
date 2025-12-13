const mongoose = require('mongoose');
const slugify = require('slugify');

const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Team name is required'],
            trim: true,
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        members: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                role: {
                    type: String,
                    enum: ['owner', 'admin', 'member'],
                    default: 'member',
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        invitations: [
            {
                email: {
                    type: String,
                    lowercase: true,
                },
                role: {
                    type: String,
                    enum: ['admin', 'member'],
                    default: 'member',
                },
                token: String,
                expiresAt: Date,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Generate slug before saving
teamSchema.pre('save', async function (next) {
    if (!this.isModified('name')) return next();

    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await mongoose.model('Team').findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    this.slug = slug;
    next();
});

// Generate invitation token
teamSchema.methods.generateInviteToken = function (email, role) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    this.invitations.push({
        email: email.toLowerCase(),
        role,
        token: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return token;
};

module.exports = mongoose.model('Team', teamSchema);
