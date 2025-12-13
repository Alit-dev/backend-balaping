const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

passport.use(
    new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
        },
        async (email, password, done) => {
            try {
                // Find user by email
                const user = await User.findOne({ email: email.toLowerCase() });

                if (!user) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                // Check password
                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                // Check if verified
                if (!user.verified) {
                    return done(null, false, { message: 'Please verify your email first' });
                }

                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

module.exports = passport;
