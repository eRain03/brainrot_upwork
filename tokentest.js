const { Amplify } = require('aws-amplify');
const { signIn, fetchAuthSession } = require('aws-amplify/auth');
const https = require('https');
const querystring = require('querystring');
const readline = require('readline');

// Constants from the API documentation
const _pool_id = 'us-east-2_MlnzCFgHk';
const _client_id = '1956req5ro9drdtbf5i6kis4la';
const _cognito_hostname = 'https://login.eldorado.gg';
const _eldorado_hostname = 'www.eldorado.gg';  // Include 'www.' to avoid redirects

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: _pool_id,
      userPoolClientId: _client_id,
      loginWith: {
        oauth: {
          domain: _cognito_hostname.replace('https://', ''),
          redirectSignIn: `https://${_eldorado_hostname}/account/auth-callback`,
          responseType: "code",
        },
      },
    },
  },
};

Amplify.configure(awsConfig);

async function authenticate(username, password) {
  try {
    const signInOutput = await signIn({ username, password });
    if (signInOutput.nextStep.signInStep !== 'DONE') {
      throw new Error(`Sign-in not complete. Next step: ${signInOutput.nextStep.signInStep}`);
    }
    const session = await fetchAuthSession();
    if (!session.tokens || !session.tokens.idToken) {
      throw new Error('No ID token found in session.');
    }
    return session.tokens.idToken.toString();  // Use .toString() to get the JWT string
  } catch (error) {
    console.error('Error during authentication:', error);
    throw error;
  }
}

function getInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
    // Hide password input
    if (prompt.includes('password')) {
      let hidden = '';
      rl._writeToOutput = (stringToWrite) => {
        if (stringToWrite === '\r\n') {
          rl.output.write('\r\n');
        } else if (stringToWrite.length === 1) {
          hidden += stringToWrite;
        } else {
          rl.output.write(prompt);
        }
      };
    }
  });
}

async function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node test_api.js <your_email>');
    process.exit(1);
  }

  const username = process.argv[2];
  const password = await getInput('Enter your password: ');

  let idToken;
  try {
    idToken = await authenticate(username, password);
    console.log('Authentication successful.');
    console.log('ID Token:', idToken);  // Print the ID token
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }

  // Test public endpoint (no auth required)
  const queryData = querystring.stringify({
    offerType: 'Account',
    itemTreeId: '16-1-0',
    isInstantDelivery: 'true'
  });
  const publicPath = `/api/flexibleOffers?${queryData}`;
  const publicOptions = {
    hostname: _eldorado_hostname,
    path: publicPath,
    headers: {
      'Accept': 'application/json'
    }
  };

  await new Promise((resolve, reject) => {
    https.get(publicOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('\nPublic Endpoint Test:');
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode === 200) {
          const data = JSON.parse(body);
          console.log(`Number of offers returned: ${data.length}`);
          console.log('Sample data (first offer if available):', data[0] || 'No data');
        } else {
          console.log('Response:', body);
        }
        resolve();
      });
    }).on('error', reject);
  });

  // Test private endpoint (requires auth)
  const privatePath = '/api/orders/me';
  const privateOptions = {
    hostname: _eldorado_hostname,
    path: privatePath,
    headers: {
      'Accept': 'application/json',
      'Cookie': `__Host-EldoradoIdToken=${idToken}`
    }
  };

  await new Promise((resolve, reject) => {
    https.get(privateOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('\nPrivate Endpoint Test (/api/orders/me):');
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode === 200) {
          const data = JSON.parse(body);
          console.log('Your orders data:', data);
        } else {
          console.log('Response:', body);
        }
        resolve();
      });
    }).on('error', reject);
  });
}

main();
