# Guía de Deploy - Aplicación IoT de Audio

Esta guía te ayudará a desplegar tu aplicación IoT que permite grabar audio desde el navegador y reproducirlo en el parlante del servidor.

## Características

- **Grabación de audio**: Mantén presionado el botón para grabar
- **Reproducción en servidor**: El audio se reproduce en el parlante del servidor Linux
- **Soporte de formatos**: WebM, MP3, WAV, OGG
- **Logs detallados**: Seguimiento completo del proceso de grabación y envío

## Requisitos Previos

1. **Servidor con acceso SSH**
   - Ubuntu/Debian (recomendado) o cualquier distribución Linux
   - Mínimo 1GB RAM, 1 CPU
   - Acceso root o sudo

2. **Software necesario en el servidor:**
   - Docker
   - Docker Compose
   - Git

## Paso 1: Preparar el Servidor

Conéctate a tu servidor por SSH:

```bash
ssh usuario@tu-servidor-ip
```

### Instalar Docker

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Agregar repositorio de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Agregar tu usuario al grupo docker (para no usar sudo)
sudo usermod -aG docker $USER

# Aplicar cambios de grupo (o cierra sesión y vuelve a entrar)
newgrp docker
```

### Instalar Docker Compose

```bash
# Instalar Docker Compose
sudo apt install -y docker-compose-plugin

# Verificar instalación
docker compose version
```

### Instalar Git

```bash
sudo apt install -y git
```

## Paso 2: Clonar el Repositorio

```bash
# Ir al directorio home
cd ~

# Clonar el repositorio
git clone <URL_DE_TU_REPOSITORIO> iot-app

# Entrar al directorio
cd iot-app
```

Si tu repositorio es privado:

```bash
# Primero configura tus credenciales de Git
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Luego clona usando HTTPS o SSH
git clone https://github.com/usuario/repositorio.git iot-app
```

## Paso 3: Configurar el Firewall

Abre el puerto 80 para permitir tráfico HTTP:

```bash
# Si usas UFW (Ubuntu Firewall)
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp  # SSH (importante para no perder acceso)
sudo ufw enable
sudo ufw status

# Si usas iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## Paso 4: Configurar PulseAudio (si usas audio)

Si tu aplicación reproduce audio, necesitas configurar PulseAudio:

```bash
# Verificar tu UID
id -u

# Si tu UID no es 1000, edita docker-compose.yml
# Reemplaza /run/user/1000/ con /run/user/TU_UID/
```

Para editar docker-compose.yml:

```bash
nano docker-compose.yml

# Busca la línea:
# - /run/user/1000/pulse:/run/user/1000/pulse:ro
# Y cámbiala a tu UID si es diferente
```

## Paso 5: Construir y Ejecutar

```bash
# Crear directorio temporal para archivos de audio
mkdir -p temp

# Construir las imágenes
docker compose build

# Iniciar los contenedores en segundo plano
docker compose up -d

# Ver los logs
docker compose logs -f
```

Para detener los logs presiona `Ctrl+C` (los contenedores seguirán corriendo).

## Paso 6: Verificar el Despliegue

```bash
# Ver estado de los contenedores
docker compose ps

# Deberías ver algo como:
# NAME           STATUS    PORTS
# iot-apache2    Up        0.0.0.0:80->80/tcp
# iot-app        Up        3000/tcp

# Verificar que Apache está respondiendo
curl http://localhost

# Ver logs en tiempo real
docker compose logs -f apache2
docker compose logs -f app
```

## Paso 7: Acceder desde el Navegador

Abre tu navegador y ve a:

```
http://TU_IP_DEL_SERVIDOR
```

O si configuraste un dominio:

```
http://tu-dominio.com
```

### Usar la Aplicación

1. **Grabar Audio**:
   - Mantén presionado el botón del micrófono
   - Habla durante al menos 1 segundo
   - Suelta el botón para enviar

2. **Proceso Automático**:
   - El audio se envía al endpoint `/api/audio/play`
   - El servidor lo guarda temporalmente
   - Se reproduce en el parlante del servidor
   - El archivo temporal se elimina automáticamente

3. **Ver Logs**:
   - Abre la consola del navegador (F12) para ver logs detallados
   - Los logs muestran: tamaño del audio, formato, estado del envío, etc.

### Endpoints Disponibles

- `GET /` - Interfaz web de la aplicación
- `POST /api/audio/play` - Recibe y reproduce audio
  - Campo: `audio` (archivo)
  - Formatos: WebM, MP3, WAV, OGG
  - Respuesta: `{ success: true, message: "...", filename: "...", size: ..., mimetype: "..." }`

