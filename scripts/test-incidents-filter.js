const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const Team = require('../models/Team');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testFilters() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get a team
        const team = await Team.findOne();
        if (!team) {
            console.log('No team found');
            return;
        }
        console.log(`Testing with team: ${team.name} (${team._id})`);

        // Create some test incidents
        await Incident.deleteMany({ teamId: team._id, title: /Test Incident/ });

        const incidents = [
            {
                teamId: team._id,
                title: 'Test Incident 1 - Ongoing',
                status: 'investigating',
                description: 'Server is down',
            },
            {
                teamId: team._id,
                title: 'Test Incident 2 - Resolved',
                status: 'resolved',
                description: 'Database connection failed',
            },
            {
                teamId: team._id,
                title: 'Test Incident 3 - Monitoring',
                status: 'monitoring',
                description: 'High latency observed',
            },
        ];

        await Incident.insertMany(incidents);
        console.log('Created test incidents');

        // Test 1: All incidents
        const all = await Incident.find({ teamId: team._id });
        console.log(`Total incidents: ${all.length}`);

        // Test 2: Filter by status=ongoing (should exclude resolved)
        const ongoing = await Incident.find({
            teamId: team._id,
            status: { $ne: 'resolved' }
        });
        console.log(`Ongoing incidents (expected 2): ${ongoing.length}`);
        if (ongoing.length !== 2) console.error('FAILED: Ongoing filter incorrect');

        // Test 3: Search by title
        const search = await Incident.find({
            teamId: team._id,
            $or: [
                { title: { $regex: 'Database', $options: 'i' } },
                { description: { $regex: 'Database', $options: 'i' } },
            ]
        });
        console.log(`Search 'Database' (expected 1): ${search.length}`);
        if (search.length !== 1) console.error('FAILED: Search filter incorrect');

        console.log('Verification complete');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testFilters();
