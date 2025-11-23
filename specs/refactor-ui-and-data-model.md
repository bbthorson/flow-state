# **Flow State v2.0: Implementation Specification**

## **1\. Executive Summary & Architecture**

**Goal:** Refactor "Flow State" into a PWA Automation Engine that uses **Deep Links** as the primary bridge for external triggers on iOS.

**Core Strategy:**

* **Android:** Native Observers (Battery API) \+ Deep Links.  
* **iOS:** Deep Links Only. Apple Shortcuts "Open URL" is the sensor.

## **2\. Data Model (State Management)**

### **New Store Schema (src/store/useAppStore.ts)**

export type TriggerType \= 'NATIVE\_BATTERY' | 'DEEP\_LINK' | 'MANUAL';  
export type ActionType \= 'WEBHOOK' | 'NOTIFICATION' | 'LOG';

export interface Flow {  
  id: string;  
  name: string;  
  enabled: boolean;  
  securityKey?: string; // For Deep Links verification  
  trigger: {  
    type: TriggerType;  
    // For DEEP\_LINK: { param: "event", value: "left\_work" }  
    // URL would look like: /?event=left\_work  
    details: Record\<string, any\>;   
  };  
  actions: Array\<{  
    type: ActionType;  
    details: Record\<string, any\>;  
  }\>;  
}

export interface LogEntry {  
  id: string;  
  flowId: string; // or 'SYSTEM'  
  timestamp: number;  
  status: 'success' | 'failure';  
  message: string;  
}

// Store Actions:  
// \- processDeepLink(params: URLSearchParams): void  
// \- exportVault(): string (JSON dump)

## **3\. UI/UX Specification**

### **A. URL Handler (The Invisible Component)**

* **Location:** src/app/page.tsx (inside useEffect).  
* **Logic:**  
  1. Parse window.location.search.  
  2. If params match a Flow Trigger, execute the Action.  
  3. Add entry to History.  
  4. Use window.history.replaceState to clean the URL so the trigger doesn't fire again on reload.

### **B. Dashboard Layout (src/app/page.tsx)**

* **Header:**  
  * **Sync Status Icon:** Green (Safe), Yellow (Backup Needed), Red (Danger).  
  * **Settings:** Sheet for "Vault" export.  
* **Tabs:**  
  * **Flows:** Active rules.  
  * **History:** The visible log of execution.  
  * **Library:** iOS Shortcut download links.

### **C. The "Vault" (Backup System)**

* Located in Settings Sheet.  
* Button: "Download Backup (.json)".  
* Logic: Update lastBackupTimestamp in store on click.

## **4\. Implementation Steps for Coding Assistant**

### **Step 1: Refactor Store**

* Implement Flow type with DEEP\_LINK support.  
* Create processDeepLink action in the store that iterates through flows and checks matches.

### **Step 2: Implement The "Vault"**

* Add exportVault function that returns JSON.stringify(state).  
* Add importVault function.

### **Step 3: Build Dashboard & Router**

* Implement page.tsx with the Tabbed layout.  
* **Crucial:** Add the useEffect hook to handle URL parameters on mount.

### **Step 4: Mock The Library**

* Create dummy "Install Shortcut" cards that point to https://www.icloud.com/shortcuts/... (use placeholders for now).

## **5\. Reference Code (URL Handler)**

// Inside src/app/page.tsx  
useEffect(() \=\> {  
  if (typeof window \=== 'undefined') return;  
    
  const params \= new URLSearchParams(window.location.search);  
  if (params.toString().length \> 0\) {  
    // Assuming processDeepLink is exposed by the store  
    useAppStore.getState().processDeepLink(Object.fromEntries(params));  
      
    // Clean URL  
    window.history.replaceState({}, '', window.location.pathname);  
  }  
}, \[\]);  