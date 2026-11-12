# Deploying Brightville on a Synology NAS

The NAS runs the image that CI publishes to the GitHub Container Registry, `ghcr.io/frankandreas/brightville:latest`, whenever a change lands on `main` and the tests pass.
The repository is public, so no registry login is needed.

The app is static: nginx serves the built game as a non-root user.
It keeps no data, so there is nothing to back up and no `.env` to set up.
Stars are saved in each browser, so the laptop and the iPad each have their own until the family login arrives (stage 4).
It runs next to the other family apps on port **8087**, for the home network only.

## Prerequisites

- A Synology NAS with **Container Manager** and SSH access (**Control Panel → Terminal & SNMP → Enable SSH**).
- For the Yoga Studio: the `*.local.<domain>` DNS record and wildcard certificate the other family apps use (family-budget-dashboard's README_DOCKER.md, "HTTPS at home"). Browsers give a page the camera only over HTTPS.

## Installation

1. **Prepare the folder.** Create `/volume1/docker/brightville` and upload `docker-compose.yml` into it **renamed to `compose.yaml`**. Remove the `build: .` line, since the NAS has no source code to build from. Change the port in it if 8087 is taken.
2. **Start** it over SSH:
   ```bash
   cd /volume1/docker/brightville
   sudo docker-compose up -d
   ```
3. Open `http://<NAS_IP>:8087`. The town works; the Yoga Studio door is grey until the next step.

### HTTPS at home (for the camera)

1. **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**: source HTTPS, `brightville.local.<domain>`, port 443, **Enable HSTS**; destination HTTP, `localhost`, port 8087.
2. **Control Panel → Security → Certificate → Settings**: pick the `*.local.<domain>` certificate for the new entry.
3. Open `https://brightville.local.<domain>`. The Yoga Studio door glows, and the first visit asks for the camera.

### A tile in family-hub

In the hub, **Einstellungen → Apps → add**: name Brightville, home address `https://brightville.local.<domain>`, no outside address, no app key.
Brightville doesn't use the family login yet, so the tile is only a link, shown to everybody.

### On the iPad

Open the address in Safari, then **Share → Add to Home Screen**.
Started from that icon, the game fills the screen without Safari's bars.
Turn the iPad sideways; the game is laid out for landscape.

Safari keeps the Stars of a home-screen app separate from those of the same page in a Safari tab.

## Updates

Set up [automatic updates](#automatic-updates) to install new versions nightly, or update by hand:

```bash
sudo docker-compose pull
sudo docker-compose up -d
```

## Automatic updates

`scripts/nas-update.sh` checks for a new image and installs it. Run nightly by DSM's Task Scheduler, it:

1. pulls the image; if nothing is new, it only checks that the app is healthy and stops,
2. keeps the running image tagged as `:previous` for [rolling back](#rolling-back-an-update),
3. restarts the app and waits until it is healthy, logging to `logs/update.log`.

It finds the compose file by its usual names and never changes it.
It also removes dangling (untagged) Docker images to save space, including those of other projects on the NAS.

### Setup

1. Copy `scripts/nas-update.sh` into the app folder (next to the compose file) and make it executable:
   ```bash
   sudo chmod +x /volume1/docker/brightville/nas-update.sh
   ```
2. Run it once by hand and check that it ends with "Up to date" or "Update complete":
   ```bash
   sudo /volume1/docker/brightville/nas-update.sh
   ```
3. In DSM, open **Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script**:
   - **General**: any name (e.g. `Brightville update`), user **root**
   - **Schedule**: daily, a few minutes apart from the other apps
   - **Task Settings**: tick **Send run details by email** and **only when the script terminates abnormally**, and enter the command:
     ```bash
     bash /volume1/docker/brightville/nas-update.sh
     ```

### Rolling back an update

First **disable the scheduled task**, otherwise the next night installs the same version again. Then:

```bash
cd /volume1/docker/brightville
sudo docker tag ghcr.io/frankandreas/brightville:previous ghcr.io/frankandreas/brightville:latest
sudo docker-compose up -d
```

Re-enable the task once a fixed version is published.

### Deploying from your computer

To install the latest version right away, or to roll out a new version of `nas-update.sh`:

```bash
cp .deploy.env.example .deploy.env   # once; then set NAS_HOST and NAS_DIR in it
scripts/deploy-nas.sh
```

It shows how the NAS's `nas-update.sh` differs from the repository's, uploads it after you confirm, and runs the update.
Add `--force` to restart the app even without a new version.
The compose file belongs to your deployment and is never copied.
`.deploy.env` is gitignored, so your NAS address stays out of the repository.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker pull` fails with *denied* or *unauthorized* | The image on GHCR is private (the default for a first publish) | On GitHub, **Packages → brightville → Package settings → Change visibility → Public** |
| *Bind for 0.0.0.0:8087 failed: port is already allocated* | Another app uses 8087 | Change the port in `compose.yaml` and run `sudo docker-compose up -d` |
| The Yoga Studio door is grey and the picture crossed out | The page is open over plain `http://` | Use the HTTPS address |
| Yoga shows the crossed-out camera | The camera was refused | iPad: **Settings → Apps → Safari → Camera → Ask** or **Allow**, then reload |
| No voice on the iPad | The ring switch or volume is off, or no German voice is installed | Turn the sound on; **Settings → Accessibility → Spoken Content → Voices → Deutsch** |
| The iPad shows an old version after an update | Safari kept the page | Close the game (swipe it away) and open it again |
| Email from Task Scheduler: *app not healthy* | A new version fails to start | Check `logs/update.log`, then [roll back](#rolling-back-an-update) |
