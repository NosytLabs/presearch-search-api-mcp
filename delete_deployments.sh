#!/bin/bash

# Script to delete all GitHub deployments except the most recent one
# Usage: ./delete_deployments.sh <owner> <repo> <github_token>
# Example: ./delete_deployments.sh myorg myrepo ghp_1234567890abcdef

set -e  # Exit on any error

# Check arguments
if [ $# -ne 3 ]; then
    echo "Usage: $0 <owner> <repo> <github_token>"
    echo "Example: $0 myorg myrepo ghp_1234567890abcdef"
    exit 1
fi

OWNER="$1"
REPO="$2"
TOKEN="$3"

# GitHub API base URL
API_URL="https://api.github.com/repos/$OWNER/$REPO"

# Function to make API calls
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    curl -s -X "$method" \
         -H "Authorization: token $TOKEN" \
         -H "Accept: application/vnd.github.v3+json" \
         ${data:+-d "$data"} \
         "$API_URL$endpoint"
}

# Function to get deployments
get_deployments() {
    api_call "GET" "/deployments" | jq -r '.[] | "\(.id) \(.created_at)"' | sort -k2 -r
}

# Function to delete deployment
delete_deployment() {
    local deployment_id="$1"
    echo "Deleting deployment ID: $deployment_id"
    api_call "DELETE" "/deployments/$deployment_id"
}

# Main logic
echo "Fetching deployments for $OWNER/$REPO..."

# Get all deployments sorted by creation date (newest first)
deployments=$(get_deployments)

if [ -z "$deployments" ]; then
    echo "No deployments found."
    exit 0
fi

# Get the most recent deployment ID
most_recent_id=$(echo "$deployments" | head -n1 | awk '{print $1}')
echo "Most recent deployment ID: $most_recent_id"

# Get all other deployment IDs
other_deployments=$(echo "$deployments" | tail -n +2 | awk '{print $1}')

if [ -z "$other_deployments" ]; then
    echo "Only one deployment found. Nothing to delete."
    exit 0
fi

echo "Found $(echo "$other_deployments" | wc -l) older deployments to delete:"
echo "$other_deployments"

# Confirmation
read -p "Are you sure you want to delete these deployments? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

# Delete deployments
for deployment_id in $other_deployments; do
    if delete_deployment "$deployment_id"; then
        echo "Successfully deleted deployment $deployment_id"
    else
        echo "Failed to delete deployment $deployment_id" >&2
    fi
done

echo "Operation completed. Kept the most recent deployment: $most_recent_id"