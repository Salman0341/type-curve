// src/intents/design_editor/app.tsx
import React from "react";
import { AppUiProvider } from "@canva/app-ui-kit";
import TextWarpPanel from './components/TextWarpPanel'; 

export const DOCS_URL = "https://www.canva.dev/docs/apps/";

export function App() {
  return (
    <AppUiProvider>
      <TextWarpPanel />
    </AppUiProvider>
  );
}
