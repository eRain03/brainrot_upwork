const { Amplify } = require('aws-amplify');
const { signIn, signOut, fetchAuthSession } = require('aws-amplify/auth');

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: 'us-east-2_MlnzCFgHk',
            userPoolClientId: '1956req5ro9drdtbf5i6kis4la'
        }
    }
});

async function run() {
    try {
        console.log("Signing out...");
        await signOut({ global: true });
        console.log("Signed out.");
    } catch(e) {
        console.log("Sign out err:", e.message);
    }
    try {
        console.log("Signing in...");
        await signIn({ username: "a", password: "b" });
    } catch(e) {
        console.log("Sign in err:", e.message);
    }
}
run();
