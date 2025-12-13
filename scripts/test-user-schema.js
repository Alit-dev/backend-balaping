const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testUserSchema() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find a user or create one
        let user = await User.findOne();
        if (!user) {
            console.log('No user found, creating test user');
            user = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
        }

        console.log(`Testing with user: ${user.email}`);

        // Update new fields
        user.avatar = 'https://example.com/avatar.jpg';
        user.timezone = 'EST';
        user.language = 'es';
        await user.save();

        // Fetch again to verify
        const updatedUser = await User.findById(user._id);
        console.log('Updated User Fields:');
        console.log(`Avatar: ${updatedUser.avatar}`);
        console.log(`Timezone: ${updatedUser.timezone}`);
        console.log(`Language: ${updatedUser.language}`);

        if (updatedUser.avatar === 'https://example.com/avatar.jpg' &&
            updatedUser.timezone === 'EST' &&
            updatedUser.language === 'es') {
            console.log('✅ User schema update verification PASSED');
        } else {
            console.error('❌ User schema update verification FAILED');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testUserSchema();
