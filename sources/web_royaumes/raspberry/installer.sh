#!/bin/sh
# Royaumes des Rives — installation sur Raspberry Pi (ou tout Linux avec systemd)
# Le jeu démarre tout seul à l'allumage et reste accessible depuis l'iPad sur le Wi-Fi de la maison.
#   ./raspberry/installer.sh            installe et démarre le service (port 8795)
#   ./raspberry/installer.sh 8800       idem sur un autre port
#   ./raspberry/installer.sh --retirer  arrête et supprime le service
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE=web_royaumes
UNIT=/etc/systemd/system/$SERVICE.service

if [ "$1" = "--retirer" ]; then
  sudo systemctl disable --now "$SERVICE" 2>/dev/null || true
  sudo rm -f "$UNIT"
  sudo systemctl daemon-reload
  echo "Service $SERVICE retiré. Les sauvegardes restent dans $DIR/saves."
  exit 0
fi

PORT="${1:-8795}"
# l'exécutable du jeu, une première fois tout de suite (compilé si cargo est là, sinon téléchargé) :
# une erreur se voit ici plutôt que dans le journal du service
( cd "$DIR" && . ./binaires.sh && obtenir_binaires ) || { echo "Impossible d'obtenir l'exécutable du jeu (voir ci-dessus)."; exit 1; }

sudo tee "$UNIT" > /dev/null <<UNITEOF
[Unit]
Description=Royaumes des Rives, jeu de stratégie (1700-1850)
After=network-online.target
Wants=network-online.target

[Service]
User=$(id -un)
WorkingDirectory=$DIR
ExecStart=/bin/sh $DIR/lancer.sh --lan --port $PORT --no-browser
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE"
# attend que le Wi-Fi ait une adresse (au plus 30 s)
IP=""
for i in $(seq 1 15); do
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "$IP" ] && break
  sleep 2
done
echo ""
echo "Royaumes des Rives tourne sur le Raspberry et démarrera à chaque allumage (sans navigateur)."
echo "Sur l'iPad, un téléphone ou un PC du réseau local, ouvrez :"
[ -n "$IP" ] && echo "    http://$IP:$PORT"
echo "    http://$(hostname).local:$PORT"
echo ""
echo "Ces adresses sont aussi écrites dans $DIR/adresse-reseau.txt"
echo "État du service : sudo systemctl status $SERVICE"
echo "Journal         : journalctl -u $SERVICE -f"
