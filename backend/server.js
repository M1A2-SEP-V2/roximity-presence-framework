const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Dummy database for demonstration purposes
let users = {};
let presenceLogs = [];

// Authentication endpoints
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).send('User already exists.');
    }
    users[username] = password;  // Storing unsalted passwords here just for the demo
    res.status(201).send('User registered.');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        req.session.username = username;
        return res.send('Login successful.');
    }
    res.status(401).send('Invalid credentials.');
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged out successfully.');
});

// Presence logging endpoints
app.post('/log-presence', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('Unauthorized.');
    }
    const { status } = req.body;
    presenceLogs.push({ username: req.session.username, status, timestamp: new Date() });
    res.send('Presence logged.');
});

// Attendance computation endpoint
app.get('/attendance', (req, res) => {
    if (!req.session.username) {
        return res.status(401).send('Unauthorized.');
    }
    // Simplistic implementation for demo; would likely involve more sophisticated logic
    const attendance = presenceLogs.filter(log => log.username === req.session.username);
    res.json(attendance);
});

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
