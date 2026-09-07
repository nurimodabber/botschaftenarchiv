#!/usr/bin/env python3
"""
cleanup_vercel_deployments.py

Bereinigt aeltere Vercel-Deployments ueber die Vercel REST-API,
um das 10 GB Speicherlimit (Deployment Storage) einzuhalten.
Das aktive Production-Deployment wird dabei geschuetzt und niemals geloescht.

Verwendung:
  export VERCEL_TOKEN="dein_vercel_token"
  python3 cleanup_vercel_deployments.py [--dry-run] [--keep 3] [--team nuri14] [--project botschaftenarchiv]
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime


def api_request(url, token, method="GET", body=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "VercelCleanupScript/1.0"
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            if content:
                return json.loads(content)
            return {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(error_body)
            err_msg = err_json.get("error", {}).get("message", error_body)
        except Exception:
            err_msg = error_body
        raise RuntimeError(f"Vercel API Fehler (HTTP {e.code}): {err_msg}")


def resolve_team_id(token, team_slug):
    if not team_slug:
        return None
    url = "https://api.vercel.com/v2/teams"
    data = api_request(url, token)
    teams = data.get("teams", [])
    for t in teams:
        if t.get("slug") == team_slug or t.get("id") == team_slug:
            return t.get("id")
    return None


def get_active_production_deployment(token, project_name, team_id=None):
    team_param = f"?teamId={team_id}" if team_id else ""
    url = f"https://api.vercel.com/v9/projects/{project_name}{team_param}"
    data = api_request(url, token)
    prod = data.get("targets", {}).get("production", {})
    return prod.get("id")


def fetch_all_deployments(token, project_name, team_id=None):
    deployments = []
    base_url = "https://api.vercel.com/v6/deployments"
    params = [f"app={project_name}", "limit=100"]
    if team_id:
        params.append(f"teamId={team_id}")

    next_timestamp = None
    while True:
        curr_params = list(params)
        if next_timestamp:
            curr_params.append(f"until={next_timestamp}")
        url = f"{base_url}?{'&'.join(curr_params)}"
        data = api_request(url, token)
        batch = data.get("deployments", [])
        if not batch:
            break
        deployments.extend(batch)
        pagination = data.get("pagination", {})
        next_timestamp = pagination.get("next")
        if not next_timestamp or len(batch) < 100:
            break

    return deployments


def delete_deployment(token, deployment_id, team_id=None):
    team_param = f"?teamId={team_id}" if team_id else ""
    url = f"https://api.vercel.com/v13/deployments/{deployment_id}{team_param}"
    return api_request(url, token, method="DELETE")


def main():
    parser = argparse.ArgumentParser(
        description="Bereinigung historischer Vercel-Deployments zur Speicheroptimierung."
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("VERCEL_TOKEN"),
        help="Vercel Access Token (oder Umgebungsvariable VERCEL_TOKEN)"
    )
    parser.add_argument(
        "--project",
        default="botschaftenarchiv",
        help="Projektname in Vercel (Standard: botschaftenarchiv)"
    )
    parser.add_argument(
        "--team",
        default="nuri14",
        help="Team-Slug oder Team-ID (Standard: nuri14)"
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=3,
        help="Anzahl der neuesten Deployments, die behalten werden sollen (Standard: 3)"
    )
    parser.add_argument(
        "--all-old",
        action="store_true",
        help="Loescht alle alten Deployments ausser dem aktiven Production-Deployment."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Testlauf: Zeigt nur an, welche Deployments geloescht werden wuerden, ohne Loeschung auszufuehren."
    )

    args = parser.parse_args()

    token = args.token
    if not token:
        print("Fehler: Kein Vercel-Token angegeben.")
        print()
        print("Anleitung zur Erstellung eines Tokens:")
        print("1. Oeffne https://vercel.com/account/tokens im Browser.")
        print("2. Klicke auf 'Create Token', waehle einen Namen und Scope.")
        print("3. Fuehre das Skript aus mit:")
        print("   python3 scripts/cleanup_vercel_deployments.py --token <DEIN_TOKEN>")
        print("   oder setze die Umgebungsvariable:")
        print("   export VERCEL_TOKEN=<DEIN_TOKEN>")
        print()
        print("Alternativ manuell ueber das Web-Dashboard loeschen:")
        print(f"   https://vercel.com/{args.team}/{args.project}/deployments")
        sys.exit(1)

    print(f"Projekt: {args.project}")
    print(f"Team / Account: {args.team}")
    print("Pruefe Authentifizierung und Team-Zuordnung...")

    team_id = None
    if args.team:
        try:
            team_id = resolve_team_id(token, args.team)
            if team_id:
                print(f"Team ID identifiziert: {team_id}")
            else:
                print(f"Hinweis: Team '{args.team}' nicht in der Team-Liste gefunden. Nutze persoenlichen Account.")
        except Exception as e:
            print(f"Warnung bei Team-Aufloesung: {e}")

    # Aktives Production Deployment abrufen
    try:
        active_prod_id = get_active_production_deployment(token, args.project, team_id)
        print(f"Aktives Production-Deployment (geschuetzt): {active_prod_id}")
    except Exception as e:
        print(f"Warnung: Konnte aktives Production-Deployment nicht direkt ermitteln: {e}")
        active_prod_id = None

    # Alle Deployments auflisten
    print("Rufe Deployments ab...")
    deployments = fetch_all_deployments(token, args.project, team_id)
    total_count = len(deployments)
    print(f"Insgesamt {total_count} Deployments gefunden.")

    if total_count == 0:
        print("Keine Deployments vorhanden.")
        return

    # Sortieren nach Erstelldatum absteigend (neueste zuerst)
    deployments.sort(key=lambda d: d.get("created", 0), reverse=True)

    keep_count = 1 if args.all_old else max(1, args.keep)

    to_keep = []
    to_delete = []

    retained_counter = 0
    for dep in deployments:
        dep_id = dep.get("uid")
        is_active_prod = (dep_id == active_prod_id)
        
        # Das aktive Production-Deployment wird immer behalten
        if is_active_prod:
            to_keep.append(dep)
            continue

        if retained_counter < keep_count:
            to_keep.append(dep)
            retained_counter += 1
        else:
            to_delete.append(dep)

    print()
    print("Uebersicht:")
    print(f"  Zu behalten: {len(to_keep)} Deployments")
    for dep in to_keep:
        dt = datetime.fromtimestamp(dep.get("created", 0) / 1000).strftime("%Y-%m-%d %H:%M:%S")
        is_prod = " [AKTIVE PRODUKTION]" if dep.get("uid") == active_prod_id else ""
        print(f"    - {dep.get('uid')} | {dt} | {dep.get('url')} | {dep.get('state')}{is_prod}")

    print(f"  Zu loeschen: {len(to_delete)} Deployments")
    for dep in to_delete:
        dt = datetime.fromtimestamp(dep.get("created", 0) / 1000).strftime("%Y-%m-%d %H:%M:%S")
        print(f"    - {dep.get('uid')} | {dt} | {dep.get('url')} | {dep.get('state')}")

    if not to_delete:
        print("\nKeine Deployments zum Loeschen markiert.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Es wurden keine Aenderungen durchgefuehrt. {len(to_delete)} Deployments waeren geloescht worden.")
        print("Fuehre den Befehl ohne '--dry-run' aus, um die Loeschung vorzunehmen.")
        return

    print(f"\nStarte Loeschung von {len(to_delete)} Deployments...")
    deleted_count = 0
    failed_count = 0

    for dep in to_delete:
        dep_id = dep.get("uid")
        try:
            delete_deployment(token, dep_id, team_id)
            deleted_count += 1
            print(f"  Geloescht: {dep_id} ({dep.get('url')})")
        except Exception as e:
            failed_count += 1
            print(f"  Fehler beim Loeschen von {dep_id}: {e}")

    print()
    print("Bereinigung abgeschlossen:")
    print(f"  Erfolgreich geloescht: {deleted_count}")
    print(f"  Fehlgeschlagen:        {failed_count}")
    print(f"  Verbleibend:           {len(to_keep)}")


if __name__ == "__main__":
    main()
