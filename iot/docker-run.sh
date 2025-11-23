#!/bin/bash

# Script helper para ejecutar la aplicación en Docker

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== IoT App - Docker Helper ===${NC}\n"

# Obtener UID del usuario actual
CURRENT_UID=$(id -u)
echo -e "${YELLOW}Tu UID: ${CURRENT_UID}${NC}\n"

# Verificar si PulseAudio está ejecutándose
if [ ! -S "/run/user/${CURRENT_UID}/pulse/native" ]; then
    echo -e "${YELLOW}⚠️  PulseAudio no parece estar ejecutándose o el socket no existe.${NC}"
    echo -e "${YELLOW}   Ejecuta: pulseaudio --start${NC}\n"
fi

# Función para actualizar docker-compose.yml con el UID correcto
update_docker_compose() {
    echo -e "${GREEN}Actualizando docker-compose.yml con tu UID...${NC}"
    # Actualizar el UID en los volúmenes
    sed -i "s|/run/user/1000|/run/user/${CURRENT_UID}|g" docker-compose.yml
    sed -i "s|user/1000|user/${CURRENT_UID}|g" docker-compose.yml
    echo -e "${GREEN}✓ docker-compose.yml actualizado${NC}\n"
}

# Verificar si ya está actualizado
if grep -q "/run/user/${CURRENT_UID}/pulse" docker-compose.yml 2>/dev/null; then
    echo -e "${GREEN}✓ docker-compose.yml ya está configurado para tu UID${NC}\n"
else
    # Hacer backup y actualizar
    cp docker-compose.yml docker-compose.yml.bak 2>/dev/null || true
    update_docker_compose
fi

# Menu de opciones
case "${1:-build}" in
    build)
        echo -e "${GREEN}Construyendo imagen Docker...${NC}\n"
        docker compose build
        echo -e "\n${GREEN}✓ Construcción completada${NC}\n"
        echo -e "Ejecuta: ${YELLOW}./docker-run.sh up${NC} para iniciar el contenedor"
        ;;
    up|start)
        echo -e "${GREEN}Iniciando contenedor...${NC}\n"
        docker compose up -d
        echo -e "\n${GREEN}✓ Contenedor iniciado${NC}"
        echo -e "La aplicación está disponible en: ${YELLOW}http://localhost:3000${NC}\n"
        echo -e "Ver logs: ${YELLOW}docker compose logs -f${NC}"
        ;;
    down|stop)
        echo -e "${GREEN}Deteniendo contenedor...${NC}\n"
        docker compose down
        echo -e "${GREEN}✓ Contenedor detenido${NC}\n"
        ;;
    logs)
        echo -e "${GREEN}Mostrando logs...${NC}\n"
        docker compose logs -f
        ;;
    restart)
        echo -e "${GREEN}Reiniciando contenedor...${NC}\n"
        docker compose restart
        echo -e "${GREEN}✓ Contenedor reiniciado${NC}\n"
        ;;
    shell|bash)
        echo -e "${GREEN}Abriendo shell en el contenedor...${NC}\n"
        docker compose exec app /bin/bash || docker compose exec app /bin/sh
        ;;
    *)
        echo -e "Uso: $0 [comando]"
        echo -e "\nComandos disponibles:"
        echo -e "  ${GREEN}build${NC}    - Construir la imagen Docker (por defecto)"
        echo -e "  ${GREEN}up${NC}       - Iniciar el contenedor"
        echo -e "  ${GREEN}down${NC}     - Detener el contenedor"
        echo -e "  ${GREEN}logs${NC}     - Ver logs del contenedor"
        echo -e "  ${GREEN}restart${NC}  - Reiniciar el contenedor"
        echo -e "  ${GREEN}shell${NC}    - Abrir shell en el contenedor"
        ;;
esac

