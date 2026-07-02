# Minería de Datos - Editor 3D y App

Este repositorio contiene el código fuente de la aplicación Ionic Angular con el diseño del visor/editor 3D y los modales integrados.

## 🚀 Pasos para instalar y ejecutar el proyecto

Dado que las dependencias (`node_modules`) han sido excluidas para mantener el repositorio ligero, debes seguir estos pasos para poder ejecutar el código en tu computadora:

### 1. Requisitos Previos
Asegúrate de tener instalados los siguientes programas en tu computadora:
- [Node.js](https://nodejs.org/) (recomendada la versión LTS)
- [Git](https://git-scm.com/)

### 2. Clonar el Repositorio
Abre tu terminal (Símbolo del sistema, PowerShell o Git Bash) y ejecuta:
```bash
git clone https://github.com/Fernandcx/Mineria_de_Datos.git
cd Mineria_de_Datos
```

### 3. Instalar Dependencias
Una vez dentro de la carpeta del proyecto, instala todas las librerías de Angular, Ionic y Capacitor ejecutando el siguiente comando:
```bash
npm install
```
*(Nota: Esto creará automáticamente la carpeta `node_modules/` que contiene todo el código de terceros)*

### 4. Ejecutar en el Navegador (Modo de Desarrollo)
Para ver la aplicación corriendo localmente en tu navegador web, usa el siguiente comando:
```bash
ionic serve
```
*(Si no tienes Ionic instalado de forma global, puedes instalarlo ejecutando `npm install -g @ionic/cli`)*

### 5. Compilar para Android Studio
Si deseas construir el APK o probar la aplicación en tu celular/emulador mediante Android Studio:

1. **Construye el proyecto web:**
   ```bash
   npm run build
   ```
2. **Sincroniza los archivos web al proyecto nativo de Android:**
   ```bash
   npx cap sync android
   ```
3. **Abre Android Studio automáticamente:**
   ```bash
   npx cap open android
   ```
   *Una vez que Android Studio termine de cargar y sincronizar Gradle, simplemente presiona el botón "Run" (▶️) para compilar e instalar en tu dispositivo.*

### 6. Uso del Módulo de Realidad Aumentada (AR Simulado)
Nuestra aplicación utiliza **AR Simulado Matemáticamente** a través del giroscopio del celular, ya que WebXR no está soportado nativamente en WebViews compilados con Capacitor. 

Para que la malla se dibuje correctamente en el suelo de tu habitación, sigue estas reglas de uso:
1. Asegúrate de dar **permisos de cámara** cuando la aplicación lo solicite (esto lo gestiona `@capacitor/camera`).
2. Sostén el celular a la altura de tu pecho (aproximadamente 1.5 metros del suelo).
3. **No camines** por la habitación. Funciona como un tripié: quédate en un punto fijo y **solamente gira sobre tu propio eje** para apuntar el retículo blanco hacia las distintas esquinas del suelo.
4. Presiona el botón "Añadir Pared" en cada esquina. Al colocar un mínimo de **3 puntos**, la malla de color negro se dibujará automáticamente en el suelo de tu cámara.
