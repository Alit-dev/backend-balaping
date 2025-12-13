const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
require('dotenv').config({ path: '../.env' });

const checkUserTeam = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/uptime-monitor');
        const email = 'testuser_debug_1@example.com';
        const user = await User.findOne({ email }).populate('teams');

        console.log(`User: ${user.name}`);
        console.log(`Verified: ${user.verified}`);
        console.log(`Teams count: ${user.teams.length}`);

        if (user.teams.length === 0) {
            console.log('Creating default team...');
            const team = new Team({
                name: `${user.name}'s Team`,
                owner: user._id,
                members: [{ userId: user._id, role: 'owner' }],
            });
            await team.save();
            user.teams.push(team._id);
            await user.save();
            console.log('Default team created and assigned.');
        }
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

checkUserTeam();
