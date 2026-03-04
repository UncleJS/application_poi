[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Containers: Podman](https://img.shields.io/badge/Containers-Podman-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org/)
[![API: OpenAPI](https://img.shields.io/badge/API-OpenAPI-6BA539?logo=swagger&logoColor=white)](https://www.openapis.org/)
[![Local Port: 9010](https://img.shields.io/badge/Local%20Port-9010-blue)](#)

# Backup and Restore

## Table of Contents
- [Backup Strategy](#backup-strategy)
- [Scheduled Backups](#scheduled-backups)
- [Create Backup](#create-backup)
- [Restore Backup](#restore-backup)
- [Safety Notes](#safety-notes)

## Backup Strategy
- Backups are SQL dump files created from the running MariaDB container.
- Backup output path: `~/.config/poi-stack/backups/`.
- File naming uses UTC timestamp format: `poi_YYYYMMDDTHHMMSSZ.sql`.

[Go to TOC](#table-of-contents)

## Scheduled Backups
- Automatic backups run through `poi-backup.timer`.
- Default schedule is daily at `02:15` local time.
- The timer calls `poi-backup.service`, which executes `./scripts/backup.sh`.

[Go to TOC](#table-of-contents)

## Create Backup
Run:

```bash
./scripts/backup.sh
```

The command reads credentials from `~/.config/poi-stack/poi.env` and writes a dump to the backup directory.

[Go to TOC](#table-of-contents)

## Restore Backup
Run:

```bash
./scripts/restore.sh /absolute/path/to/backup.sql
```

Restore is destructive to current live data in the target DB and should only be used when intentional.

[Go to TOC](#table-of-contents)

## Safety Notes
- Always keep at least one recent successful backup before maintenance.
- Test restore regularly in a disposable local environment.
- Archive-only API deletes reduce accidental permanent data loss at application level.

[Go to TOC](#table-of-contents)

© 2026 UncleJS - Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
