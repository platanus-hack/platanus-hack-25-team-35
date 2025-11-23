"""
Cliente Python para Voice Agent - ElderlyCare Platform
Reemplaza las funciones locales de memoria.json con llamadas al servidor
"""

import requests
import os
from typing import List, Dict, Optional

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8080")

def guardar_memoria(texto_original, items):
    """
    Reemplaza guardar_memoria() local
    
    Args:
        texto_original: Texto transcrito del audio
        items: Lista de items procesados (Eventos/Recuerdos)
    
    Returns:
        dict con success, ids, count
    """
    try:
        response = requests.post(
            f"{SERVER_URL}/api/agent/memory",
            json={
                "texto_original": texto_original,
                "items": items
            },
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error guardando memoria: {e}")
        return {"success": False, "error": str(e)}


def cargar_memoria(limit=30, tipo=None):
    """
    Reemplaza cargar_memoria() local
    
    Args:
        limit: Número máximo de items a recuperar
        tipo: Filtrar por tipo ("Evento", "Recuerdo", "Ninguno")
    
    Returns:
        Lista de items de memoria
    """
    try:
        params = {"limit": limit}
        if tipo:
            params["tipo"] = tipo
        
        response = requests.get(
            f"{SERVER_URL}/api/agent/memory",
            params=params,
            timeout=10
       )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error cargando memoria: {e}")
        return []


def agregar_items_a_memoria(items, texto_original):
    """
    Wrapper más compatible con el código existente
    """
    return guardar_memoria(texto_original, items)


# Ejemplo de uso con las funciones del notebook
if __name__ == "__main__":
    # Simular resultado de procesar_memoria_con_chatgpt()
    texto = "Necesito comprar pan y tengo cita con el médico el lunes"
    items = [
        {
            "tipo": "Recuerdo",
            "fecha": None,
            "hora": None,
            "descripcion": "Comprar pan",
            "clasificacion": "compra",
            "responsable_requerido": "Si",
            "personas": [],
            "lugar": None
        },
        {
            "tipo": "Evento",
            "fecha": "lunes próximo",
            "hora": None,
            "descripcion": "Cita con el médico",
            "clasificacion": None,
            "responsable_requerido": None,
            "personas": ["Dr. García"],
            "lugar": None
        }
    ]
    
    # Guardar
    print("Guardando memoria...")
    result = guardar_memoria(texto, items)
    print(f"Resultado: {result}")
    
    # Cargar
    print("\nCargando memoria...")
    memoria = cargar_memoria(limit=10)
    print(f"Total items: {len(memoria)}")
    for item in memoria[:3]:  # Mostrar primeros 3
        print(f"  - {item['tipo']}: {item['descripcion']}")
