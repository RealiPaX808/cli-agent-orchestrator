#!/usr/bin/env python3
"""Migration management script for CLI Agent Orchestrator database.

Usage:
    python scripts/run_migrations.py --help
    python scripts/run_migrations.py upgrade
    python scripts/run_migrations.py downgrade
    python scripts/run_migrations.py current
    python scripts/run_migrations.py history
    python scripts/run_migrations.py stamp [revision]
    python scripts/run_migrations.py check
    python scripts/run_migrations.py backup [--output PATH]
"""
import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from cli_agent_orchestrator.clients.database import engine
from cli_agent_orchestrator.constants import DATABASE_FILE, DATABASE_URL

# Alembic configuration
ALEMBIC_INI_PATH = PROJECT_ROOT / "alembic.ini"
alembic_cfg = Config(str(ALEMBIC_INI_PATH))
alembic_cfg.set_main_option("sqlalchemy.url", str(DATABASE_URL))


def backup_database(output_path: str | None = None) -> str:
    """Create a backup of the database.

    Args:
        output_path: Optional custom path for backup file.

    Returns:
        Path to the backup file.
    """
    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_path = str(DATABASE_FILE.parent / f"cli-agent-orchestrator-backup-{timestamp}.db")

    shutil.copy2(DATABASE_FILE, output_path)
    print(f"Database backed up to: {output_path}")
    return output_path


def check_data_integrity() -> dict:
    """Check database for orphaned records and integrity issues.

    Returns:
        Dictionary with check results.
    """
    issues = {}

    with engine.connect() as conn:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # Check for orphaned inbox messages
        if "inbox" in tables and "terminals" in tables:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM inbox i
                LEFT JOIN terminals t ON i.sender_id = t.id
                WHERE t.id IS NULL
            """)).scalar()
            if result > 0:
                issues["orphaned_inbox_sender"] = result

            result = conn.execute(text("""
                SELECT COUNT(*) FROM inbox i
                LEFT JOIN terminals t ON i.receiver_id = t.id
                WHERE t.id IS NULL
            """)).scalar()
            if result > 0:
                issues["orphaned_inbox_receiver"] = result

        # Check for orphaned workflow nodes
        if "workflow_nodes" in tables and "workflows" in tables:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM workflow_nodes wn
                LEFT JOIN workflows w ON wn.workflow_id = w.id
                WHERE w.id IS NULL
            """)).scalar()
            if result > 0:
                issues["orphaned_workflow_nodes"] = result

        # Check for orphaned tasks
        if "tasks" in tables and "workflows" in tables:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM tasks t
                LEFT JOIN workflows w ON t.workflow_id = w.id
                WHERE t.workflow_id IS NOT NULL AND w.id IS NULL
            """)).scalar()
            if result > 0:
                issues["orphaned_tasks"] = result

        # Check for foreign key constraints
        if "inbox" in tables:
            fks = inspector.get_foreign_keys("inbox")
            issues["inbox_foreign_keys"] = len(fks)

    return issues


def upgrade(target_revision: str = "head"):
    """Upgrade database to a specific revision.

    Args:
        target_revision: Target revision (default: 'head').
    """
    print(f"Upgrading database to: {target_revision}")

    # Check integrity first
    issues = check_data_integrity()
    if issues:
        print("\nData integrity issues detected:")
        for key, value in issues.items():
            print(f"  - {key}: {value}")
        response = input("\nContinue with migration? (y/N): ")
        if response.lower() != "y":
            print("Migration cancelled.")
            return

    # Create backup
    backup_database()

    # Run migration
    command.upgrade(alembic_cfg, target_revision)
    print(f"Database upgraded to: {target_revision}")


def downgrade(target_revision: str = "-1"):
    """Downgrade database by one or more steps.

    Args:
        target_revision: Target revision ('-1' for one step back).
    """
    print(f"Downgrading database to: {target_revision}")

    # Create backup before downgrade
    backup_database()

    # Run downgrade
    command.downgrade(alembic_cfg, target_revision)
    print(f"Database downgraded to: {target_revision}")


def current():
    """Show current database revision."""
    try:
        command.current(alembic_cfg, verbose=True)
    except Exception as e:
        print(f"Database not initialized or no migrations applied: {e}")


def history(verbose: bool = False):
    """Show migration history.

    Args:
        verbose: Show full details.
    """
    command.history(alembic_cfg, verbose=verbose)


def stamp(revision: str = "head"):
    """Stamp database with a specific revision (without running migration).

    Args:
        revision: Revision to stamp.
    """
    command.stamp(alembic_cfg, revision)
    print(f"Database stamped with revision: {revision}")


def show_schema():
    """Print current database schema information."""
    inspector = inspect(engine)

    print("\n" + "=" * 60)
    print("DATABASE SCHEMA")
    print("=" * 60)

    for table_name in sorted(inspector.get_table_names()):
        if table_name.startswith("alembic_"):
            continue

        print(f"\n[{table_name}]")
        columns = inspector.get_columns(table_name)
        for col in columns:
            nullable = "NULL" if col["nullable"] else "NOT NULL"
            default = f" DEFAULT {col['default']}" if col["default"] is not None else ""
            print(f"  {col['name']:20} {col['type']:20} {nullable}{default}")

        # Foreign keys
        fks = inspector.get_foreign_keys(table_name)
        if fks:
            print("  FOREIGN KEYS:")
            for fk in fks:
                print(f"    {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")

        # Indexes
        indexes = inspector.get_indexes(table_name)
        if indexes:
            print("  INDEXES:")
            for idx in indexes:
                unique = "UNIQUE " if idx["unique"] else ""
                print(f"    {unique}{idx['name']}: {idx['column_names']}")


def main():
    parser = argparse.ArgumentParser(
        description="Migration management for CLI Agent Orchestrator database"
    )

    subparsers = parser.add_subparsers(dest="command", help="Migration command")

    # Upgrade command
    subparsers.add_parser("upgrade", help="Upgrade database to latest version")

    # Downgrade command
    downgrade_parser = subparsers.add_parser("downgrade", help="Downgrade database")
    downgrade_parser.add_argument(
        "--revision", "-r", default="-1",
        help="Target revision (default: -1 for one step back)"
    )

    # Current command
    subparsers.add_parser("current", help="Show current database revision")

    # History command
    history_parser = subparsers.add_parser("history", help="Show migration history")
    history_parser.add_argument("-v", "--verbose", action="store_true")

    # Stamp command
    stamp_parser = subparsers.add_parser("stamp", help="Stamp database with revision")
    stamp_parser.add_argument(
        "revision", nargs="?", default="head",
        help="Revision to stamp (default: head)"
    )

    # Check command
    subparsers.add_parser("check", help="Check data integrity")

    # Schema command
    subparsers.add_parser("schema", help="Show database schema")

    # Backup command
    backup_parser = subparsers.add_parser("backup", help="Create database backup")
    backup_parser.add_argument(
        "--output", "-o",
        help="Output path for backup file"
    )

    args = parser.parse_args()

    if args.command == "upgrade":
        upgrade()
    elif args.command == "downgrade":
        downgrade(args.revision)
    elif args.command == "current":
        current()
    elif args.command == "history":
        history(args.verbose)
    elif args.command == "stamp":
        stamp(args.revision)
    elif args.command == "check":
        issues = check_data_integrity()
        if issues:
            print("\nData integrity issues detected:")
            print(json.dumps(issues, indent=2))
        else:
            print("\nNo data integrity issues found.")
    elif args.command == "schema":
        show_schema()
    elif args.command == "backup":
        backup_database(args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
