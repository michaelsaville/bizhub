#!/usr/bin/env bash
# Poll all keyless sources, then score everything (a few passes to drain caps).
set -uo pipefail
DIR=~/bizhub/scripts
for e in poll-grants poll-erate poll-awards poll-contracts poll-businesses; do "$DIR/cron.sh" "$e"; done
for e in score-grants score-bids score-awards score-businesses; do
  for i in 1 2 3 4 5; do "$DIR/cron.sh" "$e"; done
done
"$DIR/cron.sh" match-hot-grants
