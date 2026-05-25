#!/bin/bash
# Run this instead of plain `git push` to auto-stamp version & deploy time.

TODAY=$(date +"%Y%m%d")
NOW=$(date +"%Y/%m/%d %H:%M")

# Read current version.json
CURRENT_DATE=$(python3 -c "import json; d=json.load(open('version.json')); print(d['date'])" 2>/dev/null)
CURRENT_COUNT=$(python3 -c "import json; d=json.load(open('version.json')); print(d['count'])" 2>/dev/null)

# Increment count if same day, reset to 1 if new day
if [ "$CURRENT_DATE" = "$TODAY" ]; then
  COUNT=$((CURRENT_COUNT + 1))
else
  COUNT=1
fi

VERSION="Kris${TODAY}-${COUNT}"

# Write new version.json
python3 -c "
import json
data = {
  'version': '${VERSION}',
  'deployTime': '${NOW}',
  'date': '${TODAY}',
  'count': ${COUNT}
}
with open('version.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f'  version: ${VERSION}')
print(f'  deployTime: ${NOW}')
"

git add version.json
git commit -m "Deploy ${VERSION} at ${NOW}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
