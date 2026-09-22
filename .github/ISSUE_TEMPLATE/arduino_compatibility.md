---
name: "🔌 Compatibilidad Hardware & Arduino (Hardware Compatibility)"
about: "Reporta problemas de compatibilidad de esquemas, lectura/escritura en SD o comunicación con microcontroladores"
title: "[HARDWARE/COMPATIBILITY]: "
labels: ["hardware", "arduino", "compatibility"]
assignees: []
---

### 📋 Resumen del Problema de Compatibilidad
Describe brevemente qué tipo de incompatibilidad o problema de lectura/escritura ocurre entre la librería Arduino y el software MicroDB Studio.

---

### 🔧 Especificaciones del Hardware
- **Microcontrolador / Placa:** (ej. ESP32-WROOM-32, Arduino Uno R3, Arduino Mega 2560, Raspberry Pi Pico RP2040)
- **Frecuencia de reloj / Core:** (ej. ESP32 Arduino Core v2.0.14)
- **Librería SD Utilizada:** (ej. `SD.h` estándar, `SdFat.h`, `LittleFS`, `SPIFFS`)
- **Pines SPI Utilizados:** (CS: Pin X, MOSI: Pin Y, MISO: Pin Z, SCK: Pin W)
- **Tarjeta MicroSD:** Marca, capacidad y formato de sistema de archivos (debe ser FAT16/FAT32).

---

### 🧬 Definición del Struct C++ y Esquema JSON
Por favor, incluye la estructura exacta utilizada en el sketch de Arduino y el archivo `.jsn` generado (si existe):

```cpp
struct MiTabla {
    uint32_t id;
    char nombre[32];
    float valor;
};
```

---

### 🔍 Síntomas Observados
- [ ] La tabla `.tbl` no es detectada por el software.
- [ ] Los valores leídos en MicroDB Studio difieren de lo escrito por Arduino (offset/longitud).
- [ ] Error al insertar/actualizar registros desde MicroDB Studio y leerlos luego desde Arduino.
- [ ] Problemas con tipos específicos (`BOOL`, `STRING`, `BLOB`, `FLOAT`).
- [ ] Error con Claves Foráneas o Claves Únicas.

---

### 📜 Salida del Monitor Serial / Consola
Pega aquí los mensajes impresos en el Monitor Serial de Arduino IDE:

```text
// Logs del Serial Monitor
```
