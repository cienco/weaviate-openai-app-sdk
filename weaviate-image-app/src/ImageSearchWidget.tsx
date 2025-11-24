import React, { useState } from "react";
import axios from "axios";
import { useOpenAI } from "@openai/apps";

export function ImageSearchWidget() {
  const { tools } = useOpenAI();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);

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
      setStatus("Caricamento immagine...");
      const form = new FormData();
      form.append("image", file); // deve chiamarsi 'image' per /upload-image

      // 1. Upload al tuo MCP server (endpoint HTTP, non tool)
      const uploadResp = await axios.post(
        "https://weaviate-openai-app-sdk.onrender.com/upload-image",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const imageId = uploadResp.data.image_id as string;
      setStatus(`Immagine caricata. image_id=${imageId}. Sto cercando...`);

      // 2. Chiedi a ChatGPT di usare il tool MCP image_search_vertex
      const toolResult = await tools.callTool({
        name: "image_search_vertex", // deve essere EXACT come nel serve.py
        arguments: {
          collection: "Sinde", // come hai forzato in hybrid_search/image_search_vertex
          image_id: imageId,
          limit: 5
        }
      });

      // tools.callTool ti restituisce il contenuto della risposta del tool
      // Se il tool ritorna { count, results }, ci aspettiamo qualcosa tipo:
      // { type: "json", value: { count: ..., results: [...] } } a seconda del client
      // Per semplicità assumiamo che toolResult.content sia già l'oggetto JSON
      // (in pratica controlla una volta la struttura e aggiusta qui).
      // In un caso semplice:
      //   toolResult = { content: { count: n, results: [...] } }
      // Qui facciamo una cosa difensiva:
      const data = (toolResult as any)?.content ?? toolResult;
      setResults(data.results ?? []);
      setStatus("Ricerca completata.");
    } catch (err) {
      console.error(err);
      setStatus("Errore durante upload o ricerca.");
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUploadAndSearch} disabled={!file} style={{ marginLeft: 8 }}>
        Carica e cerca
      </button>

      {status && <p style={{ marginTop: 8 }}>{status}</p>}

      {results && (
        <div style={{ marginTop: 16 }}>
          <h3>Risultati</h3>
          {results.length === 0 && <p>Nessun risultato.</p>}
          {results.length > 0 && (
            <ul>
              {results.map((r, i) => (
                <li key={i}>
                  <code>{r.uuid}</code>{" "}
                  {r.properties?.name && <span>- {r.properties.name}</span>}
                  {typeof r.distance === "number" && (
                    <span> (distance: {r.distance.toFixed(3)})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
