# ☁️ Claude Usage Bar

Extensión para **VS Code y Cursor** que muestra en tiempo real cuánto límite de uso llevas en [claude.ai](https://claude.ai) — directamente en la barra de estado.

![status bar preview](https://i.imgur.com/placeholder.png)

```
☁ 95% · 25%
```

| Número | Qué significa |
|--------|--------------|
| Primero | Ventana de **5 horas** |
| Segundo | Ventana de **7 días** |

Al hacer hover sobre el indicador ves la tabla completa con el tiempo exacto para que se resetee cada ventana.

---

## ✅ Requisitos

- VS Code 1.80+ **o** Cursor
- [Node.js](https://nodejs.org) instalado (cualquier versión reciente)
- Cuenta activa en [claude.ai](https://claude.ai) (Free, Pro o Team)

---

## 🚀 Instalación

### 1. Descarga el `.vsix`

Ve a [Releases](../../releases) y descarga el archivo `claude-usage-bar-x.x.x.vsix`.

### 2. Instala la extensión

En VS Code o Cursor:

```
Ctrl+Shift+P → Extensions: Install from VSIX...
```

Selecciona el archivo descargado.

> ⏳ **La primera vez** la extensión instala Playwright + Chromium automáticamente (~150 MB). Solo ocurre una vez y tarda ~2 minutos. Verás `☁ Claude: instalando (1 vez, ~2 min)…` en la barra.

### 3. Obtén tu Session Key

1. Abre [claude.ai](https://claude.ai) en tu navegador con sesión activa
2. Abre DevTools con `F12`
3. Ve a **Application** → **Cookies** → `https://claude.ai`
4. Copia el valor de la cookie llamada `sessionKey`

### 4. Configura la extensión

Abre el JSON de configuración:

```
Ctrl+Shift+P → Open User Settings (JSON)
```

Agrega esta línea (con coma en la línea anterior si no es la última):

```json
"claudeUsage.cookies": "sessionKey=sk-ant-XXXXXX..."
```

Guarda. En ~15 segundos verás los porcentajes en la barra de estado.

---

## 🔄 Actualizar la Session Key

La `sessionKey` es válida mientras tengas sesión activa en claude.ai. Si expira, verás un error rojo — solo repite el paso 3 y 4 con el valor nuevo.

---

## 🖥️ Compatibilidad

| Sistema | ✅ |
|---------|---|
| Windows | ✓ |
| macOS   | ✓ |
| Linux   | ✓ |

---

## ⚠️ Aviso

Esta extensión usa la API interna de claude.ai (no oficial). Anthropic podría cambiarla en cualquier momento. Úsala bajo tu propio criterio.

---

Hecho con ☁️ + [Claude Code](https://claude.ai/code)
"# claude-usage-bar" 
"# claude-usage-bar" 
