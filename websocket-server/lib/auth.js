import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

function getKey(header, callback) {
    const jwksuri = `https://login.microsoftonline.com/${process.env.ENTRA_APP_TENANT_ID}/discovery/v2.0/keys`;

    const jwtclient = jwksClient({
        cache: true,
        rateLimit: true,
        jwksUri: jwksuri,
        requestAgent: null, // Try setting this to null explicitly
        requestHeaders: {}, // Add any necessary headers here
        timeout: 30000, // Increase timeout to 30 seconds
        proxy: null, // Set to null if you're not using a proxy
    });

    jwtclient.getSigningKey(header.kid, function (err, key) {
        if (err) {
            console.error('Error getting signing key:', err);
            callback(err);
            return;
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

export async function verifyToken(token) {
    return new Promise((resolve, reject) => {
        const options = {
            audience: `api://${process.env.ENTRA_APP_CLIENT_ID}`, // Replace with your API's Application (client) ID
            issuer: `https://sts.windows.net/${process.env.ENTRA_APP_TENANT_ID}/`,
            algorithms: ['RS256'],
        };

        jwt.verify(token, getKey, options, (err, decoded) => {
            if (err) {
                console.error('Token verification error:', err);
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
}

// Add this function to check JWKS endpoint
async function checkJwksEndpoint() {
   
    try {
        const response = await fetch(`https://login.microsoftonline.com/${process.env.ENTRA_APP_TENANT_ID}/discovery/v2.0/keys`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('JWKS endpoint response:', data);
    } catch (error) {
        console.error('Error checking JWKS endpoint:', error);
    }
}