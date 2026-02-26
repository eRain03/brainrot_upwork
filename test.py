import sys
import getpass
import boto3
from botocore.exceptions import ClientError
from pycognito import AWSSRP
import requests

# Constants from the API documentation
_POOL_ID = 'us-east-2_MlnzCFgHk'
_CLIENT_ID = '1956req5ro9drdtbf5i6kis4la'
_COGNITO_HOSTNAME = 'https://login.eldorado.gg'
_ELDORADO_HOSTNAME = 'eldorado.gg'

def authenticate(user_email, user_password):
    cognito = boto3.client('cognito-idp')
    try:
        aws_srp = AWSSRP(
            username=user_email,
            password=user_password,
            pool_id=_POOL_ID,
            client_id=_CLIENT_ID,
            client=cognito
        )
        auth_params = aws_srp.get_auth_params()
        response = cognito.initiate_auth(
            AuthFlow='USER_SRP_AUTH',
            AuthParameters=auth_params,
            ClientId=_CLIENT_ID
        )

        assert response["ChallengeName"] == "PASSWORD_VERIFIER"
        challenge_response = aws_srp.process_challenge(response["ChallengeParameters"], auth_params)

        response = cognito.respond_to_auth_challenge(
            ClientId=_CLIENT_ID,
            ChallengeName="PASSWORD_VERIFIER",
            ChallengeResponses=challenge_response
        )
        return response['AuthenticationResult']['IdToken']
    except ClientError as e:
        print(f"An error occurred: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        raise
    except AssertionError:
        print("Unexpected challenge name received.")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_api.py <your_email>")
        sys.exit(1)

    username = sys.argv[1]
    password = getpass.getpass("Enter your password: ")

    try:
        id_token = authenticate(username, password)
        print("Authentication successful. ID Token obtained.")
    except Exception as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)

    # Test public endpoint (no auth required)
    public_url = f"https://{_ELDORADO_HOSTNAME}/api/flexibleOffers?offerType=Account&itemTreeId=16-1-0&isInstantDelivery=true"
    try:
        public_response = requests.get(public_url)
        print("\nPublic Endpoint Test:")
        print(f"Status Code: {public_response.status_code}")
        if public_response.ok:
            data = public_response.json()
            print(f"Number of offers returned: {len(data)}")
            print("Sample data (first offer if available):", data[0] if data else "No data")
        else:
            print("Response:", public_response.text)
    except Exception as e:
        print(f"Error calling public endpoint: {e}")

    # Test private endpoint (requires auth)
    private_url = f"https://{_ELDORADO_HOSTNAME}/api/orders/me"
    headers = {
        'Cookie': f'__Host-EldoradoIdToken={id_token}',
        'Accept': 'application/json'
    }
    try:
        private_response = requests.get(private_url, headers=headers)
        print("\nPrivate Endpoint Test (/api/orders/me):")
        print(f"Status Code: {private_response.status_code}")
        if private_response.ok:
            data = private_response.json()
            print("Your orders data:", data)
        else:
            print("Response:", private_response.text)
    except Exception as e:
        print(f"Error calling private endpoint: {e}")
