import React from "react";
import { ImageSearchWidget } from "./ImageSearchWidget";

export default function App() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Weaviate Image Search</h2>
      <p>Carica un’immagine e cerca nel tuo indice Weaviate.</p>
      <ImageSearchWidget />
    </div>
  );
}
