# **Flow State v2.0: System Blueprint**

## **1\. Product Identity**

Flow State is a privacy-first, local-only Automation Engine for the mobile web.  
It solves the "Air Gap" between physical device state (Battery, Location) and web-based workflows (APIs, Webhooks) by acting as a Logic Layer.

## **2\. The "Asymmetric" Architecture**

Unlike traditional PWAs that try (and fail) to act native on iOS, Flow State adopts a split strategy:

### **Android / Desktop (The Observer)**

* **Role:** Active Monitor.  
* **Mechanism:** Uses Project Fugu APIs (navigator.getBattery, navigator.connection) to poll device state directly.  
* **Background:** Leverages Service Workers and Periodic Sync to trigger automations.

### **iOS (The Handler)**

* **Role:** Passive Logic Engine.  
* **Mechanism:** Rely on **Apple Shortcuts** to be the "Sensor."  
* **Bridge:** Shortcuts trigger Flow State via **Deep Links** (https://flowstate.app/?trigger=...).  
* **UX:** The app opens visibly, processes the logic, logs the result, and provides feedback.

## **3\. Core Components**

### **A. The Flow Engine (State Management)**

* **Store:** Zustand (persisted to localStorage).  
* **Data Structure:**  
  * **Flow:** A rule consisting of a Trigger and an Action.  
  * **Log:** An immutable history entry of a Flow execution.  
* **Persistence Strategy:**  
  * **"The Vault":** Manual JSON export to the native file system to survive iOS 7-day storage eviction.

### **B. The "Integration Marketplace" (Library)**

* A curated list of external triggers (Apple Shortcuts) that users can install.  
* Acts as the "Plugin System" for the app, allowing it to gain capabilities (like Geofencing) that the browser lacks.

### **C. The Router (Deep Link Handler)**

* A useEffect hook on the main dashboard that parses window.location.search.  
* **Security:** Verifies an optional secret key to prevent unauthorized web triggering.  
* **Action:** Matches the URL parameters to a configured **Flow**, executes it, and scrubs the URL.

## **4\. User Interface (Thumb-Zone First)**

* **Navigation:** Fixed Bottom Bar (Flows, History, Library).  
* **Header:** Sync Status & Settings (Sheet).  
* **Visual Style:** Clean, utility-focused, "Command Center" aesthetic.

## **5\. Tech Stack**

* **Framework:** Next.js 15 (App Router).  
* **Styling:** Tailwind CSS \+ Shadcn UI.  
* **Icons:** Lucide React.  
* **PWA:** Custom Service Worker for offline capability.