#!/bin/sh
# DuckDNS'dagi IP manzilni har 5 daqiqada yangilab turadi (uy internetida IP o'zgarishi mumkin).
while true; do
  result=$(curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=")
  echo "$(date '+%F %T') DuckDNS: ${result}"
  sleep 300
done
