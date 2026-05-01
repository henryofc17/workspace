// Fix secure cookie setting to handle both development and production environments
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
    secure: isProduction, // Set secure flag for production
    httpOnly: true, // Helps prevent XSS
    maxAge: 3600000, // 1 hour
};

// Enhanced error logging with request details
app.post('/login', (req, res) => {
    // Handle login logic
    // ...
    console.error('Login error:', { message: error.message, requestBody: req.body }); // Log request details
    res.status(500).send('An error occurred');
});

// Improve edge case handling for better debugging
function handleEdgeCases(input) {
    if (!input) {
        console.error('Input cannot be empty');
        throw new Error('Input is required');
    }
    // Additional edge case logic
}