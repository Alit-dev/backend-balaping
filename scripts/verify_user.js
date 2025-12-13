const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/uptime-monitor');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const verifyUser = async () => {
    await connectDB();
    const email = 'debug_curl_1@example.com';
    const user = await User.findOne({ email });
    try {
        if (user) {
            console.log('User found, creating team...');

            // Create default team for user
            const team = new Team({
                name: `${user.name}'s Team`,
                owner: user._id,
                members: [{ userId: user._id, role: 'owner' }],
            });
            await team.save();
            console.log(`Team created: ${team._id}`);

            // Update user
            console.log('Updating user...');
            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        verified: true,
                        verificationToken: undefined,
                        verificationTokenExpiry: undefined
                    },
                    $push: { teams: team._id }
                }
            );
            console.log(`User updated successfully`);
        } else {
            console.log(`User ${email} not found`);
        }
    } catch (error) {
        console.error('Verify error:', error);
    }
    process.exit();
};

verifyUser();
