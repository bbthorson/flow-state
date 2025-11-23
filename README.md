# **Flow State 🌊**

**The Programmable Web Layer for Your Physical World.**

Flow State is a privacy-first, local-only **Progressive Web App (PWA)** that turns your device's state into triggers for automation. Think of it as the "Brain" for your device's automation, bridging the gap between raw sensors and complex web workflows.

## **🚀 Core Philosophy**

1. **Local-First:** Your data never leaves your device unless you explicitly send it.  
2. **Web Native:** Built on standard Web APIs. No app store downloads required.  
3. **Asymmetric Design:** We use the best tools available on each platform.  
   * **Android:** We use native Web APIs (Battery, Network) directly.  
   * **iOS:** We integrate with **Apple Shortcuts** to handle sensors we can't access, acting as the logic engine.

## **⚡ Capabilities**

### **Triggers**

* **🔋 Power:** Battery level drops, charging starts/stops.  
* **📡 Network:** Switch from Wifi to Cellular, go offline.  
* **📍 Geolocation:** Enter or exit a specific area.  
* **🔗 Share Target:** Trigger flows by sharing text/URLs from other apps.  
* **⚡ External Webhook:** Trigger flows from Apple Shortcuts or other local apps.

### **Actions**

* **Webhooks:** Send JSON payloads to Home Assistant, Zapier, or your own API.  
* **Notifications:** Local push alerts.  
* **Device:** Vibrate, play sounds, or copy to clipboard.

## **🍎 The "Shortcuts Store" (iOS)**

Since iOS restricts browser access to battery and background location, Flow State features a built-in **Integration Marketplace**. You can one-tap install Apple Shortcuts that feed data into Flow State, letting you use Flow State's superior logic and logging engine with iOS's native sensors.

## **🛠️ Technology Stack**

* **Framework:** Next.js 15 (App Router)  
* **State Management:** Zustand (Persisted to localStorage \+ File System Backup)  
* **Styling:** Tailwind CSS  
* **PWA:** Custom Service Worker for offline support.

## **🏃‍♂️ Getting Started**

1. Clone the repo:  
   git clone \[https://github.com/yourusername/flow-state.git\](https://github.com/yourusername/flow-state.git)

2. Install dependencies:  
   npm install

3. Run the development server:  
   npm run dev

## **📜 License**

MIT