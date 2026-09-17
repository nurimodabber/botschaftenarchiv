#!/usr/bin/env python3
"""
cleanup_vercel_deployments.py

Bereinigt aeltere Vercel-Deployments ueber die Vercel REST-API,
um das 10 GB Speicherlimit (Deployment Storage) einzuhalten.
Das aktive Production-Deployment wird dabei geschuetzt und niemals geloescht.

Verwendung:
  export VERCEL_TOKEN="dein_vercel_token"
  python3 cleanup_vercel_deployments.py [--dry-run] [--keep 2] [--all-projects]
"""

import os
import sys
import time
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime


def api_request(url, token, method="GET", body=None, max_retries=3):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "VercelCleanupScript/2.0"
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req) as resp:
                content = resp.read().decode("utf-8")
                if content:
                    return json.loads(content)
                return {}
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            error_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(error_body)
                err_msg = err_json.get("error", {}).get("message", error_body)
            except Exception:
                err_msg = error_body
            raise RuntimeError(f"Vercel API Fehler (HTTP {e.code}): {err_msg}")
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            raise e


def resolve_team_id(token, team_slug):
    if not team_slug:
        return None
    url = "https://api.vercel.com/v2/teams"
    try:
        data = api_request(url, token)
        teams = data.get("teams", [])
        for t in teams:
            if t.get("slug") == team_slug or t.get("id") == team_slug:
                return t.get("id")
    except Exception:
        pass
    return None


def fetch_all_projects(token, team_id=None):
    team_param = f"?teamId={team_id}" if team_id else ""
    url = f"https://api.vercel.com/v9/projects{team_param}"
    data = api_request(url, token)
    return data.get("projects", [])


def fetch_all_deployments(token, project_id, team_id=None):
    deployments = []
    base_url = "https://api.vercel.com/v6/deployments"
    params = [f"projectId={project_id}", "limit=100"]
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


def cleanup_single_project(token, project_data, team_id, keep_count, all_old, dry_run):
    project_name = project_data.get("name")
    project_id = project_data.get("id")
    active_prod_id = project_data.get("targets", {}).get("production", {}).get("id")

    print(f"\n=======================================================")
    print(f"Projekt: {project_name} ({project_id})")
    print(f"Aktives Production-Deployment: {active_prod_id or 'Keines zugewiesen'}")
    print(f"=======================================================")

    deployments = fetch_all_deployments(token, project_id, team_id)
    total_count = len(deployments)
    print(f"Gefundene Deployments: {total_count}")

    if total_count == 0:
        return 0, 0, 0

    deployments.sort(key=lambda d: d.get("created", 0), reverse=True)

    effective_keep = 1 if all_old else max(1, keep_count)

    to_keep = []
    to_delete = []

    retained_counter = 0
    for dep in deployments:
        dep_id = dep.get("uid")
        is_active_prod = (dep_id == active_prod_id)
        
        if is_active_prod:
            to_keep.append(dep)
            continue

        if retained_counter < (effective_keep - 1):
            to_keep.append(dep)
            retained_counter += 1
        else:
            to_delete.append(dep)

    print(f"  -> Behalten: {len(to_keep)} Deployments")
    for dep in to_keep:
        dt = datetime.fromtimestamp(dep.get("created", 0) / 1000).strftime("%Y-%m-%d %H:%M:%S")
        is_prod = " [AKTIV PROD]" if dep.get("uid") == active_prod_id else ""
        print(f"     [SAFE] {dep.get('uid')} | {dt} | {dep.get('url')} | {dep.get('state')}{is_prod}")

    print(f"  -> Zum Loeschen: {len(to_delete)} Deployments")
    for dep in to_delete[:5]:
        dt = datetime.fromtimestamp(dep.get("created", 0) / 1000).strftime("%Y-%m-%d %H:%M:%S")
        print(f"     [DEL]  {dep.get('uid')} | {dt} | {dep.get('url')}")
    if len(to_delete) > 5:
        print(f"     ... und {len(to_delete) - 5} weitere aeltere Deployments")

    if not to_delete:
        print("  -> Keine Bereinigung fuer dieses Projekt erforderlich.")
        return 0, 0, len(to_keep)

    if dry_run:
        print(f"  -> [DRY-RUN] Keine Loeschung durchgefuehrt ({len(to_delete)} wuerden geloescht).")
        return 0, 0, len(to_keep)

    print(f"  -> Loesche {len(to_delete)} Deployments...")
    deleted = 0
    failed = 0

    for idx, dep in enumerate(to_delete, 1):
        dep_id = dep.get("uid")
        try:
            delete_deployment(token, dep_id, team_id)
            deleted += 1
            print(f"     [{idx}/{len(to_delete)}] Geloescht: {dep_id}")
            time.sleep(0.15)
        except Exception as e:
            failed += 1
            print(f"     [{idx}/{len(to_delete)}] Fehler bei {dep_id}: {e}")

    return deleted, failed, len(to_keep)


