# Changelog

All notable changes to GitGress are documented in this file.

## 1.0.7

- Files icons now resolve Seti-style `languageIds` mappings via VS Code language
  contributions (e.g. `.java`, `.yaml`, `.ts`), so common types no longer share
  one generic default icon.

## 1.0.6

- Split Files icon DOM helpers so extension host TypeScript compile no longer
  depends on DOM lib; theme image load errors keep tree `slot` attributes.

## 1.0.5

- Files panel shows file and folder icons from the active File Icon Theme
  (SVG or Seti font glyphs), with Codicon fallback when a theme icon is
  unavailable.
- Icons refresh when the icon theme or color theme changes; CSP allows theme
  image/font resources in the Files webview.

## 1.0.4

- Commits tip pills: skip remote `HEAD` tip markers and restyle remote branch
  pills for clearer local vs remote distinction.

## 1.0.0

- First public release: multi-lane commit graph, paginated history, commit hover
  overlay, Files webview (list/tree/auto), and parent-commit diffs.
- Keyboard selection navigation in Commits (Arrow/Home/End/PageUp/PageDown).
- Distributable VSIX with VS Marketplace and Open VSX listing metadata.
