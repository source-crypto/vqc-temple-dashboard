#!/usr/bin/env bash
# Example curl commands to exercise the endpoints.
# Assumes your app is running locally on port 3000 and the router is mounted at root.
# Adjust host/path if your app mounts the router under /api (e.g., http://localhost:3000/api/network/status)

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "GET Network Status"
curl -s "${BASE_URL}/network/status" | jq .

echo
echo "GET Validators"
curl -s "${BASE_URL}/network/validators" | jq .

echo
echo "GET Peers"
curl -s "${BASE_URL}/network/peers" | jq .

echo
echo "GET Chain Info"
curl -s "${BASE_URL}/network/chain-info" | jq .