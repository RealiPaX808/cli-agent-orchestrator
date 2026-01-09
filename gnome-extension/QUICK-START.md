# Quick Start - Claude Config Switcher

Eine GNOME Extension zum Wechseln zwischen Claude und GLM Konfigurationen.

## Schnell-Installation

```bash
cd claude-config-switcher@local
./install.sh
```

Das Script führt dich durch die Installation und Konfiguration.

## Manuelle Installation

```bash
# 1. Extension kopieren
cp -r claude-config-switcher@local ~/.local/share/gnome-shell/extensions/

# 2. Schema kompilieren
cd ~/.local/share/gnome-shell/extensions/claude-config-switcher@local
glib-compile-schemas schemas/

# 3. Extension aktivieren
gnome-extensions enable claude-config-switcher@local

# 4. Configs einrichten
mkdir -p ~/.claude
cp example-configs/settings.claude.json ~/.claude/
cp example-configs/settings.glm.json ~/.claude/

# 5. API Keys eintragen
nano ~/.claude/settings.claude.json  # Füge Anthropic API Key ein
nano ~/.claude/settings.glm.json     # Füge Z.AI API Key ein

# 6. GNOME Shell neu laden
# X11: Alt+F2, dann 'r' und Enter
# Wayland: Abmelden und neu anmelden
```

## Verwendung

1. **Icon im Panel finden**: Nach dem Neustart erscheint ein Icon oben rechts
2. **Konfiguration wechseln**: Klicke auf das Icon und toggle den Switch
3. **Status prüfen**: Der aktive Status wird im Popup angezeigt

## Konfigurationsdateien

Die Extension benötigt zwei Dateien in `~/.claude/`:

### `settings.claude.json` (Anthropic)
```json
{
  "environmentVariables": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-...",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "API_TIMEOUT_MS": "300000"
  },
  "modelMappings": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20251101",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250929",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-haiku-20241022"
  }
}
```

### `settings.glm.json` (Z.AI)
```json
{
  "environmentVariables": {
    "ANTHROPIC_AUTH_TOKEN": "your-zai-api-key",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000"
  },
  "modelMappings": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "GLM-4.7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "GLM-4.7",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "GLM-4.5-Air"
  }
}
```

## API Keys

- **Anthropic**: [console.anthropic.com](https://console.anthropic.com)
- **Z.AI**: [z.ai](https://z.ai) → Open Platform

## Fehlerbehebung

### Extension erscheint nicht
```bash
# Logs prüfen
journalctl -f -o cat /usr/bin/gnome-shell | grep claude

# Schema neu kompilieren
cd ~/.local/share/gnome-shell/extensions/claude-config-switcher@local
glib-compile-schemas schemas/
```

### Config-Wechsel funktioniert nicht
```bash
# Dateien prüfen
ls -la ~/.claude/
# Sollte zeigen: settings.claude.json, settings.glm.json

# Berechtigungen korrigieren
chmod 644 ~/.claude/settings.*.json
chmod 755 ~/.claude
```

## Weitere Informationen

Siehe [claude-config-switcher@local/README.md](claude-config-switcher@local/README.md) für vollständige Dokumentation.
