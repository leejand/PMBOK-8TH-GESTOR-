# Despliegue en línea (VPS)

Guía para publicar el Gestor en una URL como `https://pmbok8.midominio.com`, de modo que cada
compañero cree su cuenta, forme su equipo y trabaje sobre la misma base de datos.

**Arquitectura:** un VPS Linux (Ubuntu 24.04) con Node.js 20+, PostgreSQL 16 o superior solo en
`localhost` y **Caddy** delante, que pone el HTTPS y reenvía a la app en `127.0.0.1:3000`.
La interfaz y la API viven en el mismo origen, así que no hay que tocar CORS.

> PaaS con PostgreSQL gestionado (Render, Railway, Supabase): **no recomendado** con prisa. El
> migrador crea la base y el rol `pmbok8_app` con un superusuario (`db/migrar.js`), y esos
> servicios no suelen darlo.

---

## 1. Servidor

```bash
# Node.js 20 y PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql git

# Contraseña del superusuario de PostgreSQL (la usa solo el migrador)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'CAMBIA-ESTA-CLAVE-LARGA';"

# Usuario del sistema sin privilegios para la app
sudo useradd --system --create-home --home-dir /opt/pmbok8 pmbok8
sudo -u pmbok8 git clone -b develop https://github.com/leejand/PMBOK-8TH-GESTOR-.git /opt/pmbok8/app
cd /opt/pmbok8/app/backend && sudo -u pmbok8 npm ci --omit=dev
```

## 2. `backend/.env`

```ini
NODE_ENV=production
PORT=3000
HOST=127.0.0.1                 # solo Caddy habla con la app
TRUST_PROXY=1                  # IP real del visitante para los límites de acceso y registro

PGHOST=localhost
PGPORT=5432
PGDATABASE=pmbok8
PGUSER=pmbok8_app              # lo crea el migrador
PGPASSWORD=<aleatoria-larga>
PGADMIN_USER=postgres
PGADMIN_PASSWORD="<la del paso 1>"

JWT_SECRETO=<64+ caracteres fijos>   # obligatorio en producción: sin él la app no arranca
JWT_EXPIRA_HORAS=12

ADMIN_CORREO=profesor@midominio.com
ADMIN_CLAVE=<distinta-de-admin123>

REGISTRO_ABIERTO=true
REGISTRO_ROL=director          # cada compañero puede crear su proyecto y formar su equipo
```

Genera los secretos con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Protege el archivo: `sudo chown pmbok8 backend/.env && sudo chmod 600 backend/.env`.

## 3. Proceso permanente (systemd)

`/etc/systemd/system/pmbok8.service`:

```ini
[Unit]
Description=Gestor PMBOK 8
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=pmbok8
WorkingDirectory=/opt/pmbok8/app/backend
ExecStart=/usr/bin/node src/servidor.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pmbok8
journalctl -u pmbok8 -f      # debe decir: migraciones aplicadas, catálogo 40/42, escuchando
```

Al primer arranque crea la base, aplica las migraciones (`001`, `002`, `003`), carga el catálogo y
crea el administrador de `ADMIN_CORREO`.

## 4. HTTPS con Caddy

```bash
sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```
pmbok8.midominio.com {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

El DNS del dominio debe apuntar (registro A) a la IP del VPS; Caddy obtiene el certificado solo.
Abre solo los puertos 80 y 443: `sudo ufw allow 22,80,443/tcp && sudo ufw enable`.

## 5. Verificación

```bash
curl -s https://pmbok8.midominio.com/api/salud
# { "ok": true, "bd": "conectada", "catalogo": { "procesos": 40, "artefactos": 42 }, "registroAbierto": true, "registroRol": "director", ... }

cd /opt/pmbok8/app/backend
HUMO_ADMIN_CORREO=profesor@midominio.com HUMO_ADMIN_CLAVE='<clave>' \
  npm run humo -- https://pmbok8.midominio.com --limpiar
```

`npm run humo` registra a una líder y a dos compañeros, crea un proyecto, los añade, guarda el acta
con uno, la lee con otro y con una sesión nueva, comprueba que un miembro no toca la configuración
del líder y, con `--limpiar`, borra todo lo que creó.

Después, en el navegador: **Crear cuenta** → Panel → **Nuevo proyecto** → **Equipo → Añadir
compañero por correo** → salir, entrar como el compañero, guardar un documento y recargar.

## 6. Antes de compartir la URL

1. Entra como administrador y **cambia su contraseña** (la app la pide si sigue siendo la inicial).
2. Si hiciste pruebas y quieres empezar vacío: `sudo -u pmbok8 npm run db:reiniciar` con el servicio
   parado (`sudo systemctl stop pmbok8`). **Borra todos los datos.**
3. `GET /api/salud` → `primerUso` debe ser `false` tras cambiar la clave del administrador.

## Copias de seguridad

Este backend no hace copias automáticas. Programa una con `cron`:

```bash
# /etc/cron.d/pmbok8-copias  — cada noche a las 2:00, guarda 14 días
0 2 * * * postgres pg_dump -Fc pmbok8 > /var/backups/pmbok8-$(date +\%F).dump && find /var/backups -name 'pmbok8-*.dump' -mtime +14 -delete
```

Restaurar: `sudo -u postgres pg_restore -d pmbok8 --clean /var/backups/pmbok8-AAAA-MM-DD.dump`.

## Actualizar

```bash
cd /opt/pmbok8/app && sudo -u pmbok8 git pull
cd backend && sudo -u pmbok8 npm ci --omit=dev
sudo systemctl restart pmbok8     # aplica las migraciones nuevas al arrancar
```
