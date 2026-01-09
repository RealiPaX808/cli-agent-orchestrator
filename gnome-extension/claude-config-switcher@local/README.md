# Claude Config Switcher - GNOME Extension

Eine GNOME Shell Extension zum schnellen Wechseln zwischen Claude (Anthropic) und GLM (Z.AI) Konfigurationen für Claude Code CLI.

## Features

- 🔄 Schneller Wechsel zwischen zwei Claude Code Konfigurationen
- 🎨 Eleganter Panel-Indicator mit Toggle-Switch
- 💾 Persistente Speicherung des aktiven Profils
- 🔔 Desktop-Benachrichtigungen beim Wechsel
- 🛡️ Automatische Backup-Erstellung vor jedem Wechsel

## Voraussetzungen

- GNOME Shell 45 oder 46
- Claude Code CLI installiert
- API-Schlüssel für Anthropic und/oder Z.AI

## Installation

### 1. Extension installieren

```bash
# Extension-Verzeichnis kopieren
cp -r claude-config-switcher@local ~/.local/share/gnome-shell/extensions/

# GSettings Schema kompilieren
cd ~/.local/share/gnome-shell/extensions/claude-config-switcher@local
glib-compile-schemas schemas/

# GNOME Shell neu laden (X11)
# Alt+F2 drücken, 'r' eingeben und Enter

# Oder auf Wayland: Session neu starten oder:
dbus-send --type=method_call --dest=org.gnome.Shell \
  /org/gnome/Shell org.gnome.Shell.Extensions.ReloadExtension \
  string:'claude-config-switcher@local'
```

### 2. Extension aktivieren

```bash
# Via GNOME Extensions aktivieren
gnome-extensions enable claude-config-switcher@local

# Oder via GNOME Extensions App (GUI)
```

### 3. Konfigurationsdateien einrichten

Die Extension erwartet zwei Konfigurationsdateien in `~/.claude/`:

- `settings.claude.json` - Anthropic Claude Konfiguration
- `settings.glm.json` - Z.AI GLM Konfiguration

#### Claude Konfiguration erstellen

```bash
# Erstelle Verzeichnis falls noch nicht vorhanden
mkdir -p ~/.claude

# Kopiere Beispiel-Config und passe sie an
cp example-configs/settings.claude.json ~/.claude/settings.claude.json

# Füge deinen Anthropic API Key ein
nano ~/.claude/settings.claude.json
```

**Beispiel `settings.claude.json`:**

```json
{
  "authProvider": "oauth",
  "environmentVariables": {},
  "modelMappings": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20251101",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250929",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-haiku-20241022"
  },
  "hooks": {
    "PostToolUse": []
  },
  "enabledPlugins": {
    "frontend-design@claude-plugins-official": true,
    "context7@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "ralph-wiggum@claude-code-plugins": true,
    "typescript-lsp@claude-plugins-official": true
  }
}
```

**Wichtig für Claude (Anthropic):**
- `authProvider: "oauth"` - Verwendet OAuth Authentifizierung
- `environmentVariables: {}` - Leer, da OAuth verwendet wird (kein API Key nötig)

#### GLM Konfiguration erstellen

```bash
# Kopiere Beispiel-Config und passe sie an
cp example-configs/settings.glm.json ~/.claude/settings.glm.json

# Füge deinen Z.AI API Key ein
nano ~/.claude/settings.glm.json
```

**Beispiel `settings.glm.json`:**

```json
{
  "authProvider": "apiKey",
  "environmentVariables": {
    "ANTHROPIC_AUTH_TOKEN": "your-zai-api-key-here",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000"
  },
  "modelMappings": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "GLM-4.7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "GLM-4.7",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "GLM-4.5-Air"
  },
  "hooks": {
    "PostToolUse": []
  },
  "enabledPlugins": {
    "frontend-design@claude-plugins-official": true,
    "context7@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "ralph-wiggum@claude-code-plugins": true,
    "typescript-lsp@claude-plugins-official": true
  }
}
```

