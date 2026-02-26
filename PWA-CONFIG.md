# PWA Configuration - Somma Dashboard v2.1.18

> Progressive Web App (PWA) completo para o Sistema Somma de Gestão

## Sumário Executivo

O Somma Dashboard agora é um PWA totalmente funcional, permitindo:
- ✅ Instalação como app nativo em iOS/Android/Desktop
- ✅ Funcionamento offline com cache inteligente
- ✅ Sincronização automática quando reconecta
- ✅ Atualizações automáticas sem perder dados
- ✅ Barra de status customizada (tema laranja #f97316)

---

## 📦 Arquivos Configurados

### 1. **manifest.json** (`/public/manifest.json`)
Define os metadados da PWA para instalação.

```json
{
  "name": "Somma Dashboard",
  "short_name": "Somma",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#f97316",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "purpose": "any maskable" }
  ]
}
```

**Detalhes:**
- `display: "standalone"` → App roda em modo full-screen (sem barra de URL do navegador)
- `theme_color: "#f97316"` → Barra de status laranja no mobile
- Icons com `purpose: "maskable"` → Suportam safe area em Android dinâmico

---

### 2. **Service Worker** (`/public/sw.js`)
Estratégia **Network First** com fallback para cache.

**Comportamento:**
- **Recursos estáticos (JS, CSS, imgs):** Tenta rede, cai em cache se offline
- **API requests (*/api/*):** Sempre vai para rede, sem cache
- **Navegação:** Fallback para `/` se offline

**Atualização automática:**
```javascript
// Verifica novo SW a cada minuto
setInterval(() => {
  reg.update()
}, 60000)
```

Quando há update, mostra banner laranja com opção de recarregar.

---

### 3. **Meta Tags & Viewport** (`app/layout.tsx`)

```html
<!-- Instalação em Home Screen iOS -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Somma" />
<meta name="apple-touch-icon" href="/icon-192.png" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

<!-- Cor do tema -->
<meta name="theme-color" content="#f97316" />

<!-- Viewport: sem zoom, cover safe area -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

---

### 4. **CSS Mobile Optimizations** (`app/globals.css`)

```css
/* Sem tap highlight em botões */
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}

/* Contém scroll sem propagar para parent */
body {
  overscroll-behavior-y: contain;
}

/* Inputs não zoomam em iOS (min 16px) */
input[type="text"], textarea {
  font-size: 16px;
}

/* Touch actions otimizado */
input, button, textarea, select {
  touch-action: manipulation;
}
```

---

## 🔄 Componentes PWA

### 1. **PWAUpdateNotifier** (`components/pwa-update-notifier.tsx`)
Banner orange no bottom-right quando há atualização.

```tsx
<PWAUpdateNotifier />
```

- Detecta novo SW via `updatefound` event
- Mostra notificação com botão "Atualizar"
- Ao clicar, recarrega page com novo cache

### 2. **OfflineBanner** (`hooks/use-online-status.tsx`)
Banner vermelho no topo quando offline.

```tsx
<OfflineBanner />
```

- Monitora `online` / `offline` events
- Mostra apenas quando `navigator.onLine === false`
- Esconde automaticamente ao reconectar

---

## 🚀 Como Instalar

### **Mobile (Android)**
1. Abrir app no Chrome
2. Menu (⋮) → "Instalar app" ou "Adicionar a tela inicial"
3. Aparece icon "S" laranja na home screen
4. Funciona offline após 1ª visita

### **Mobile (iOS)**
1. Abrir Safari
2. Compartilhar (↗) → "Adicionar à Tela Inicial"
3. Nomeia "Somma"
4. Aparece icon na home — funciona como app nativo

### **Desktop (Chrome/Edge)**
1. Click no ícone "Instalar" (canto superior direito)
2. Cria atalho na desktop
3. Funciona offline com cache
4. Pode receber notificações (com permissão)

---

## 📊 Estratégia de Cache

| Recurso | Estratégia | TTL |
|---------|-----------|-----|
| HTML, JS, CSS | Network First | Indefinido (atualiza via SW) |
| Imagens | Network First | Cache enquanto disponível |
| API `/api/*` | Always Network | Sem cache |
| Falha de rede | Fallback para `/` | Offline message |

---

## 🔐 Dados Offline

**O que funciona offline:**
- ✅ Navegação entre módulos
- ✅ Visualização de dados em cache
- ✅ UI inteira carrega (já foi visitada)

**O que NÃO funciona offline:**
- ❌ Buscar novos dados da API
- ❌ Criar/editar registros
- ❌ Sincronizar com Supabase/Asaas

**Experiência:** Banner vermelho avisa que está offline. Ao reconectar, recarrega dados automático.

---

## 🔄 Verificação de Atualizações

**Automático a cada 60 segundos:**
```javascript
navigator.serviceWorker.ready.then(reg => {
  setInterval(() => {
    reg.update()
      .then(() => console.log('[PWA] Checked for updates'))
  }, 60000)
})
```

**Manual:** Botão refresh (↻) no header envia `location.reload()`

---

## 🎯 Ícones PWA

Grados em `/public/`:
- `icon-192.png` — Tela inicial mobile
- `icon-512.png` — Splash screen + Android
- Design: Orange (#f97316) + preto (#0a0a0a)
- Formato: PNG com transparência (maskable)

---

## 📈 Monitoramento

**Console logs PWA:**
```javascript
[PWA] Service Worker registered: /
[PWA] Checked for updates
[PWA] Connection restored
[PWA] Connection lost
```

**DevTools:**
- Chrome: F12 → Application → Service Workers
- Chrome: F12 → Application → Cache Storage (somma-v2.1.18)
- Chrome: F12 → Application → Manifest

---

## ⚙️ Configuração de Variáveis

Nenhuma variável de ambiente extra necessária — PWA usa arquivos públicos.

**Se usar notificações push (futuro):**
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## 🚨 Troubleshooting

### App não aparece para instalar
- ✅ Verificar manifest.json está em `/public/`
- ✅ Verificar `display: "standalone"`
- ✅ Verificar HTTPS (PWA requer HTTPS em produção)

### Offline banner sempre aparece
- ✅ Verificar conexão de internet
- ✅ Abrir DevTools → Network → throttle para "Offline"
- ✅ Recarregar: Ctrl+Shift+R (hard refresh)

### Atualização não aparece
- ✅ Abrir DevTools → Application → Service Workers
- ✅ Clicar "Skip waiting" se houver novo SW
- ✅ Recarregar página

### Cache muito grande
- ✅ Usar DevTools → Application → Cache Storage
- ✅ Right-click → Delete cache `somma-v2.1.18`
- ✅ Recarregar (vai baixar tudo de novo)

---

## 📝 Changelog PWA

### v2.1.18
- ✅ Manifest.json completo com screenshots
- ✅ Service Worker com Network First strategy
- ✅ PWAUpdateNotifier com UI orange
- ✅ OfflineBanner com hook useOnlineStatus
- ✅ Ícones 192x512 gerados automaticamente
- ✅ Verificação automática de updates a cada 60s
- ✅ CSS mobile otimizado (sem zoom, touch actions)
- ✅ Meta tags PWA completas

---

## 🔗 Referências

- [MDN - Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

**Última atualização:** 2026-02-26  
**Versão:** 2.1.18  
**Status:** ✅ Production Ready
