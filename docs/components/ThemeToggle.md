# ThemeToggle

The trigger remains exactly `Themes`, without an icon. It opens a named nonmodal Appearance settings dialog containing native Palette (seven choices) and Color mode (three choices) radio groups. One Dark disables the mode group. Selection keeps the panel open; native arrows/Space work, Escape and Close restore trigger focus, outside click/focus departure dismiss it. The panel scrolls within mobile bounds. No effects preference is exposed. Persistence/state come only from ThemeProvider; colors do not alter layout.

One Dark retains structural glass; the six documented palettes use solid surfaces. See [ThemeToggle module](../modules/ThemeToggle.md) and [DESIGN](../DESIGN.md).