**Wichtig für GLM (Z.AI):**
- `authProvider: "apiKey"` - Verwendet API Key Authentifizierung
- `ANTHROPIC_AUTH_TOKEN` - Dein Z.AI API Key muss hier eingetragen werden
- `ANTHROPIC_BASE_URL` - Z.AI Endpoint für Claude-kompatible API

## Verwendung

### Panel-Indicator

Nach der Installation erscheint ein Icon im GNOME Panel (oben rechts).

### Konfiguration wechseln

1. Klicke auf das Icon im Panel
2. Toggle den Switch "Use GLM Config"
   - **Aus (links)**: Claude (Anthropic) ist aktiv
   - **An (rechts)**: GLM (Z.AI) ist aktiv
3. Eine Desktop-Benachrichtigung bestätigt den Wechsel

### Status anzeigen

Der aktive Status wird im Popup-Menu angezeigt:
- "Active: Claude" - Anthropic API wird verwendet
- "Active: GLM" - Z.AI API wird verwendet

## Wie es funktioniert

Die Extension verwaltet drei Dateien in `~/.claude/`:

1. **`settings.json`** - Aktive Konfiguration (wird von Claude Code verwendet)
2. **`settings.claude.json`** - Claude/Anthropic Konfiguration
3. **`settings.glm.json`** - GLM/Z.AI Konfiguration

Beim Wechsel:
1. Die aktuelle `settings.json` wird als `settings.backup.json` gesichert
2. Die gewählte Konfiguration wird nach `settings.json` kopiert
3. Claude Code verwendet automatisch die neue Konfiguration

## Fehlerbehebung

### Extension erscheint nicht im Panel

```bash
# Prüfe ob Extension aktiviert ist
gnome-extensions list | grep claude-config

# Prüfe Extension-Logs
journalctl -f -o cat /usr/bin/gnome-shell

# Schema neu kompilieren
cd ~/.local/share/gnome-shell/extensions/claude-config-switcher@local
glib-compile-schemas schemas/
```

### "Configuration file not found" Fehler

Stelle sicher, dass die Konfigurationsdateien existieren:

```bash
ls -la ~/.claude/
# Sollte zeigen:
# - settings.claude.json
# - settings.glm.json
```

### Wechsel funktioniert nicht

```bash
# Prüfe Dateiberechtigungen
chmod 644 ~/.claude/settings.*.json

# Prüfe Verzeichnisberechtigungen
chmod 755 ~/.claude
```

### Extension deaktivieren

```bash
gnome-extensions disable claude-config-switcher@local
```

## API Keys erhalten

### Anthropic Claude

1. Registriere dich bei [https://console.anthropic.com](https://console.anthropic.com)
2. Navigiere zu "API Keys"
3. Erstelle einen neuen API Key
4. Füge ihn in `settings.claude.json` ein

### Z.AI GLM

1. Registriere dich bei [https://z.ai](https://z.ai)
2. Navigiere zur Open Platform Management-Seite
3. Erstelle einen API Key
4. Füge ihn in `settings.glm.json` ein

## Entwicklung

### Debugging

```bash
# Extension-Logs anzeigen
journalctl -f -o cat /usr/bin/gnome-shell | grep claude-config

# Extension neu laden (während Entwicklung)
gnome-extensions disable claude-config-switcher@local
gnome-extensions enable claude-config-switcher@local
```

### Struktur

```
claude-config-switcher@local/
├── extension.js              # Hauptlogik
├── metadata.json             # Extension-Metadaten
├── schemas/                  # GSettings Schema
│   └── org.gnome.shell.extensions.claude-config-switcher.gschema.xml
├── example-configs/          # Beispiel-Konfigurationen
│   ├── settings.claude.json
│   └── settings.glm.json
└── README.md                # Diese Datei
```

## Sicherheit

⚠️ **Wichtig**: Deine API-Keys sind sensible Daten!

- Teile nie deine `settings.*.json` Dateien
- Füge `~/.claude/settings*.json` zu `.gitignore` hinzu
- Verwende separate API-Keys für Entwicklung und Produktion

## Lizenz

Apache-2.0 (wie das CLI Agent Orchestrator Projekt)

## Support

Bei Problemen öffne ein Issue im Repository.
