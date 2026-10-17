# Setting up kp-skills on Kirsten's Mac

About 15 minutes, once. Steps 1–3 are best done by Tom; after that Kirsten
only ever talks to Claude.

## What's needed

- macOS on Apple silicon or Intel, with Homebrew installed (it is).
- Claude Desktop, signed in to Kirsten's Max plan.
- About 400 MB free: ~250 MB for the renderer in `~/.kp-skills`, plus the
  plugin and posts.
- Internet for set-up and updates only. Making posts works offline.

## 1. Make the posts folder

In Finder, make a folder **KP Posts** inside **Pictures**
(`~/Pictures/KP Posts`). Claude will work in this folder. (Set-up creates
it too, but the Code tab needs a folder to open first.)

## 2. Add the marketplace, with automatic updates

Third-party marketplaces don't update automatically unless asked to, so
register this one in Claude's user settings with auto-update on. In
Terminal:

```bash
open -e ~/.claude/settings.json   # create it with {} first if it doesn't exist
```

and add (merging with anything already there):

```json
{
  "extraKnownMarketplaces": {
    "kp-skills": {
      "source": { "source": "github", "repo": "tvdavies/kp-skills" },
      "autoUpdate": true
    }
  }
}
```

The terminal, the desktop app's local sessions and VS Code all read this
file, so it applies to Claude Desktop's Code tab.

(Alternative: in a Code tab session type
`/plugin marketplace add tvdavies/kp-skills`, then in `/plugin` →
**Marketplaces** select it and choose **Enable auto-update**.)

## 3. Install the plugin

1. Open Claude Desktop and switch to the **Code** tab.
2. Start a local session in the folder `~/Pictures/KP Posts`.
3. Click **+** next to the prompt box → **Plugins** → **Add plugin**.
4. Find **kp** (Kirsten Photography posts) from the kp-skills marketplace
   and install it for **your user account**.
5. Start a new session in the same folder so the skills load. Typing
   `/kp:` should show `kp-post`, `kp-template` and `kp-help`.

## 4. Run set-up (by asking Claude)

In the session, type:

> Set up the KP post tools.

Claude runs the kp-help skill, which runs `setup.sh`. It:

1. checks Node.js 20+ and installs it with `brew install node` if missing,
2. installs the pinned Playwright and headless Chromium into
   `~/.kp-skills/runtime` (one download, a few minutes),
3. creates `~/Pictures/KP Posts` with `My templates`, `My fonts` and a
   read-me,
4. renders a test post offline and reports in plain English.

The skills pre-approve their own `kp.mjs`, `doctor.mjs` and `setup.sh`
commands for the message that starts them. On follow-up messages Claude
may ask again: choose the option to **always allow** that command. The
plugin's path includes its version, so after an update it may ask once
more. Allow editing files in `KP Posts` too, and opening files (`open`) to
show previews and exports.

If macOS asks whether Claude may access the Pictures folder, allow it.

To run set-up by hand instead (Terminal):

```bash
ls ~/.claude/plugins/cache/kp-skills/kp/      # the installed version, e.g. 0.1.0
bash ~/.claude/plugins/cache/kp-skills/kp/0.1.0/setup.sh
```

## 5. Try it

> Make an example post so I can see what it does.

or, with her own photos:

> Make a carousel from these photos [drag them in] with a cover that says
> "Autumn light".

Finished images appear in
`~/Pictures/KP Posts/<date> <title>/exports/Instagram` and `…/Facebook`.

## Updates

With auto-update on, Claude refreshes the plugin when a session starts and
uses the new version from the next session. A plugin update only reaches
her when the `version` in `plugins/kp/.claude-plugin/plugin.json` changes,
so bump it with each release. If an update needs a new renderer, her next
post will say so and Claude will re-run set-up.

Existing posts don't change with updates: each keeps its own brand files.

## Troubleshooting

Ask Claude "Check the KP post tools", which runs the doctor. By hand:

```bash
node ~/.claude/plugins/cache/kp-skills/kp/<version>/scripts/doctor.mjs
```

| Problem | Fix |
| --- | --- |
| `kp` isn't in the plugin browser | Check step 2; restart Claude Desktop. |
| Skills don't appear after installing | Start a new session. |
| "renderer isn't installed" | Re-run set-up. |
| Set-up fails at Node | `brew install node` in Terminal, then re-run. |
| Set-up fails downloading Chromium | Check the internet connection and re-run; it resumes cleanly. |
| Permission prompts every time | Choose "always allow" for the kp commands. |

To remove everything: uninstall the plugin (**+ → Plugins → Manage
plugins**), delete `~/.kp-skills`, and remove the marketplace from
`~/.claude/settings.json`. Her posts in `~/Pictures/KP Posts` stay.
