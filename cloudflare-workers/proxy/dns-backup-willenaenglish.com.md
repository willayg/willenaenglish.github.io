# DNS backup — willenaenglish.com

Snapshot taken: 2025-12-08

This file contains the DNS records observed for `willenaenglish.com` (useful for copying into Cloudflare before cutover or for rollback).

## Nameservers (current at registrar)
- dns1.registrar-servers.com
- dns2.registrar-servers.com

## A records (apex)
(TTL 1799)
- willenaenglish.com A 185.199.111.153
- willenaenglish.com A 185.199.109.153
- willenaenglish.com A 185.199.110.153
- willenaenglish.com A 185.199.108.153

## CNAME
(TTL 1799)
- www.willenaenglish.com CNAME willenaenglish.github.io

## MX records (TTL 1800)
- willenaenglish.com MX 10 eforward2.registrar-servers.com
- willenaenglish.com MX 10 eforward1.registrar-servers.com
- willenaenglish.com MX 10 eforward3.registrar-servers.com
- willenaenglish.com MX 15 eforward4.registrar-servers.com
- willenaenglish.com MX 20 eforward5.registrar-servers.com

> Note: multiple MX entries exist with different priorities. Copy them exactly into Cloudflare if you move the zone.

## TXT (TTL 1800)
- willenaenglish.com TXT "v=spf1 include:spf.efwd.registrar-servers.com ~all"

## Quick restore instructions (rollback)
1. If you change nameservers to Cloudflare and later want to revert, go to Namecheap → Domain List → Manage → Nameservers and set the nameservers back to:
   - `dns1.registrar-servers.com`
   - `dns2.registrar-servers.com`
2. Save and verify with:
```powershell
Resolve-DnsName willenaenglish.com -Type NS
Resolve-DnsName willenaenglish.com -Type A
Resolve-DnsName www.willenaenglish.com -Type CNAME
```

## Notes
- Keep this file safe and do NOT commit any secrets here. This is only a DNS record snapshot for operational use.