## Comandos Útiles

### Ver logs

```bash
# Todos los servicios
docker compose logs -f

# Solo Apache
docker compose logs -f apache2

# Solo la aplicación Node.js
docker compose logs -f app

# Últimas 100 líneas
docker compose logs --tail=100
```

### Reiniciar servicios

```bash
# Reiniciar todo
docker compose restart

# Reiniciar solo un servicio
docker compose restart apache2
docker compose restart app
```

### Detener y eliminar

```bash
# Detener contenedores
docker compose stop

# Detener y eliminar contenedores
docker compose down

# Detener, eliminar y limpiar volúmenes
docker compose down -v
```

### Actualizar la aplicación

```bash
# Detener contenedores
docker compose down

# Obtener últimos cambios
git pull

# Reconstruir y reiniciar
docker compose build
docker compose up -d
```

## Solución de Problemas

### El puerto 80 ya está en uso

```bash
# Ver qué está usando el puerto 80
sudo lsof -i :80

# O con netstat
sudo netstat -tulpn | grep :80

# Si es Apache2 u otro servidor web, detenerlo
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### Los contenedores no inician

```bash
# Ver logs detallados
docker compose logs

# Ver recursos del sistema
docker stats

# Verificar permisos de archivos
ls -la apache2/
```

### No puedo acceder desde el navegador

1. Verifica que el firewall permita el puerto 80
2. Verifica que los contenedores estén corriendo: `docker compose ps`
3. Verifica los logs: `docker compose logs`
4. Prueba desde el servidor: `curl http://localhost`
5. Verifica la IP pública de tu servidor

### Error de permisos en PulseAudio

```bash
# Verificar que el directorio existe
ls -la /run/user/$(id -u)/pulse

# Si no existe, PulseAudio no está corriendo
pulseaudio --start

# Verificar permisos
sudo chown -R $USER:$USER /run/user/$(id -u)/pulse
```

## Configuración de Dominio (Opcional)

Si tienes un dominio, apúntalo a la IP de tu servidor:

1. Ve al panel de tu proveedor de dominios
2. Crea un registro A que apunte a la IP de tu servidor:
   ```
   Tipo: A
   Nombre: @ (o www)
   Valor: TU_IP_DEL_SERVIDOR
   TTL: 3600
   ```
3. Espera unos minutos a que se propague el DNS
4. Accede a `http://tu-dominio.com`

## Monitoreo

### Ver uso de recursos

```bash
# Uso de CPU y memoria en tiempo real
docker stats

# Espacio en disco
df -h

# Logs del sistema
sudo journalctl -f
```

### Configurar reinicio automático

Los contenedores ya están configurados con `restart: unless-stopped`, por lo que:

- Se reiniciarán automáticamente si fallan
- Se iniciarán automáticamente al reiniciar el servidor
- No se reiniciarán si los detienes manualmente con `docker compose stop`

## Backup

### Hacer backup del código

```bash
# Desde el servidor
cd ~/iot-app
git add .
git commit -m "Backup $(date)"
git push
```

### Hacer backup de archivos temporales (si es necesario)

```bash
# Copiar directorio temp
tar -czf backup-temp-$(date +%Y%m%d).tar.gz temp/

# Descargar a tu máquina local
scp usuario@servidor:~/iot-app/backup-temp-*.tar.gz .
```

## Actualizaciones de Seguridad

Mantén tu servidor actualizado:

```bash
# Actualizar paquetes del sistema
sudo apt update && sudo apt upgrade -y

# Actualizar imágenes de Docker
docker compose pull
docker compose up -d
```

## Notas de Producción

1. **Sin SSL**: Esta configuración usa HTTP sin cifrado. Para producción con datos sensibles, considera agregar SSL con Let's Encrypt o usar un proxy inverso como Cloudflare.

2. **Recursos**: Monitorea el uso de recursos con `docker stats` y ajusta si es necesario.

3. **Logs**: Los logs se escriben en la salida estándar y pueden ser grandes. Considera usar log rotation.

4. **Seguridad**:
   - Mantén Docker y el sistema actualizado
   - No expongas el puerto 3000 directamente
   - Usa firewall para limitar acceso
   - Considera usar fail2ban para proteger SSH

5. **Base de datos**: Si agregas una base de datos en el futuro, asegúrate de hacer backups regulares.

## Contacto y Soporte

Si tienes problemas, revisa:
1. Los logs: `docker compose logs`
2. El estado de los contenedores: `docker compose ps`
3. Los recursos del sistema: `docker stats`
4. La conectividad de red: `curl http://localhost`
