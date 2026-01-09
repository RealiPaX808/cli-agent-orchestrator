import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const CLAUDE_CONFIG = 'claude';
const GLM_CONFIG = 'glm';

// Panel indicator class
const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Claude Config Switcher', false);

        this._extension = extension;
        this._settings = extension.getSettings();

        // Create icon
        let icon = new St.Icon({
            icon_name: 'system-switch-user-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(icon);

        // Create menu item with switch
        this._createMenu();

        // Load initial state
        this._loadState();
    }

    _createMenu() {
        // Create switch item
        this._switchItem = new PopupMenu.PopupSwitchMenuItem(
            _('Use GLM Config'),
            false
        );

        this._switchItem.connect('toggled', (item) => {
            this._onToggled(item.state);
        });

        this.menu.addMenuItem(this._switchItem);

        // Add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Add status label
        this._statusLabel = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            can_focus: false
        });
        this.menu.addMenuItem(this._statusLabel);
    }

    _loadState() {
        try {
            const currentConfig = this._settings.get_string('current-config');
            const isGlm = currentConfig === GLM_CONFIG;
            this._switchItem.setToggleState(isGlm);
            this._updateStatus(isGlm);
        } catch (e) {
            logError(e, 'Failed to load state');
            this._settings.set_string('current-config', CLAUDE_CONFIG);
            this._updateStatus(false);
        }
    }

    _onToggled(state) {
        const config = state ? GLM_CONFIG : CLAUDE_CONFIG;

        try {
            this._switchConfig(config);
            this._settings.set_string('current-config', config);
            this._updateStatus(state);

            Main.notify(
                'Claude Config Switcher',
                `Switched to ${config.toUpperCase()} configuration`
            );
        } catch (e) {
            logError(e, 'Failed to switch config');
            Main.notifyError(
                'Claude Config Switcher',
                'Failed to switch configuration. See logs for details.'
            );
            // Revert switch state
            this._switchItem.setToggleState(!state);
        }
    }

    _switchConfig(config) {
        const homeDir = GLib.get_home_dir();
        const claudeDir = GLib.build_filenamev([homeDir, '.claude']);

        // Ensure .claude directory exists
        const claudeDirFile = Gio.File.new_for_path(claudeDir);
        if (!claudeDirFile.query_exists(null)) {
            claudeDirFile.make_directory_with_parents(null);
        }

        const settingsPath = GLib.build_filenamev([claudeDir, 'settings.json']);
        const claudeConfigPath = GLib.build_filenamev([claudeDir, 'settings.claude.json']);
        const glmConfigPath = GLib.build_filenamev([claudeDir, 'settings.glm.json']);

        const sourcePath = config === CLAUDE_CONFIG ? claudeConfigPath : glmConfigPath;

        // Check if source config exists
        const sourceFile = Gio.File.new_for_path(sourcePath);
        if (!sourceFile.query_exists(null)) {
            throw new Error(`Configuration file not found: ${sourcePath}`);
        }

        // Create backup of current settings
        const settingsFile = Gio.File.new_for_path(settingsPath);
        if (settingsFile.query_exists(null)) {
            const backupPath = GLib.build_filenamev([claudeDir, 'settings.backup.json']);
            const backupFile = Gio.File.new_for_path(backupPath);
            settingsFile.copy(backupFile, Gio.FileCopyFlags.OVERWRITE, null, null);
        }

        // Copy source config to settings.json
        const destFile = Gio.File.new_for_path(settingsPath);
        sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);

        // Manage OAuth credentials based on config
        this._manageOAuthCredentials(config, claudeDir);
    }

    _manageOAuthCredentials(config, claudeDir) {
        const credentialsPath = GLib.build_filenamev([claudeDir, '.credentials.json']);
        const credentialsBackupPath = GLib.build_filenamev([claudeDir, '.credentials.json.oauth-backup']);

        const credentialsFile = Gio.File.new_for_path(credentialsPath);
        const backupFile = Gio.File.new_for_path(credentialsBackupPath);

        if (config === CLAUDE_CONFIG) {
            // Switch to Claude: Restore OAuth credentials from backup
            if (backupFile.query_exists(null)) {
                // Move backup back to active credentials (not copy!)
                backupFile.move(credentialsFile, Gio.FileCopyFlags.OVERWRITE, null, null);
            }
        } else {
            // Switch to GLM: Disable OAuth credentials (move to backup)
            if (credentialsFile.query_exists(null)) {
                credentialsFile.move(backupFile, Gio.FileCopyFlags.OVERWRITE, null, null);
            }
        }
    }

    _updateStatus(isGlm) {
        const config = isGlm ? 'GLM' : 'Claude';
        this._statusLabel.label.text = `Active: ${config}`;
    }

    destroy() {
        super.destroy();
    }
});

export default class ClaudeConfigSwitcherExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
