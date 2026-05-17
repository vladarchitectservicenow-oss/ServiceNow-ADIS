#!/bin/bash
# Copyright (C) 2026 Vladimir Kapustin
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# ADIS Deployment Script — Push to GitHub
# Usage: export GITHUB_PAT=ghp_... && bash deploy.sh

set -e

REPO_DIR="/home/crixus/agentic-loop/deployment_repos/ServiceNow-ADIS"
REMOTE_URL="https://github.com/vladarchitectservicenow-oss/ServiceNow-ADIS.git"

cd "$REPO_DIR"

if [ -z "$GITHUB_PAT" ]; then
    echo "ERROR: GITHUB_PAT is not set."
    echo "Set it with: export GITHUB_PAT=ghp_..."
    exit 1
fi

# Configure remote with PAT
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GITHUB_PAT}@github.com/vladarchitectservicenow-oss/ServiceNow-ADIS.git"

git push -u origin main --force || {
    echo "Push failed. Trying to create repo first..."
    curl -s -H "Authorization: token ${GITHUB_PAT}" \
         -H "Accept: application/vnd.github.v3+json" \
         https://api.github.com/user/repos \
         -d '{"name":"ServiceNow-ADIS","description":"Australia Deprecation Impact Scanner — scoped app for ServiceNow","private":false,"has_issues":true,"has_wiki":false}' | python3 -m json.tool
    git push -u origin main
}

echo "ADIS deployed to: ${REMOTE_URL}"
