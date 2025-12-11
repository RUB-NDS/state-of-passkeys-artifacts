#!/bin/sh

# Apply IP blocking rules if blocklist.txt exists
if [ -f /app/blocklist.txt ]; then
    echo "Applying IP blocklist rules..."
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines and comments
        case "$line" in
            ""|\#*) continue ;;
        esac
        # Add DROP rule for each IP/subnet (block outgoing traffic)
        sudo iptables -A OUTPUT -d "$line" -j DROP && \
        echo "Blocked outgoing traffic to: $line"
    done < /app/blocklist.txt
    echo "IP blocklist rules applied successfully"
else
    echo "No blocklist.txt found, skipping IP blocking"
fi

# Execute the original command
exec "$@"