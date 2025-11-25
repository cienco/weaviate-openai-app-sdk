// src/ImageSearchWidget.tsx
import React, { useState } from "react";

// URL base del tuo server MCP (quello con serve.py)
const MCP_BASE_URL = "https://weaviate-openai-app-sdk.onrender.com";

type SearchResult = {
  uuid?: string;
  properties?: {
    name?: string;
    source_pdf?: string;
    page_index?: number;
    [key: string]: any;
  };
  distance?: number;
};

export const ImageSearchWidget: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResults(null);
    setStatus(null);
  };

  const handleUploadAndSearch = async () => {
    if (!file) {
      setStatus("Seleziona prima un'immagine.");
      return;
    }

    try {
      setIsLoading(true);
      setStatus("Caricamento dell'immagine in corso...");

      // 1️⃣ Upload immagine al tuo endpoint /upload-image (HTTP, non MCP tool)
      const form = new FormData();
      form.append("image", file); // il campo deve chiamarsi "image"

      const uploadResp = await fetch(`${MCP_BASE_URL}/upload-image`, {
        method: "POST",
        body: form,
      });

      if (!uploadResp.ok) {
        const text = await uploadResp.text();
        throw new Error(
          `Upload fallito (${uploadResp.status}): ${text || "errore sconosciuto"}`
        );
      }

      const uploadData = await uploadResp.json();
      const imageId = uploadData.image_id as string | undefined;

      if (!imageId) {
        throw new Error("Risposta /upload-image senza image_id");
      }

      setStatus(`Immagine caricata (image_id = ${imageId}). Avvio la ricerca...`);

      // 2️⃣ Chiama il backend HTTP /image-search (non più MCP)
      const searchResp = await fetch(`${MCP_BASE_URL}/image-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "Sinde",
          image_id: imageId,
          limit: 10,
        }),
      });

      if (!searchResp.ok) {
        const err = await searchResp.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella ricerca immagini");
      }

      const searchJson = await searchResp.json();
      
      // searchJson.results contiene i tuoi oggetti Weaviate
      const r = searchJson.results ?? [];
      setResults(Array.isArray(r) ? r : []);
      setStatus("Ricerca completata.");

      // 3) PUSH al modello: costruisci riassunto e chiama il tool MCP
      try {
        // Costruisci un piccolo riassunto testuale per il modello
        const top3 = r.slice(0, 3);
        const summaryLines = top3.map((res: SearchResult, idx: number) => {
          const props = res.properties || {};
          const name = props.name || `risultato ${idx + 1}`;
          const source = props.source_pdf || "sorgente sconosciuta";
          const page = props.page_index ?? "?";
          return `- ${name} (source: ${source}, page: ${page})`;
        });

        const resultsSummary = [
          `Il widget Sinde ha trovato ${r.length} risultati.`,
          `Ecco i primi ${top3.length}:`,
          ...summaryLines,
        ].join("\n");

        // Chiama il tool MCP per pushare il riassunto nel modello
        // @ts-ignore
        const client = await (window as any).openai?.createClient();
        
        if (client) {
          await client.tools.call({
            name: "sinde_widget_push_results",
            arguments: {
              results_summary: resultsSummary,
              raw_results: r, // opzionale, ma utile se vuoi dare più contesto
            },
          });
          console.log("Risultati inviati al modello tramite sinde_widget_push_results");
        } else {
          console.warn("window.openai.createClient non disponibile (probabilmente in dev locale)");
        }
      } catch (err: any) {
        console.error("Errore chiamando sinde_widget_push_results:", err);
        // Non bloccare l'UI se la chiamata al tool fallisce
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Errore: ${err?.message || String(err)}`);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button
          onClick={handleUploadAndSearch}
          disabled={!file || isLoading}
          style={{
            marginLeft: 8,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: !file || isLoading ? "default" : "pointer",
          }}
        >
          {isLoading ? "Attendere..." : "Carica e cerca"}
        </button>
      </div>

      {status && <p style={{ marginTop: 4 }}>{status}</p>}

      {results && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Risultati</h3>
          {results.length === 0 && <p>Nessun risultato trovato.</p>}
          {results.length > 0 && (
            <ul style={{ paddingLeft: 18 }}>
              {results.map((r, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <div>
                    <code>{r.uuid}</code>
                  </div>
                  {r.properties?.name && (
                    <div>Nome: {r.properties.name}</div>
                  )}
                  {typeof r.distance === "number" && (
                    <div>Distanza: {r.distance.toFixed(3)}</div>
                  )}
                  {r.properties?.source_pdf && (
                    <div>PDF: {r.properties.source_pdf}</div>
                  )}
                  {typeof r.properties?.page_index === "number" && (
                    <div>Pagina: {r.properties.page_index}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
