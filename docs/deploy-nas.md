# Deploying Brightville on a Synology NAS

Brightville runs as two containers from images that CI publishes to the GitHub Container Registry whenever a change lands on `main` and the tests pass:

- **backend** (`ghcr.io/frankandreas/brightville/backend`): the game's server, with everyone's Stars, today's numbers and the parents' settings in a SQLite database in `./data`
- **frontend** (`ghcr.io/frankandreas/brightville/frontend`): nginx serving the game on port 8080 inside the container and forwarding `/api` to the backend

The repository is public, so no registry login is needed.
It runs next to the other family apps on port **8087**, for the home network only: requests through the Cloudflare tunnel are refused.
Who is playing comes from the family hub's login (family-hub's README, "For apps").

## Prerequisites

- A Synology NAS with **Container Manager** and SSH access (**Control Panel → Terminal & SNMP → Enable SSH**).
- family-hub running on the NAS, with its `*.local.<domain>` DNS record and wildcard certificate (family-hub's README_DOCKER.md). The hub's login cookie and the Yoga Studio's camera both need HTTPS.

## Installation

1. **Choose the user the backend runs as.** Reuse the DSM user of the other family apps and look up its IDs: `id <user>` (e.g. `uid=1031 gid=100`).
2. **Prepare the folder.** Create `/volume1/docker/brightville`, upload `docker-compose.yml` into it **renamed to `compose.yaml`**, and remove the two `build:` entries (the NAS has no source code). Create the data folder, owned by that user:
   ```bash
   cd /volume1/docker/brightville
   sudo mkdir -p data
   sudo chown -R 1031:100 data    # the IDs from step 1, or 999:999
   sudo chmod 700 data
   ```
3. **Create `.env`**:
   ```bash
   printf '%s\n' 'PUID=1031' 'PGID=100' 'PORT=8087' \
     'HUB_URL=http://<NAS_IP>:8086' 'HUB_PUBLIC_URL=https://home.local.<domain>' \
     'ALLOWED_HOSTS=brightville.local.<domain>' | sudo tee .env
   sudo chmod 600 .env
   ```
   - `HUB_URL`: how the backend reaches the hub (the hub's port on the NAS).
   - `HUB_PUBLIC_URL`: where browsers log in and out.
   - `HUB_APP_KEY`: only if the hub tile's app key is not `brightville`.
   - `ALLOWED_HOSTS`: the names browsers use for the game; any other name gets nothing.
   - Without `HUB_URL` nobody gets in: the page shows a sleeping cloud and the backend's log says why. **Never set `LOCAL_MODE=1` on the NAS**: it is for trying the game out without a hub, and lets anybody pick a parent.
4. **Start** it:
   ```bash
   sudo docker-compose pull
   sudo docker-compose up -d
   ```

### HTTPS at home

1. **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**: source HTTPS, `brightville.local.<domain>`, port 443, **Enable HSTS**; destination HTTP, `localhost`, port 8087.
2. **Control Panel → Security → Certificate → Settings**: pick the `*.local.<domain>` certificate for the new entry.

The game must be opened at this `*.local.<domain>` address: only there does the browser send the hub's login cookie.

### The tile in family-hub

In the hub, **Einstellungen → Apps → add**: name Brightville, home address `https://brightville.local.<domain>`, no outside address, **app key `brightville`**, and tick everyone who may play (the children, and the parents who want the parent area).

### First visit

- A child opens the address, is sent to the hub to log in once, and comes back to the game.
- A parent sees a gear next to the "?" in the town: it opens the parent area with every child's Stars, today's visits and play minutes, and three settings: daily goal (1–5 visits), play time per day (no limit, or 5–180 minutes), and Stars. Below them is the Cinema's film list: paste a YouTube link and give it a name. The Cinema stays closed until there is at least one film.
- **Stars from before stage 4** were saved in each browser and are not carried over. A parent types each child's number in once, in the parent area.

### On the iPad

Open the address in Safari, then **Share → Add to Home Screen**. Started from that icon, the game fills the screen without Safari's bars.
Each child logs in at the hub as themselves; the iPad and the laptop show the same Stars.

## Coming from the single image of stage 3

Stage 3 ran one container from `ghcr.io/frankandreas/brightville:latest`. To switch:

```bash
cd /volume1/docker/brightville
sudo docker-compose down
# then steps 1–4 above: the new compose.yaml, the data folder and .env
sudo docker image rm ghcr.io/frankandreas/brightville:latest ghcr.io/frankandreas/brightville:previous 2>/dev/null
```

Also copy the new `scripts/nas-update.sh` (below): the old one knows only one container.

## Where the data is, and backups

`data/brightville.db` holds the family's names (a copy of the hub's), everyone's Stars, today's numbers, the settings, a log of every visit and round, the Cinema's films and the children's paintings (at most 30 per child, a few MB at most each).

- **Every night** `nas-update.sh` (below) copies the database to `db-backups/` when it changed since the last copy, through SQLite's online backup, so the copy is consistent even while children play. It keeps the newest 5 copies and every copy younger than 7 days.
- **On another disk**: back up the whole folder `/volume1/docker/brightville` with **Hyper Backup**, as for the other family apps.

To restore by hand: stop the backend, then
`sudo sh -c 'gunzip -c db-backups/brightville-<stamp>.sqlite.gz > data/brightville.db'`, `sudo chown 1031:100 data/brightville.db`, and start again.

## Automatic updates

`scripts/nas-update.sh` (the same as family-hub's) backs up the database, pulls the images and, if there is a new one, keeps the old ones as `:previous`, restarts and waits until the backend is healthy (`logs/update.log`).
A version that doesn't get healthy within 5 minutes is rolled back at once: the previous images and the database from just before the update come back. The run still fails, so the mail below tells you.

1. Copy `scripts/nas-update.sh` into `/volume1/docker/brightville` and make it executable:
   ```bash
   sudo chmod +x /volume1/docker/brightville/nas-update.sh
   sudo /volume1/docker/brightville/nas-update.sh     # should end with "Up to date" or "Update complete"
   ```
2. **Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script**: user **root**, daily a few minutes apart from the other apps, command `bash /volume1/docker/brightville/nas-update.sh`. Under **Task Settings**, tick **Send run details by email** and **only when the script terminates abnormally**.

### Rolling back by hand

First **disable the scheduled task**, otherwise the next night installs the same version again. Then:

```bash
cd /volume1/docker/brightville
sudo docker tag ghcr.io/frankandreas/brightville/backend:previous ghcr.io/frankandreas/brightville/backend:latest
sudo docker tag ghcr.io/frankandreas/brightville/frontend:previous ghcr.io/frankandreas/brightville/frontend:latest
sudo docker-compose up -d
```

### Deploying from your computer

```bash
cp .deploy.env.example .deploy.env   # once; then set NAS_HOST and NAS_DIR in it
scripts/deploy-nas.sh
```

It shows how the NAS's `nas-update.sh` differs from the repository's, uploads it after you confirm, and runs the update. Add `--force` to restart even without a new version.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker pull` fails with *denied* or *unauthorized* | A new package on GHCR is private (the first publish of `brightville/backend` and `brightville/frontend`) | On GitHub, **Packages → brightville/backend** (and **/frontend**) **→ Package settings → Change visibility → Public** |
| After logging in at the hub, the game shows a sleeping cloud | The game isn't opened at its `*.local.<domain>` address, so the hub's cookie doesn't reach it (the game goes to the hub at most once in ten minutes, so it can't loop) | Use `https://brightville.local.<domain>` |
| A closed door with "noch nicht freigeschaltet" | The person isn't ticked in the hub tile, or the tile has no app key or a different one | Hub → Einstellungen → Apps → Brightville |
| A sleeping cloud | The backend isn't running, or can't reach the hub | `sudo docker logs brightville-backend` |
| A sleeping cloud, and the backend's log says "Neither HUB_URL nor LOCAL_MODE=1" | `HUB_URL` is missing in `.env` | Set it, then `sudo docker-compose up -d` |
| The backend keeps restarting; its log says "The database ... was made without the family hub" (or "with") | The database in `data/` comes from the other mode: one made while trying the game with `LOCAL_MODE=1`, whose people (numbered from 1) aren't the hub's, so the Stars would go to the wrong person | Move `data/brightville.db` aside and start again with an empty `data/` folder. Only if it holds nothing worth keeping: `sqlite3 data/brightville.db "DELETE FROM settings WHERE key = 'mode'"` |
| Everyone can pick who plays, without a login | `LOCAL_MODE=1` is set | Remove it from `.env` and set `HUB_URL`, then `sudo docker-compose up -d` |
| Paintings in Malen keep showing ⏳ | The painting can't reach the server; a reverse proxy in front may refuse large uploads (nginx inside the container takes up to 10 MB) | `sudo docker logs brightville-frontend`; in DSM's reverse proxy, allow larger requests |
| The Yoga Studio door is grey | The page is open over plain `http://` | Use the HTTPS address |
| No voice on the iPad | The ring switch or volume is off, or no German voice is installed | Turn the sound on; **Settings → Accessibility → Spoken Content → Voices → Deutsch** |