def main():
    parser = argparse.ArgumentParser(
        description="Bereinigung historischer Vercel-Deployments zur Einhaltung des 10 GB Limits."
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("VERCEL_TOKEN"),
        help="Vercel Access Token (oder Umgebungsvariable VERCEL_TOKEN)"
    )
    parser.add_argument(
        "--project",
        default=None,
        help="Spezifischer Projektname in Vercel (Standard: alle Projekte des Accounts)"
    )
    parser.add_argument(
        "--team",
        default="nuri14",
        help="Team-Slug oder Team-ID (Standard: nuri14)"
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=2,
        help="Anzahl neuester Deployments, die behalten werden sollen (Standard: 2)"
    )
    parser.add_argument(
        "--all-old",
        action="store_true",
        help="Loescht alle alten Deployments ausser dem 1 aktiven Production-Deployment."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Testlauf: Zeigt nur an, welche Deployments geloescht werden wuerden."
    )

    args = parser.parse_args()

    token = args.token
    if not token:
        print("=" * 60)
        print("FEHLER: Kein Vercel Access Token gefunden.")
        print("=" * 60)
        print("Um die ueberfluessigen Deployments (40.66 GB) zu loeschen,")
        print("wird ein Vercel Personal Access Token benoetigt:")
        print()
        print("1. Oeffne: https://vercel.com/account/tokens")
        print("2. Klicke auf 'Create Token', Name z.B. 'Cleanup'")
        print("3. Fuehre aus:")
        print("   python3 scripts/cleanup_vercel_deployments.py --token <DEIN_TOKEN>")
        print()
        print("Alternativ kannst du das Token in GitHub Secrets als VERCEL_TOKEN hinterlegen,")
        print("damit GitHub Actions alle alten Deployments nach jedem Push automatisch loescht:")
        print("   gh secret set VERCEL_TOKEN -b '<DEIN_TOKEN>'")
        print("=" * 60)
        sys.exit(1)

    team_id = None
    if args.team:
        try:
            team_id = resolve_team_id(token, args.team)
            if team_id:
                print(f"Team ID gefunden: {team_id} ({args.team})")
        except Exception as e:
            print(f"Hinweis: {e}")

    projects = fetch_all_projects(token, team_id)
    if not projects:
        print("Keine Projekte gefunden. Pruefe Token-Berechtigungen.")
        sys.exit(1)

    if args.project:
        target_projects = [p for p in projects if p.get("name") == args.project or p.get("id") == args.project]
        if not target_projects:
            target_projects = [p for p in projects if args.project.lower() in p.get("name", "").lower()]
        if not target_projects:
            print(f"Fehler: Projekt '{args.project}' wurde nicht gefunden.")
            sys.exit(1)
    else:
        target_projects = projects

    print(f"Gefundene Projekte zur Pruefung ({len(target_projects)}):")
    for p in target_projects:
        print(f" - {p.get('name')} (ID: {p.get('id')})")

    total_deleted = 0
    total_failed = 0
    total_remaining = 0

    for p in target_projects:
        deleted, failed, remaining = cleanup_single_project(
            token=token,
            project_data=p,
            team_id=team_id,
            keep_count=args.keep,
            all_old=args.all_old,
            dry_run=args.dry_run
        )
        total_deleted += deleted
        total_failed += failed
        total_remaining += remaining

    print("\n" + "=" * 60)
    print("GESAMTERGEBNIS DER BEREINIGUNG:")
    print("=" * 60)
    print(f"  Erfolgreich geloescht: {total_deleted} Deployments")
    approx_freed_gb = (total_deleted * 580) / 1024
    print(f"  Geschaetzter freigegebener Speicher: ca. {approx_freed_gb:.1f} GB")
    print(f"  Fehlgeschlagen:        {total_failed}")
    print(f"  Verbleibend gesichert: {total_remaining} Deployments")
    approx_current_gb = (total_remaining * 580) / 1024
    print(f"  Geschaetzter aktueller Speicher: ca. {approx_current_gb:.1f} GB / 10 GB Limit")
    print("=" * 60)


if __name__ == "__main__":
    main()
